import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtUser, isSuperAdmin } from '../../common/tenant';

const KINDS = new Set(['block', 'flag', 'escort', 'silent_notify']);

/**
 * Named, severity-graded watchlists. A visitor on any active 'block'-kind
 * entry (not expired) is considered blacklisted — Visitor.isBlacklisted is
 * kept in sync as a denormalized cache so existing gate/check-in logic that
 * reads the boolean keeps working unchanged.
 */
@Injectable()
export class WatchlistsService {
  constructor(private readonly prisma: PrismaService) {}

  private orgWhere(user: JwtUser) {
    if (isSuperAdmin(user)) return {};
    // org-scoped lists + global lists (orgId null)
    return { OR: [{ orgId: (user as any).orgId ?? '__none__' }, { orgId: null }] };
  }

  list(user: JwtUser) {
    return this.prisma.watchlist.findMany({
      where: this.orgWhere(user),
      orderBy: [{ isActive: 'desc' }, { severity: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { entries: true } } },
    });
  }

  async create(
    user: JwtUser,
    data: { name: string; description?: string; kind?: string; severity?: number },
  ) {
    if (!data?.name?.trim()) throw new BadRequestException('name is required');
    const kind = KINDS.has(data.kind || '') ? (data.kind as string) : 'flag';
    return this.prisma.watchlist.create({
      data: {
        name: data.name.trim().slice(0, 120),
        description: data.description?.slice(0, 500) ?? null,
        kind,
        severity: clamp(data.severity ?? 3),
        orgId: isSuperAdmin(user) ? null : ((user as any).orgId ?? null),
      },
    });
  }

  async entries(user: JwtUser, watchlistId: string) {
    await this.ensureListScope(user, watchlistId);
    return this.prisma.watchlistEntry.findMany({
      where: { watchlistId },
      orderBy: { createdAt: 'desc' },
      include: {
        visitor: { select: { id: true, fullName: true, phone: true, company: true } },
      },
    });
  }

  async addEntry(
    user: JwtUser,
    watchlistId: string,
    data: { visitorId: string; reason: string; expiresAt?: string | null },
  ) {
    const list = await this.ensureListScope(user, watchlistId);
    if (!data?.visitorId || !data?.reason?.trim()) {
      throw new BadRequestException('visitorId and reason are required');
    }
    const me = await this.prisma.user.findUnique({
      where: { id: (user as any).userId },
      select: { fullName: true, email: true },
    });
    const entry = await this.prisma.watchlistEntry.upsert({
      where: { watchlistId_visitorId: { watchlistId, visitorId: data.visitorId } },
      update: {
        reason: data.reason.slice(0, 1000),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      create: {
        watchlistId,
        visitorId: data.visitorId,
        reason: data.reason.slice(0, 1000),
        source: 'manual',
        addedBy: (user as any).userId,
        addedByName: me?.fullName ?? me?.email ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    if (list.kind === 'block') await this.syncBlacklist(data.visitorId);
    return entry;
  }

  async removeEntry(user: JwtUser, watchlistId: string, entryId: string) {
    await this.ensureListScope(user, watchlistId);
    const entry = await this.prisma.watchlistEntry.findUnique({
      where: { id: entryId },
      select: { visitorId: true, watchlistId: true },
    });
    if (!entry || entry.watchlistId !== watchlistId) {
      throw new NotFoundException('Entry not found');
    }
    await this.prisma.watchlistEntry.delete({ where: { id: entryId } });
    await this.syncBlacklist(entry.visitorId);
    return { ok: true };
  }

  /**
   * Recomputes Visitor.isBlacklisted from active, unexpired 'block' entries.
   * Single source of truth → cached boolean for hot-path reads.
   */
  private async syncBlacklist(visitorId: string) {
    const now = new Date();
    const blocking = await this.prisma.watchlistEntry.count({
      where: {
        visitorId,
        watchlist: { kind: 'block', isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    await this.prisma.visitor.update({
      where: { id: visitorId },
      data: { isBlacklisted: blocking > 0 },
    });
  }

  private async ensureListScope(user: JwtUser, watchlistId: string) {
    const list = await this.prisma.watchlist.findFirst({
      where: { id: watchlistId, ...this.orgWhere(user) },
    });
    if (!list) throw new NotFoundException('Watchlist not found');
    if (!isSuperAdmin(user) && list.orgId === null) {
      // org users can view global lists but not edit them
      throw new ForbiddenException('Global watchlists are read-only for your role');
    }
    return list;
  }
}

function clamp(s: number): number {
  return Math.max(1, Math.min(5, Math.round(s)));
}
