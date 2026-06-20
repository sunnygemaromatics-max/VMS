import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { EventBus } from '../../platform/events/event-bus';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtUser, isSuperAdmin } from '../../common/tenant';

const LEVELS = new Set(['info', 'warning', 'urgent']);

@Injectable()
export class NoticesService {
  constructor(
    private readonly events: EventBus,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Notices the calling user should see right now. */
  async list(user: JwtUser, branchId?: string) {
    const now = new Date();
    const where: any = {
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    };

    if (isSuperAdmin(user)) {
      if (branchId) where.AND.push({ OR: [{ branchId }, { branchId: null }] });
    } else {
      const orgId = (user as any).orgId;
      const userBranch = (user as any).branchId;
      // user sees: org-wide notices for their org + branch-specific for their branch + global SUPER_ADMIN notices (orgId null)
      where.AND.push({
        OR: [
          { organizationId: orgId, branchId: null },
          { organizationId: orgId, branchId: userBranch },
          { organizationId: null, branchId: null },
        ],
      });
    }

    return this.prisma.notice.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async create(
    user: JwtUser,
    data: { title: string; body: string; level?: string; branchId?: string | null; expiresAt?: string | null },
  ) {
    if (!data?.title?.trim() || !data?.body?.trim()) {
      throw new BadRequestException('title and body are required');
    }
    const level = LEVELS.has(data.level || '') ? (data.level as string) : 'info';

    // Scope authorization: ORG_ADMIN can only post to their own org/branch.
    let orgId: string | null = null;
    if (!isSuperAdmin(user)) {
      orgId = (user as any).orgId ?? null;
      if (data.branchId) {
        const b = await this.prisma.branch.findUnique({
          where: { id: data.branchId },
          select: { organizationId: true },
        });
        if (!b || b.organizationId !== orgId) {
          throw new ForbiddenException('Branch belongs to another organization');
        }
      }
    }

    const me = await this.prisma.user.findUnique({
      where: { id: (user as any).userId },
      select: { fullName: true, email: true, branch: { select: { organizationId: true } } },
    });
    if (!isSuperAdmin(user) && me?.branch?.organizationId) {
      orgId = me.branch.organizationId;
    }

    const notice = await this.prisma.notice.create({
      data: {
        title: data.title.trim().slice(0, 200),
        body: data.body.trim().slice(0, 2000),
        level,
        organizationId: orgId,
        branchId: data.branchId || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        authorId: (user as any).userId ?? 'unknown',
        authorName: me?.fullName ?? me?.email ?? 'Admin',
      },
    });

    this.events.emit('notice.posted', { notice });

    // Mobile push to everyone affected
    this.notifications
      .pushToDevices({
        title: `📢 ${notice.title}`,
        body: notice.body.slice(0, 120),
        data: { kind: 'notice', noticeId: notice.id },
        branchId: notice.branchId ?? undefined,
        orgId: notice.organizationId ?? undefined,
      })
      .catch(() => {});

    return notice;
  }

  async remove(user: JwtUser, id: string) {
    const existing = await this.prisma.notice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notice not found');
    if (!isSuperAdmin(user)) {
      const orgId = (user as any).orgId;
      if (existing.organizationId && existing.organizationId !== orgId) {
        throw new ForbiddenException('Notice belongs to another organization');
      }
    }
    await this.prisma.notice.delete({ where: { id } });
    this.events.emit('notice.removed', { id });
    return { ok: true };
  }
}
