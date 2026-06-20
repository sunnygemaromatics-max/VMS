import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtUser, isSuperAdmin } from '../../common/tenant';

/**
 * Read + resolution workflow over incidents. Tenant-scoped: non-super-admins
 * only see incidents for their org.
 */
@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  private orgFilter(user: JwtUser) {
    if (isSuperAdmin(user)) return {};
    return { orgId: (user as any).orgId ?? '__none__' };
  }

  async list(user: JwtUser, opts: { status?: string; branchId?: string; limit?: number }) {
    return this.prisma.incident.findMany({
      where: {
        ...this.orgFilter(user),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
      },
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { openedAt: 'desc' }],
      take: Math.min(opts.limit ?? 100, 200),
      include: {
        _count: { select: { alerts: true } },
      },
    });
  }

  async openCount(user: JwtUser) {
    const n = await this.prisma.incident.count({
      where: { ...this.orgFilter(user), status: { in: ['open', 'investigating'] } },
    });
    return { open: n };
  }

  async detail(user: JwtUser, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, ...this.orgFilter(user) },
      include: {
        alerts: { orderBy: { raisedAt: 'desc' } },
        timeline: { orderBy: { ts: 'asc' } },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  private async ensureScope(user: JwtUser, id: string) {
    const inc = await this.prisma.incident.findFirst({
      where: { id, ...this.orgFilter(user) },
      select: { id: true },
    });
    if (!inc) throw new NotFoundException('Incident not found');
  }

  async acknowledge(user: JwtUser, id: string) {
    await this.ensureScope(user, id);
    await this.prisma.alert.updateMany({
      where: { incidentId: id, status: 'open' },
      data: { status: 'acknowledged', ackedAt: new Date(), ackedBy: (user as any).userId },
    });
    await this.prisma.incident.update({ where: { id }, data: { status: 'investigating' } });
    await this.trail(id, 'ACK', user);
    return { ok: true };
  }

  async assign(user: JwtUser, id: string, assignToUserId: string) {
    await this.ensureScope(user, id);
    await this.prisma.incident.update({ where: { id }, data: { assignedTo: assignToUserId } });
    await this.trail(id, 'ASSIGN', user, { assignTo: assignToUserId });
    return { ok: true };
  }

  async note(user: JwtUser, id: string, text: string) {
    await this.ensureScope(user, id);
    await this.trail(id, 'NOTE', user, { text: text.slice(0, 2000) });
    return { ok: true };
  }

  async escalate(user: JwtUser, id: string) {
    await this.ensureScope(user, id);
    const inc = await this.prisma.incident.update({
      where: { id },
      data: { severity: { increment: 1 } },
    });
    if (inc.severity > 5) {
      await this.prisma.incident.update({ where: { id }, data: { severity: 5 } });
    }
    await this.trail(id, 'ESCALATE', user, { severity: Math.min(inc.severity, 5) });
    return { ok: true };
  }

  async resolve(
    user: JwtUser,
    id: string,
    body: { resolution: string; falsePositive?: boolean },
  ) {
    await this.ensureScope(user, id);
    const status = body.falsePositive ? 'false_positive' : 'resolved';
    await this.prisma.alert.updateMany({
      where: { incidentId: id, status: { in: ['open', 'acknowledged'] } },
      data: { status: body.falsePositive ? 'dismissed' : 'resolved', resolvedAt: new Date() },
    });
    await this.prisma.incident.update({
      where: { id },
      data: {
        status,
        resolution: body.resolution?.slice(0, 2000) ?? null,
        resolvedBy: (user as any).userId,
        closedAt: new Date(),
      },
    });
    await this.trail(id, 'RESOLVE', user, { status, resolution: body.resolution });
    return { ok: true };
  }

  private async trail(
    incidentId: string,
    kind: string,
    user: JwtUser,
    payload?: Record<string, unknown>,
  ) {
    await this.prisma.incidentTimelineEntry.create({
      data: {
        incidentId,
        kind,
        actorId: (user as any).userId,
        actorName: (user as any).email,
        payload: (payload ?? {}) as any,
      },
    });
  }
}
