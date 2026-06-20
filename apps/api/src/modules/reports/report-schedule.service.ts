import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JobQueueService } from '../../platform/jobs/job-queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReportsService, ReportFilter } from './reports.service';
import { JwtUser, isSuperAdmin, requireOrg } from '../../common/tenant';

const VALID_REPORTS = [
  'visits',
  'workforce',
  'contractors',
  'branches',
  'users',
  'materials',
  'incidents',
  'audit',
  'vehicles',
  'gate-activity',
];
const VALID_FREQ = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'];
const VALID_PRESETS = ['thisMonth', 'lastMonth', 'last7d', 'last30d', 'last90d', 'ytd'];
const POLL_MS = 60_000;
const EMAIL_PREVIEW_ROWS = 40;

// BullMQ queues: a single repeatable "tick" fans out per-schedule "deliver"
// jobs. Each occurrence is consumed by exactly one worker, so horizontally
// scaling the API never double-sends. Inline mode (no Redis) falls back to a
// local interval driving the same scanAndDispatch() path.
const TICK_QUEUE = 'reports.schedule.tick';
const DELIVER_QUEUE = 'reports.schedule.deliver';

export interface ScheduleInput {
  name: string;
  report: string;
  groupBy?: string;
  branchId?: string;
  contractorId?: string;
  rangePreset?: string;
  frequency?: string;
  hourUtc?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  recipients: string;
  isActive?: boolean;
}

/**
 * Saved-report scheduler. A lightweight in-process poller (60s) finds due
 * schedules and emails each as an HTML summary + CSV attachment. Works in
 * both queue and inline job modes since it relies only on DB state + the
 * notifications channel (which itself no-ops gracefully without Resend).
 */
