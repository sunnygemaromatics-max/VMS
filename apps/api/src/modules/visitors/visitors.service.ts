import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { EventBus } from '../../platform/events/event-bus';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtUser, isSuperAdmin, visitScope } from '../../common/tenant';

// Strip "data:image/jpeg;base64," prefix and convert to Buffer for Prisma Bytes.
// Returns undefined for empty input so Prisma leaves the column null.
function parsePhotoBase64(input?: string | null): Buffer | undefined {
  if (!input) return undefined;
  const cleaned = input.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  if (cleaned.length === 0) return undefined;
  try {
    return Buffer.from(cleaned, 'base64');
  } catch {
    return undefined;
  }
}

@Injectable()
export class VisitorsService {
  constructor(
    private readonly events: EventBus,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async createVisit(user: JwtUser, data: any) {
    if (!data.visitorId || !data.branchId || !data.hostId) {
      throw new BadRequestException('visitorId, branchId, hostId required');
    }

    // Authorize: branch must be in user's org (unless super admin)
    if (!isSuperAdmin(user)) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: data.branchId },
        select: { organizationId: true },
      });
      if (!branch) throw new BadRequestException('Branch not found');
      if (branch.organizationId !== (user as any).orgId) {
        throw new ForbiddenException('Branch belongs to another organization');
      }
    }

    const qrToken = crypto.randomBytes(16).toString('hex');
    const groupSize = Number.isFinite(data.groupSize) && data.groupSize >= 1
      ? Math.min(20, Math.floor(data.groupSize))
      : 1;

    const PASS_KINDS = ['SINGLE', 'MULTI_ENTRY', 'MULTI_DAY', 'RECURRING'];
    const passKind = PASS_KINDS.includes(data.passKind) ? data.passKind : 'SINGLE';
    const maxEntries =
      Number.isFinite(data.maxEntries) && data.maxEntries >= 1
        ? Math.min(500, Math.floor(data.maxEntries))
        : null;

    return this.prisma.visit.create({
      data: {
        visitorId: data.visitorId,
        branchId: data.branchId,
        hostId: data.hostId,
        purpose: data.purpose,
        expectedEntry: new Date(data.expectedEntry),
        vehicleNumber: data.vehicleNumber,
        qrCodeToken: qrToken,
        groupSize,
        passKind: passKind as any,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        maxEntries,
        escortRequired: !!data.escortRequired,
        escortUserId: data.escortUserId ?? null,
        status: data.status === 'APPROVED' ? VisitStatus.APPROVED : VisitStatus.PENDING,
      },
    });
  }

  async setVip(visitorId: string, isVip: boolean) {
    return this.prisma.visitor.update({
      where: { id: visitorId },
      data: { isVip },
      select: { id: true, fullName: true, isVip: true },
    });
  }

  async getAllVisits(user: JwtUser, branchId?: string) {
    const where: any = { ...visitScope(user) };
    if (branchId) where.branchId = branchId;
    return this.prisma.visit.findMany({
      where,
      include: {
        visitor: true,
        host: { select: { id: true, fullName: true, email: true } },
        branch: { select: { id: true, name: true, location: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingVisits(user: JwtUser) {
    return this.prisma.visit.findMany({
      where: { status: VisitStatus.PENDING, ...visitScope(user) },
      include: {
        visitor: true,
        host: { select: { id: true, fullName: true, email: true } },
        branch: { select: { id: true, name: true, location: true } },
      },
      orderBy: { expectedEntry: 'asc' },
    });
  }

  /** Public visitor pass — exposed without auth so the visitor can open the link. */
  async getPublicPass(id: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      include: {
        visitor: { select: { id: true, fullName: true, company: true, phone: true } },
        host: { select: { fullName: true, email: true } },
        branch: { select: { name: true, location: true } },
      },
    });
    if (!visit) return null;
    return {
      visitId: visit.id,
      visitorId: visit.visitor.id,
      qrCodeToken: visit.qrCodeToken,
      status: visit.status,
      purpose: visit.purpose,
      expectedEntry: visit.expectedEntry,
      actualEntry: visit.actualEntry,
      actualExit: visit.actualExit,
      vehicleNumber: visit.vehicleNumber,
      visitor: visit.visitor,
      host: visit.host,
      branch: visit.branch,
    };
  }

  /**
   * Per-day visit count for the last N days, scoped to user's org.
   * Returns oldest -> newest. Each entry: { date: 'YYYY-MM-DD', count }.
   */
  async getDailyAnalytics(user: JwtUser, days = 7) {
    const cap = Math.min(Math.max(days, 1), 90);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (cap - 1));

    const visits = await this.prisma.visit.findMany({
      where: { createdAt: { gte: since }, ...visitScope(user) },
      select: { createdAt: true, status: true },
    });

    const buckets: Record<string, { total: number; approved: number; checkedIn: number }> = {};
    for (let i = 0; i < cap; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      buckets[d.toISOString().slice(0, 10)] = { total: 0, approved: 0, checkedIn: 0 };
    }
    for (const v of visits) {
      const key = v.createdAt.toISOString().slice(0, 10);
      const b = buckets[key];
      if (!b) continue;
      b.total += 1;
      if (v.status === 'APPROVED' || v.status === 'CHECKED_IN' || v.status === 'CHECKED_OUT') b.approved += 1;
      if (v.status === 'CHECKED_IN' || v.status === 'CHECKED_OUT') b.checkedIn += 1;
    }
    return Object.entries(buckets).map(([date, b]) => ({ date, ...b }));
  }

  /** List of vehicles seen — every visit with a vehicleNumber. */
  async listVehicles(user: JwtUser, limit = 200) {
    return this.prisma.visit.findMany({
      where: { vehicleNumber: { not: null }, ...visitScope(user) },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        vehicleNumber: true,
        status: true,
        expectedEntry: true,
        actualEntry: true,
        actualExit: true,
        visitor: { select: { fullName: true, phone: true, company: true } },
        branch: { select: { name: true } },
      },
    });
  }

  async getVisit(user: JwtUser, id: string) {
    return this.prisma.visit.findFirst({
      where: { id, ...visitScope(user) },
      include: {
        visitor: true,
        host: { select: { id: true, fullName: true, email: true } },
        branch: { select: { id: true, name: true, location: true } },
      },
    });
  }

  private async ensureVisitInScope(user: JwtUser, id: string) {
    if (isSuperAdmin(user)) return;
    const found = await this.prisma.visit.findFirst({
      where: { id, ...visitScope(user) },
      select: { id: true },
    });
    if (!found) {
      // Hide existence: 404 not 403
      throw new (await import('@nestjs/common')).NotFoundException('Visit not found');
    }
  }

  async updateVisitStatus(user: JwtUser, id: string, status: string) {
    await this.ensureVisitInScope(user, id);
    const updated = await this.prisma.visit.update({
      where: { id },
      data: { status: status as any },
      include: {
        visitor: { select: { fullName: true, email: true } },
        host: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
    });

    // Fire-and-forget approval email — no-op if RESEND_API_KEY isn't set
    if (status === 'APPROVED' && updated.visitor.email) {
      const base = process.env.PUBLIC_WEB_URL || 'https://vms-web-theta.vercel.app';
      this.notifications
        .sendVisitorPassApproved({
          to: updated.visitor.email,
          visitorName: updated.visitor.fullName,
          hostName: updated.host.fullName,
          branchName: updated.branch.name,
          expectedEntry: updated.expectedEntry,
          passUrl: `${base}/pass/${updated.id}`,
        })
        .catch(() => {});
    }

    // Real-time push to dashboards + mobile devices
    if (status === 'APPROVED' || status === 'REJECTED') {
      this.events.emit('visit.decided', {
        visitId: updated.id,
        branchId: updated.branchId,
        visitorName: updated.visitor.fullName,
        hostName: updated.host.fullName,
        status: status as 'APPROVED' | 'REJECTED',
        visitorEmail: updated.visitor.email,
        ts: new Date().toISOString(),
      });
      this.notifications
        .pushToDevices({
          title: `Visit ${status.toLowerCase()}`,
          body: `${updated.visitor.fullName} · ${updated.host.fullName}`,
          data: { visitId: updated.id, kind: 'approval' },
          branchId: updated.branchId,
        })
        .catch(() => {});
    }

    return updated;
  }

  /**
   * Currently-inside people for the user's org, with face photos as base64.
   * Used by the mobile Face Verify screen to compare a captured face against
   * everyone on-site right now.
   */
  async getActiveOnSite(user: JwtUser, branchId?: string) {
    const orgFilter = visitScope(user);
    const visitWhere: any = { status: VisitStatus.CHECKED_IN, actualExit: null, ...orgFilter };
    if (branchId) visitWhere.branchId = branchId;

    const visits = await this.prisma.visit.findMany({
      where: visitWhere,
      orderBy: { actualEntry: 'desc' },
      take: 100,
      include: {
        visitor: {
          select: { id: true, fullName: true, phone: true, company: true, faceData: true },
        },
        host: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
    });

    const attendanceWhere: any = { checkOut: null };
    if (!isSuperAdmin(user)) attendanceWhere.branch = { organizationId: (user as any).orgId };
    if (branchId) attendanceWhere.branchId = branchId;
    const workers = await this.prisma.attendance.findMany({
      where: attendanceWhere,
      orderBy: { checkIn: 'desc' },
      take: 100,
      include: {
        worker: {
          select: { id: true, fullName: true, phone: true, faceData: true, contractor: { select: { companyName: true } } },
        },
        branch: { select: { name: true } },
      },
    });

    return {
      visitors: visits.map((v) => ({
        kind: 'visitor' as const,
        visitId: v.id,
        id: v.visitor.id,
        name: v.visitor.fullName,
        phone: v.visitor.phone,
        company: v.visitor.company ?? undefined,
        host: v.host?.fullName,
        branch: v.branch?.name,
        entryAt: v.actualEntry,
        photo: v.visitor.faceData ? `data:image/jpeg;base64,${Buffer.from(v.visitor.faceData as Uint8Array).toString('base64')}` : null,
      })),
      workers: workers.map((a) => ({
        kind: 'worker' as const,
        attendanceId: a.id,
        id: a.worker.id,
        name: a.worker.fullName,
        phone: a.worker.phone,
        company: a.worker.contractor?.companyName,
        branch: a.branch?.name,
        entryAt: a.checkIn,
        photo: a.worker.faceData ? `data:image/jpeg;base64,${Buffer.from(a.worker.faceData as Uint8Array).toString('base64')}` : null,
      })),
    };
  }

  async checkInVisitor(user: JwtUser, visitId: string) {
    await this.ensureVisitInScope(user, visitId);
    const v = await this.prisma.visit.update({
      where: { id: visitId },
      data: { status: VisitStatus.CHECKED_IN, actualEntry: new Date() },
      include: { visitor: { select: { fullName: true } } },
    });
    const ts = new Date().toISOString();
    this.events.emit('visit.checked_in', {
      branchId: v.branchId,
      kind: 'visitor',
      actorId: v.visitorId,
      actorName: v.visitor.fullName,
      ts,
    });
    this.events.emit('headcount.invalidated', { branchId: v.branchId, reason: 'visit.checked_in', ts });
    return v;
  }

  async checkOutVisitor(user: JwtUser, visitId: string) {
    await this.ensureVisitInScope(user, visitId);
    const v = await this.prisma.visit.update({
      where: { id: visitId },
      data: { status: VisitStatus.CHECKED_OUT, actualExit: new Date() },
      include: { visitor: { select: { fullName: true } } },
    });
    const ts = new Date().toISOString();
    this.events.emit('visit.checked_out', {
      branchId: v.branchId,
      kind: 'visitor',
      actorId: v.visitorId,
      actorName: v.visitor.fullName,
      ts,
    });
    this.events.emit('headcount.invalidated', { branchId: v.branchId, reason: 'visit.checked_out', ts });
    return v;
  }

  async createVisitor(data: any) {
    return this.prisma.visitor.create({
      data: {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        company: data.company,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        faceData: parsePhotoBase64(data.photoBase64),
      },
    });
  }

  async getVisitors(user: JwtUser) {
    const where: any = isSuperAdmin(user)
      ? {}
      : { visits: { some: { branch: { organizationId: (user as any).orgId } } } };
    return this.prisma.visitor.findMany({
      where,
      orderBy: { id: 'desc' },
    });
  }

  async getLiveHeadcount(user: JwtUser, branchId?: string) {
    const orgFilter = visitScope(user);
    const visitWhere: any = { status: VisitStatus.CHECKED_IN, actualExit: null, ...orgFilter };
    const attendanceWhere: any = { checkOut: null };
    if (!isSuperAdmin(user)) {
      attendanceWhere.branch = { organizationId: (user as any).orgId };
    }
    if (branchId) {
      visitWhere.branchId = branchId;
      attendanceWhere.branchId = branchId;
    }

    const [activeVisits, workers] = await Promise.all([
      this.prisma.visit.findMany({
        where: visitWhere,
        select: { id: true, visitor: { select: { company: true } } },
      }),
      this.prisma.attendance.count({ where: attendanceWhere }),
    ]);

    const visitors = activeVisits.filter((v) => v.visitor.company).length;
    const employees = activeVisits.filter((v) => !v.visitor.company).length;

    return {
      total: visitors + employees + workers,
      visitors,
      workers,
      employees,
    };
  }

  /**
   * Live occupancy grouped by company — combines visitors (visitor.company
   * free text) with contract workers (contractor.companyName). Used by the
   * dashboard "By Company" widget so the operator can see who is inside
   * per contractor / company at a glance.
   */
  async getOccupancyByCompany(user: JwtUser, branchId?: string) {
    const orgFilter = visitScope(user);
    const visitWhere: any = { status: VisitStatus.CHECKED_IN, actualExit: null, ...orgFilter };
    const attendanceWhere: any = { checkOut: null };
    if (!isSuperAdmin(user)) {
      attendanceWhere.branch = { organizationId: (user as any).orgId };
    }
    if (branchId) {
      visitWhere.branchId = branchId;
      attendanceWhere.branchId = branchId;
    }

    const [visits, attendance] = await Promise.all([
      this.prisma.visit.findMany({
        where: visitWhere,
        select: { visitor: { select: { company: true } } },
      }),
      this.prisma.attendance.findMany({
        where: attendanceWhere,
        select: { worker: { select: { contractor: { select: { companyName: true } } } } },
      }),
    ]);

    const buckets = new Map<string, { company: string; visitors: number; workers: number }>();
    const bump = (key: string, kind: 'visitors' | 'workers') => {
      const k = key || 'Unspecified';
      const b = buckets.get(k) ?? { company: k, visitors: 0, workers: 0 };
      b[kind] += 1;
      buckets.set(k, b);
    };
    for (const v of visits) bump(v.visitor?.company ?? 'In-house / Employee', 'visitors');
    for (const a of attendance) bump(a.worker?.contractor?.companyName ?? 'In-house', 'workers');

    return Array.from(buckets.values())
      .map((b) => ({ ...b, total: b.visitors + b.workers }))
      .sort((a, b) => b.total - a.total);
  }
}
