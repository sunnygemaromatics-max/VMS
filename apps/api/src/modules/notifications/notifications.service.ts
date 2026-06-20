import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JobQueueService } from '../../platform/jobs/job-queue.service';

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  /** Optional file attachments. `content` is base64-encoded. */
  attachments?: { filename: string; content: string }[];
}

interface PushArgs {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Filter recipients. Empty = every registered device. */
  branchId?: string;
  orgId?: string;
  userId?: string;
}

/**
 * Sends transactional email via Resend if RESEND_API_KEY is set.
 * Otherwise becomes a no-op that logs what would have been sent.
 * This lets the app run on the free tier without any email provider.
 */
const PUSH_QUEUE = 'notifications.push';
const EMAIL_QUEUE = 'notifications.email';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly log = new Logger('Notifications');
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly from =
    process.env.RESEND_FROM ||
    'VMS <onboarding@resend.dev>'; // resend's sandbox sender — works without domain verification but only to verified test addresses
  private readonly telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  private readonly telegramChatId = process.env.TELEGRAM_CHAT_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobQueueService,
  ) {}

  onModuleInit() {
    this.jobs.register<PushArgs>(PUSH_QUEUE, (data) => this.runPush(data), { concurrency: 4 });
    this.jobs.register<SendArgs>(EMAIL_QUEUE, (data) => this.runEmail(data), { concurrency: 2 });
  }

  /**
   * Free notification channel via Telegram Bot API. No-op without
   * TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID env vars.
   * To set up: create a bot via @BotFather → get token, then add the
   * bot to your group/channel and look up the chat id.
   */
  async telegram(text: string): Promise<{ sent: boolean; reason?: string }> {
    if (!this.telegramToken || !this.telegramChatId) {
      return { sent: false, reason: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' };
    }
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.telegramChatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.log.warn(`Telegram ${res.status}: ${body}`);
        return { sent: false, reason: `Telegram HTTP ${res.status}` };
      }
      return { sent: true };
    } catch (e: any) {
      this.log.warn(`Telegram send failed: ${e?.message ?? e}`);
      return { sent: false, reason: e?.message ?? 'network error' };
    }
  }

  async send({ to, subject, html, attachments }: SendArgs): Promise<{ sent: boolean; reason?: string }> {
    if (!this.apiKey) {
      this.log.log(`[noop] would email ${to}: ${subject}`);
      return { sent: false, reason: 'RESEND_API_KEY not configured' };
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to,
          subject,
          html,
          ...(attachments?.length ? { attachments } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.log.warn(`Resend ${res.status}: ${body}`);
        return { sent: false, reason: `Resend HTTP ${res.status}` };
      }
      return { sent: true };
    } catch (e: any) {
      this.log.warn(`Resend send failed: ${e?.message ?? e}`);
      return { sent: false, reason: e?.message ?? 'network error' };
    }
  }

  /** Persist or refresh a device's Expo push token. */
  async registerDeviceToken(args: {
    token: string;
    platform: string;
    userId?: string | null;
    branchId?: string | null;
    orgId?: string | null;
  }) {
    if (!args.token || !args.token.startsWith('ExponentPushToken')) {
      return { ok: false, reason: 'Invalid Expo push token' };
    }
    await this.prisma.deviceToken.upsert({
      where: { token: args.token },
      update: {
        platform: args.platform.slice(0, 20),
        userId: args.userId ?? null,
        branchId: args.branchId ?? null,
        orgId: args.orgId ?? null,
      },
      create: {
        token: args.token,
        platform: args.platform.slice(0, 20),
        userId: args.userId ?? null,
        branchId: args.branchId ?? null,
        orgId: args.orgId ?? null,
      },
    });
    return { ok: true };
  }

  async unregisterDeviceToken(token: string) {
    if (!token) return { ok: false };
    await this.prisma.deviceToken.deleteMany({ where: { token } });
    return { ok: true };
  }

  /**
   * Enqueue a push fan-out. Returns immediately — actual Expo delivery
   * happens in the JobQueue worker (this process or a separate ai-worker).
   * Use pushToDevicesSync() only when callers genuinely need send counts.
   */
  pushToDevices(args: PushArgs): Promise<void> {
    return this.jobs.enqueue(PUSH_QUEUE, args);
  }

  /**
   * Synchronous variant for the rare caller that needs delivery stats.
   * Avoid on hot request paths.
   */
  pushToDevicesSync(args: PushArgs): Promise<{ sent: number; failed: number }> {
    return this.runPush(args);
  }

  private async runPush(args: PushArgs): Promise<{ sent: number; failed: number }> {
    const where: any = {};
    if (args.userId) where.userId = args.userId;
    if (args.branchId) where.branchId = args.branchId;
    if (args.orgId) where.orgId = args.orgId;

    const tokens = await this.prisma.deviceToken.findMany({ where, select: { token: true } });
    if (tokens.length === 0) return { sent: 0, failed: 0 };

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title: args.title,
      body: args.body,
      data: args.data ?? {},
    }));

    // Expo accepts batches up to 100 per call
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });
        if (!res.ok) {
          this.log.warn(`Expo push ${res.status}: ${await res.text().catch(() => '')}`);
          failed += batch.length;
          continue;
        }
        sent += batch.length;
      } catch (e: any) {
        this.log.warn(`Expo push failed: ${e?.message ?? e}`);
        failed += batch.length;
      }
    }
    return { sent, failed };
  }

  private async runEmail(args: SendArgs): Promise<{ sent: boolean; reason?: string }> {
    return this.send(args);
  }

  async sendVisitorPassApproved(args: {
    to: string;
    visitorName: string;
    hostName: string;
    branchName: string;
    expectedEntry: Date | string;
    passUrl: string;
  }) {
    const html = `
      <div style="font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;padding:24px;border-radius:12px;max-width:520px;margin:auto">
        <h2 style="margin-top:0">✓ Your visit is approved</h2>
        <p>Hi ${escape(args.visitorName)},</p>
        <p>Your visit to <strong>${escape(args.branchName)}</strong> hosted by <strong>${escape(args.hostName)}</strong> on ${new Date(args.expectedEntry).toLocaleString()} has been approved.</p>
        <p>Show this pass at the gate:</p>
        <p style="margin:24px 0"><a href="${args.passUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Open visitor pass</a></p>
        <p style="font-size:12px;color:#94a3b8">If the button doesn't work, copy this link: ${args.passUrl}</p>
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0"/>
        <p style="font-size:11px;color:#64748b">The Studio Infinito &middot; a Personify Crafters company</p>
      </div>`;
    return this.send({
      to: args.to,
      subject: `Your visitor pass for ${args.branchName}`,
      html,
    });
  }
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