@Injectable()
export class ReportScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('ReportScheduler');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobQueueService,
  ) {}

  async onModuleInit() {
    // tick → scan due schedules and fan out deliver jobs.
    this.jobs.register(TICK_QUEUE, () => this.scanAndDispatch(), { concurrency: 1 });
    // deliver → render + email a single schedule by id.
    this.jobs.register<{ scheduleId: string }>(
      DELIVER_QUEUE,
      ({ scheduleId }) => this.deliverById(scheduleId),
      { concurrency: 3 },
    );

    if (this.jobs.isQueueMode()) {
      await this.jobs.addRepeatable(TICK_QUEUE, POLL_MS);
      this.log.log('scheduler running on BullMQ (distributed, single-delivery)');
    } else {
      // No Redis: drive the same path from a local interval.
      this.timer = setInterval(
        () => this.scanAndDispatch().catch((e) => this.log.warn(e?.message ?? e)),
        POLL_MS,
      );
      if (this.timer.unref) this.timer.unref();
      this.log.log('scheduler running inline (single-process interval)');
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── CRUD ──────────────────────────────────────────────────────────

  list(user: JwtUser) {
    const where = isSuperAdmin(user) ? {} : { orgId: requireOrg(user) };
    return this.prisma.reportSchedule.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async create(user: JwtUser, input: ScheduleInput) {
    this.validate(input);
    const orgId = isSuperAdmin(user) ? null : requireOrg(user);
    const nextRunAt = this.computeNextRun(input, new Date());
    return this.prisma.reportSchedule.create({
      data: {
        orgId,
        branchId: input.branchId || null,
        contractorId: input.contractorId || null,
        createdBy: user.userId,
        name: input.name.slice(0, 160),
        report: input.report,
        groupBy: input.groupBy || null,
        rangePreset: input.rangePreset || 'last30d',
        frequency: input.frequency || 'monthly',
        hourUtc: clampInt(input.hourUtc ?? 6, 0, 23),
        dayOfWeek: input.frequency === 'weekly' ? clampInt(input.dayOfWeek ?? 1, 0, 6) : null,
        dayOfMonth: input.frequency === 'monthly' ? clampInt(input.dayOfMonth ?? 1, 1, 28) : null,
        recipients: input.recipients.slice(0, 1000),
        isActive: input.isActive ?? true,
        nextRunAt,
      },
    });
  }

  async update(user: JwtUser, id: string, input: Partial<ScheduleInput>) {
    const existing = await this.owned(user, id);
    const merged = { ...existing, ...input } as any;
    if (input.report || input.recipients || input.name) this.validate(merged);
    const nextRunAt = this.computeNextRun(merged, new Date());
    return this.prisma.reportSchedule.update({
      where: { id },
      data: {
        name: merged.name?.slice(0, 160),
        report: merged.report,
        groupBy: merged.groupBy || null,
        branchId: merged.branchId || null,
        contractorId: merged.contractorId || null,
        rangePreset: merged.rangePreset || 'last30d',
        frequency: merged.frequency || 'monthly',
        hourUtc: clampInt(merged.hourUtc ?? 6, 0, 23),
        dayOfWeek: merged.frequency === 'weekly' ? clampInt(merged.dayOfWeek ?? 1, 0, 6) : null,
        dayOfMonth: merged.frequency === 'monthly' ? clampInt(merged.dayOfMonth ?? 1, 1, 28) : null,
        recipients: merged.recipients?.slice(0, 1000),
        isActive: merged.isActive ?? true,
        nextRunAt,
      },
    });
  }

  async remove(user: JwtUser, id: string) {
    await this.owned(user, id);
    await this.prisma.reportSchedule.delete({ where: { id } });
    return { ok: true };
  }

  /** Render + email immediately (test/preview). Does not change nextRunAt. */
  async runNow(user: JwtUser, id: string) {
    const s = await this.owned(user, id);
    const result = await this.deliver(s);
    await this.prisma.reportSchedule.update({
      where: { id },
      data: { lastRunAt: new Date(), lastStatus: result.status },
    });
    return result;
  }

  /**
   * Ad-hoc "email this report now" — renders the chosen report with the
   * supplied filters and emails it as CSV + XLSX attachments. No DB schedule
   * is created. Used by the "Email this report" button in /reports.
   */
  async emailAdHoc(
    user: JwtUser,
    payload: {
      report: string;
      groupBy?: string;
      from?: string;
      to?: string;
      branchId?: string;
      contractorId?: string;
      recipients: string;
      subject?: string;
    },
  ): Promise<{ status: string; rows: number; sent: number; failed: number }> {
    if (!VALID_REPORTS.includes(payload.report)) {
      throw new BadRequestException('invalid report');
    }
    const recipients = (payload.recipients || '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      throw new BadRequestException('at least one recipient email is required');
    }
    for (const e of recipients) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
        throw new BadRequestException(`invalid email: ${e}`);
      }
    }

    const filter: ReportFilter = {
      from: payload.from,
      to: payload.to,
      branchId: payload.branchId,
      contractorId: payload.contractorId,
      groupBy: payload.groupBy,
    };
    const { title, rows } = await this.reports.renderRows(user, payload.report, filter);
    const range = { from: payload.from || '—', to: payload.to || '—' };

    const csv = toCsv(rows);
    const name = payload.subject?.trim() || `${title} report`;
    const html = this.emailHtml(name, title, range, rows);
    const base = `${payload.report}-${range.from}_${range.to}`;
    const attachments = [
      {
        filename: `${base}.xlsx`,
        content: buildXlsxBase64(
          title,
          {
            name,
            report: payload.report,
            groupBy: payload.groupBy ?? null,
            rangePreset: 'adhoc',
            frequency: 'adhoc',
          },
          range,
          rows,
        ),
      },
      { filename: `${base}.csv`, content: Buffer.from(csv, 'utf8').toString('base64') },
    ];

    let sent = 0;
    let failed = 0;
    let lastReason = '';
    for (const to of recipients) {
      const res = await this.notifications.send({
        to,
        subject: `[VMS Report] ${name} · ${range.from} → ${range.to}`,
        html,
        attachments,
      });
      if (res.sent) sent++;
      else {
        failed++;
        lastReason = res.reason ?? 'unknown';
      }
    }
    const status = sent > 0
      ? `sent to ${sent}/${recipients.length} (${rows.length} rows)`
      : `not sent: ${lastReason || 'unknown'}`;
    return { status, rows: rows.length, sent, failed };
  }

  // ── Scheduler loop ────────────────────────────────────────────────

  /**
   * Find due schedules, advance their nextRunAt immediately (so the next
   * tick won't re-pick them), then hand each off for delivery. In queue
   * mode delivery is enqueued (consumed once by any worker); inline mode
   * delivers in-process.
   */
  private async scanAndDispatch() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const due = await this.prisma.reportSchedule.findMany({
        where: { isActive: true, nextRunAt: { lte: now } },
        take: 50,
      });
      for (const s of due) {
        // Advance the schedule up-front to avoid duplicate dispatch.
        await this.prisma.reportSchedule.update({
          where: { id: s.id },
          data: { nextRunAt: this.computeNextRun(s as any, now) },
        });
        if (this.jobs.isQueueMode()) {
          await this.jobs.enqueue(DELIVER_QUEUE, { scheduleId: s.id });
        } else {
          await this.deliverById(s.id);
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** Worker entrypoint: deliver a single schedule and record its status. */
  private async deliverById(scheduleId: string) {
    const s = await this.prisma.reportSchedule.findUnique({ where: { id: scheduleId } });
    if (!s || !s.isActive) return;
    const now = new Date();
    try {
      const result = await this.deliver(s);
      await this.prisma.reportSchedule.update({
        where: { id: scheduleId },
        data: { lastRunAt: now, lastStatus: result.status },
      });
    } catch (e: any) {
      await this.prisma.reportSchedule.update({
        where: { id: scheduleId },
        data: { lastRunAt: now, lastStatus: `error: ${e?.message ?? e}`.slice(0, 300) },
      });
    }
  }

  private async deliver(s: any): Promise<{ status: string; rows: number; recipients: number }> {
    const actor: JwtUser = {
      userId: s.createdBy || 'scheduler',
      email: '',
      role: s.orgId ? 'ORG_ADMIN' : 'SUPER_ADMIN',
      orgId: s.orgId ?? null,
      branchId: null,
    };
    const range = this.presetToRange(s.rangePreset);
    const filter: ReportFilter = {
      from: range.from,
      to: range.to,
      branchId: s.branchId || undefined,
      contractorId: s.contractorId || undefined,
      groupBy: s.groupBy || undefined,
    };
    const { title, rows } = await this.reports.renderRows(actor, s.report, filter);
    const recipients = s.recipients.split(',').map((r: string) => r.trim()).filter(Boolean);
    if (recipients.length === 0) return { status: 'no recipients', rows: rows.length, recipients: 0 };

    const csv = toCsv(rows);
    const html = this.emailHtml(s.name, title, range, rows);
    const base = `${s.report}-${range.from}_${range.to}`;
    const attachments = [
      { filename: `${base}.xlsx`, content: buildXlsxBase64(title, s, range, rows) },
      { filename: `${base}.csv`, content: Buffer.from(csv, 'utf8').toString('base64') },
    ];

    let okCount = 0;
    let lastReason = '';
    for (const to of recipients) {
      const res = await this.notifications.send({
        to,
        subject: `[VMS Report] ${s.name} · ${range.from} → ${range.to}`,
        html,
        attachments,
      });
      if (res.sent) okCount++;
      else lastReason = res.reason ?? 'unknown';
    }
    const status = okCount > 0
      ? `sent to ${okCount}/${recipients.length} (${rows.length} rows)`
      : `not sent: ${lastReason}`;
    return { status, rows: rows.length, recipients: recipients.length };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private async owned(user: JwtUser, id: string) {
    const s = await this.prisma.reportSchedule.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Schedule not found');
    if (!isSuperAdmin(user) && s.orgId !== requireOrg(user)) {
      throw new NotFoundException('Schedule not found');
    }
    return s;
  }

  private validate(input: ScheduleInput) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    if (!VALID_REPORTS.includes(input.report)) throw new BadRequestException('invalid report');
    if (input.frequency && !VALID_FREQ.includes(input.frequency)) throw new BadRequestException('invalid frequency');
    if (input.rangePreset && !VALID_PRESETS.includes(input.rangePreset)) throw new BadRequestException('invalid rangePreset');
    const emails = (input.recipients || '').split(',').map((r) => r.trim()).filter(Boolean);
    if (emails.length === 0) throw new BadRequestException('at least one recipient email is required');
    for (const e of emails) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new BadRequestException(`invalid email: ${e}`);
    }
  }

  /** Next UTC fire time strictly after `from`. */
  computeNextRun(s: { frequency?: string; hourUtc?: number; dayOfWeek?: number | null; dayOfMonth?: number | null }, from: Date): Date {
    const hour = clampInt(s.hourUtc ?? 6, 0, 23);
    const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour, 0, 0, 0));
    const freq = s.frequency || 'monthly';
    if (freq === 'daily') {
      if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
      return next;
    }
    if (freq === 'weekly') {
      const target = clampInt(s.dayOfWeek ?? 1, 0, 6);
      let delta = (target - next.getUTCDay() + 7) % 7;
      next.setUTCDate(next.getUTCDate() + delta);
      if (next <= from) next.setUTCDate(next.getUTCDate() + 7);
      return next;
    }
    const dom = clampInt(s.dayOfMonth ?? 1, 1, 28);
    if (freq === 'quarterly') {
      // Fire on the dom of the first month of the next quarter the calendar
      // hasn't visited yet (Jan, Apr, Jul, Oct).
      const month = next.getUTCMonth();
      const quarterStart = month - (month % 3);
      next.setUTCMonth(quarterStart, dom);
      if (next <= from) next.setUTCMonth(next.getUTCMonth() + 3, dom);
      return next;
    }
    if (freq === 'annually') {
      next.setUTCMonth(0, dom);
      if (next <= from) next.setUTCFullYear(next.getUTCFullYear() + 1, 0, dom);
      return next;
    }
    // monthly
    next.setUTCDate(dom);
    if (next <= from) next.setUTCMonth(next.getUTCMonth() + 1, dom);
    return next;
  }

  presetToRange(preset: string): { from: string; to: string } {
    const now = new Date();
    const d = (date: Date) => date.toISOString().slice(0, 10);
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
    const som = (dt: Date) => new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1));
    switch (preset) {
      case 'thisMonth': return { from: d(som(now)), to: d(now) };
      case 'lastMonth': {
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
        return { from: d(som(end)), to: d(end) };
      }
      case 'last7d': return { from: d(daysAgo(7)), to: d(now) };
      case 'last90d': return { from: d(daysAgo(90)), to: d(now) };
      case 'ytd': return { from: d(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), to: d(now) };
      case 'last30d':
      default: return { from: d(daysAgo(30)), to: d(now) };
    }
  }

  private emailHtml(name: string, title: string, range: { from: string; to: string }, rows: any[]): string {
    const preview = rows.slice(0, EMAIL_PREVIEW_ROWS);
    const headers = preview.length ? Object.keys(preview[0]) : [];
    const thead = headers.map((h) => `<th style="text-align:left;padding:6px 10px;border-bottom:1px solid #334155;font-size:12px;color:#94a3b8">${esc(h)}</th>`).join('');
    const tbody = preview
      .map(
        (r) =>
          `<tr>${headers
            .map((h) => `<td style="padding:6px 10px;border-bottom:1px solid #1e293b;font-size:12px;color:#e2e8f0">${esc(r[h] ?? '—')}</td>`)
            .join('')}</tr>`,
      )
      .join('');
    const more = rows.length > EMAIL_PREVIEW_ROWS ? `<p style="font-size:12px;color:#94a3b8">Showing ${EMAIL_PREVIEW_ROWS} of ${rows.length} rows — full data in the attached CSV.</p>` : '';
    return `
      <div style="font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;padding:24px;border-radius:12px;max-width:900px;margin:auto">
        <h2 style="margin-top:0">${esc(name)}</h2>
        <p style="color:#94a3b8;margin:4px 0 16px">${esc(title)} report · ${range.from} → ${range.to} · ${rows.length} rows</p>
        ${rows.length === 0
          ? '<p style="color:#94a3b8">No data for this period.</p>'
          : `<table style="border-collapse:collapse;width:100%"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`}
        ${more}
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0"/>
        <p style="font-size:11px;color:#64748b">Automated VMS report. To change recipients or cadence, edit this schedule in Analytics &amp; Reports.</p>
      </div>`;
  }
}

function clampInt(n: number, lo: number, hi: number): number {
  const v = Math.round(Number.isFinite(n) ? n : lo);
  return Math.min(hi, Math.max(lo, v));
}

function esc(v: any): string {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const cell = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\n');
}

/** Build a 2-sheet (.xlsx) workbook (Info + Data) as base64 for email. */
function buildXlsxBase64(
  title: string,
  s: { name: string; report: string; groupBy: string | null; rangePreset: string; frequency: string },
  range: { from: string; to: string },
  rows: any[],
): string {
  const wb = XLSX.utils.book_new();

  const info = [
    { Field: 'Schedule', Value: s.name },
    { Field: 'Report', Value: title },
    { Field: 'Grouped by', Value: s.groupBy || '—' },
    { Field: 'Date range', Value: `${range.from} → ${range.to}` },
    { Field: 'Cadence', Value: `${s.frequency} (${s.rangePreset})` },
    { Field: 'Rows', Value: rows.length },
    { Field: 'Generated', Value: new Date().toISOString() },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), 'Info');

  if (rows.length) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0]);
    ws['!cols'] = headers.map((h) => {
      const maxLen = Math.max(h.length, ...rows.map((r) => (r[h] == null ? 0 : String(r[h]).length)));
      return { wch: Math.min(48, Math.max(8, maxLen + 2)) };
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
  }

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
