import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  JwtUser,
  branchScope,
  contractorScope,
  isSuperAdmin,
  requireOrg,
  userScope,
  visitorScope,
  workerScope,
  attendanceScope,
} from '../../common/tenant';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Read helpers (used by form dropdowns) ----------------------
  listBranches(user: JwtUser) {
    return this.prisma.branch.findMany({
      where: branchScope(user),
      select: { id: true, name: true, location: true, organizationId: true },
      orderBy: { name: 'asc' },
    });
  }

  listHosts(user: JwtUser) {
    return this.prisma.user.findMany({
      where: { isActive: true, ...userScope(user) },
      select: { id: true, fullName: true, email: true, role: true, branchId: true },
      orderBy: { fullName: 'asc' },
    });
  }

  listUsers(user: JwtUser) {
    return this.prisma.user.findMany({
      where: userScope(user),
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        totpEnabled: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });
  }

  async setUserActive(user: JwtUser, id: string, isActive: boolean) {
    // Scope: can only edit users in your org
    if (!isSuperAdmin(user)) {
      const found = await this.prisma.user.findFirst({
        where: { id, ...userScope(user) },
        select: { id: true },
      });
      if (!found) throw new NotFoundException('User not found in your organization');
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, fullName: true, email: true, isActive: true },
    });
  }

  async createBranch(
    user: JwtUser,
    data: { name: string; location: string; organizationId?: string },
  ) {
    if (!data.name || !data.location) {
      throw new BadRequestException('name and location are required');
    }
    let orgId = data.organizationId;
    if (isSuperAdmin(user)) {
      if (!orgId) {
        const first = await this.prisma.organization.findFirst();
        if (!first) throw new BadRequestException('No organization exists yet');
        orgId = first.id;
      }
    } else {
      orgId = requireOrg(user);
    }
    return this.prisma.branch.create({
      data: {
        name: data.name.slice(0, 255),
        location: data.location.slice(0, 500),
        organizationId: orgId!,
      },
    });
  }

  listVisitors(user: JwtUser) {
    return this.prisma.visitor.findMany({
      where: visitorScope(user),
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        company: true,
        documentType: true,
        documentNumber: true,
        isBlacklisted: true,
        createdAt: true,
        _count: { select: { visits: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async setVisitorBlacklist(user: JwtUser, id: string, blacklist: boolean) {
    // Authorize: visitor must be reachable in user's org (or super admin)
    if (!isSuperAdmin(user)) {
      const v = await this.prisma.visitor.findFirst({
        where: { id, ...visitorScope(user) },
        select: { id: true },
      });
      if (!v) throw new NotFoundException('Visitor not found in your organization');
    }
    return this.prisma.visitor.update({
      where: { id },
      data: { isBlacklisted: blacklist },
      select: { id: true, fullName: true, isBlacklisted: true },
    });
  }

  listContractors(user: JwtUser) {
    return this.prisma.contractor.findMany({
      where: contractorScope(user),
      include: { _count: { select: { workers: true } } },
      orderBy: { companyName: 'asc' },
    });
  }

  listWorkers(user: JwtUser, contractorId?: string) {
    const where: any = workerScope(user);
    if (contractorId) where.contractorId = contractorId;
    return this.prisma.worker.findMany({
      where,
      include: { contractor: { select: { companyName: true } } },
      orderBy: { fullName: 'asc' },
    });
  }

  listAttendance(user: JwtUser, limit = 200) {
    return this.prisma.attendance.findMany({
      where: attendanceScope(user),
      take: limit,
      orderBy: { checkIn: 'desc' },
      include: { worker: { select: { fullName: true, skillCategory: true } } },
    });
  }

  /**
   * Rule-based anomaly detection. Not ML, but actually useful: flags
   * frequency spikes, after-hours entries, repeated rejections, expired
   * compliance attempts. Scoped to user's org.
   */
  async detectAnomalies(user: JwtUser) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const visitWhere = isSuperAdmin(user)
      ? {}
      : { branch: { organizationId: requireOrg(user) } };

    const anomalies: Array<{
      id: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      kind: string;
      title: string;
      detail: string;
      visitId?: string;
      visitorId?: string;
      occurredAt?: string;
    }> = [];

    // (1) Visitors with 3+ visits in last 24h
    const recent = await this.prisma.visit.findMany({
      where: { createdAt: { gte: last24h }, ...visitWhere },
      select: { id: true, visitorId: true, visitor: { select: { fullName: true, phone: true } } },
    });
    const perVisitor = new Map<string, { name: string; phone: string; count: number }>();
    for (const v of recent) {
      const cur = perVisitor.get(v.visitorId) || { name: v.visitor.fullName, phone: v.visitor.phone, count: 0 };
      cur.count += 1;
      perVisitor.set(v.visitorId, cur);
    }
    for (const [vid, info] of perVisitor) {
      if (info.count >= 3) {
        anomalies.push({
          id: `freq-${vid}`,
          severity: info.count >= 5 ? 'HIGH' : 'MEDIUM',
          kind: 'frequency',
          title: `${info.name} visited ${info.count}x in 24h`,
          detail: `Phone ${info.phone}. Unusual visit frequency.`,
          visitorId: vid,
        });
      }
    }

    // (2) After-hours check-ins (before 06:00 or after 22:00 local UTC)
    const afterHours = await this.prisma.visit.findMany({
      where: {
        actualEntry: { gte: last7d },
        ...visitWhere,
      },
      select: { id: true, actualEntry: true, visitor: { select: { fullName: true } } },
    });
    for (const v of afterHours) {
      if (!v.actualEntry) continue;
      const h = new Date(v.actualEntry).getUTCHours();
      if (h < 6 || h >= 22) {
        anomalies.push({
          id: `afterhours-${v.id}`,
          severity: 'MEDIUM',
          kind: 'after-hours',
          title: `${v.visitor.fullName} checked in at ${String(h).padStart(2, '0')}:00 UTC`,
          detail: 'Entry outside 06:00–22:00 window.',
          visitId: v.id,
          occurredAt: v.actualEntry.toISOString(),
        });
      }
    }

    // (3) Repeated rejections from same phone (>=2 in 7d)
    const rejected = await this.prisma.visit.findMany({
      where: {
        status: 'REJECTED',
        updatedAt: { gte: last7d },
        ...visitWhere,
      },
      select: { id: true, visitorId: true, visitor: { select: { fullName: true, phone: true } } },
    });
    const rejectCount = new Map<string, { name: string; phone: string; count: number }>();
    for (const v of rejected) {
      const cur = rejectCount.get(v.visitorId) || { name: v.visitor.fullName, phone: v.visitor.phone, count: 0 };
      cur.count += 1;
      rejectCount.set(v.visitorId, cur);
    }
    for (const [vid, info] of rejectCount) {
      if (info.count >= 2) {
        anomalies.push({
          id: `repeat-reject-${vid}`,
          severity: 'HIGH',
          kind: 'repeat-rejection',
          title: `${info.name} rejected ${info.count}x in 7d`,
          detail: `Phone ${info.phone}. Consider blacklisting.`,
          visitorId: vid,
        });
      }
    }

    // (4) Blacklisted visitor attempted entry (any blacklisted visitor with a visit in last 7d)
    const blacklistedAttempts = await this.prisma.visit.findMany({
      where: {
        createdAt: { gte: last7d },
        visitor: { isBlacklisted: true },
        ...visitWhere,
      },
      select: { id: true, visitor: { select: { fullName: true } }, createdAt: true },
    });
    for (const v of blacklistedAttempts) {
      anomalies.push({
        id: `blacklist-${v.id}`,
        severity: 'HIGH',
        kind: 'blacklist-attempt',
        title: `Blacklisted visitor ${v.visitor.fullName} created a visit`,
        detail: 'Gate will refuse entry, but the attempt was logged.',
        visitId: v.id,
        occurredAt: v.createdAt.toISOString(),
      });
    }

    // Sort: HIGH → MEDIUM → LOW
    const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    anomalies.sort((a, b) => rank[a.severity] - rank[b.severity]);

    return {
      generatedAt: now.toISOString(),
      total: anomalies.length,
      bySeverity: {
        HIGH: anomalies.filter((a) => a.severity === 'HIGH').length,
        MEDIUM: anomalies.filter((a) => a.severity === 'MEDIUM').length,
        LOW: anomalies.filter((a) => a.severity === 'LOW').length,
      },
      anomalies: anomalies.slice(0, 50),
    };
  }

  /**
   * Visits per hour-of-day × day-of-week heatmap over the last `days`.
   * Returns an array of { dow: 0..6 (Sun..Sat), hour: 0..23, count }.
   */
  async getHeatmap(user: JwtUser, days = 30) {
    const cap = Math.min(Math.max(days, 7), 90);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - cap);

    const visits = await this.prisma.visit.findMany({
      where: { createdAt: { gte: since }, ...(isSuperAdmin(user) ? {} : { branch: { organizationId: requireOrg(user) } }) },
      select: { createdAt: true },
    });

    const grid: Record<string, number> = {};
    for (const v of visits) {
      const d = new Date(v.createdAt);
      const dow = d.getUTCDay();
      const hour = d.getUTCHours();
      const key = `${dow}-${hour}`;
      grid[key] = (grid[key] ?? 0) + 1;
    }

    const out: Array<{ dow: number; hour: number; count: number }> = [];
    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        out.push({ dow, hour, count: grid[`${dow}-${hour}`] ?? 0 });
      }
    }
    return { days: cap, cells: out };
  }

  // Audit log — SUPER_ADMIN sees all; ORG_ADMIN sees entries by actors in their org.
  async listAuditLogs(user: JwtUser, limit = 200) {
    if (isSuperAdmin(user)) {
      return this.prisma.auditLog.findMany({ take: limit, orderBy: { createdAt: 'desc' } });
    }
    // Scope by actor — find user IDs in this org
    const orgUsers = await this.prisma.user.findMany({
      where: userScope(user),
      select: { id: true },
    });
    const ids = orgUsers.map((u) => u.id);
    return this.prisma.auditLog.findMany({
      where: { actorId: { in: ids } },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Write operations -------------------------------------------
  async createContractor(
    user: JwtUser,
    data: { organizationId?: string; companyName: string; gstNumber: string },
  ) {
    if (!data.companyName || !data.gstNumber) {
      throw new BadRequestException('companyName and gstNumber are required');
    }

    let orgId = data.organizationId;
    if (isSuperAdmin(user)) {
      if (!orgId) {
        const first = await this.prisma.organization.findFirst();
        if (!first) throw new BadRequestException('No organization exists yet');
        orgId = first.id;
      }
    } else {
      // Force own org regardless of payload
      orgId = requireOrg(user);
    }

    return this.prisma.contractor.create({
      data: {
        organizationId: orgId!,
        companyName: data.companyName,
        gstNumber: data.gstNumber,
      },
    });
  }

  async createWorker(
    user: JwtUser,
    data: {
      contractorId: string;
      fullName: string;
      phone: string;
      documentType: keyof typeof DocumentType;
      documentNumber: string;
      skillCategory: string;
      medicalExpiry: string;
      policeVerified?: boolean;
      pfNumber?: string;
      esicNumber?: string;
      hourlyRate?: number;
    },
  ) {
    const required = [
      'contractorId',
      'fullName',
      'phone',
      'documentNumber',
      'skillCategory',
      'medicalExpiry',
    ];
    for (const k of required) {
      if (!(data as any)[k]) throw new BadRequestException(`${k} is required`);
    }

    const contractor = await this.prisma.contractor.findUnique({
      where: { id: data.contractorId },
      select: { id: true, organizationId: true },
    });
    if (!contractor) throw new NotFoundException('Contractor not found');

    if (!isSuperAdmin(user) && contractor.organizationId !== requireOrg(user)) {
      throw new ForbiddenException('Contractor belongs to another organization');
    }

    return this.prisma.worker.create({
      data: {
        contractorId: data.contractorId,
        fullName: data.fullName,
        phone: data.phone,
        documentType: DocumentType[data.documentType] ?? DocumentType.AADHAAR,
        documentNumber: data.documentNumber,
        skillCategory: data.skillCategory,
        medicalExpiry: new Date(data.medicalExpiry),
        policeVerified: data.policeVerified ?? false,
        pfNumber: data.pfNumber?.slice(0, 50) || null,
        esicNumber: data.esicNumber?.slice(0, 50) || null,
        hourlyRate: typeof data.hourlyRate === 'number' && Number.isFinite(data.hourlyRate)
          ? data.hourlyRate
          : null,
        qrCodeToken: 'WK-' + require('crypto').randomBytes(8).toString('hex').toUpperCase(),
      },
    });
  }

  /**
   * Bulk-import workers from CSV text. Header expected (case-insensitive):
   *   contractorId, fullName, phone, documentNumber, skillCategory, medicalExpiry,
   *   [documentType], [policeVerified], [pfNumber], [esicNumber], [hourlyRate]
   * Returns per-row outcome.
   */
  async bulkImportWorkers(user: JwtUser, csv: string) {
    if (!csv || typeof csv !== 'string') {
      throw new BadRequestException('csv body required');
    }
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new BadRequestException('CSV needs a header row and at least one data row');
    }
    const splitCsv = (line: string) =>
      // simple split — quoted commas not supported; good enough for templates
      line.split(',').map((c) => c.trim());

    const header = splitCsv(lines[0]).map((h) => h.toLowerCase());
    const idx = (name: string) => header.indexOf(name.toLowerCase());

    const required = [
      'contractorid',
      'fullname',
      'phone',
      'documentnumber',
      'skillcategory',
      'medicalexpiry',
    ];
    for (const r of required) {
      if (idx(r) < 0) {
        throw new BadRequestException(`CSV missing required column: ${r}`);
      }
    }

    const results: Array<{ row: number; ok: boolean; id?: string; error?: string; fullName?: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsv(lines[i]);
      const get = (name: string) => cols[idx(name)];
      try {
        const created = await this.createWorker(user, {
          contractorId: get('contractorid'),
          fullName: get('fullname'),
          phone: get('phone'),
          documentType: ((idx('documenttype') >= 0 && get('documenttype')) || 'AADHAAR') as any,
          documentNumber: get('documentnumber'),
          skillCategory: get('skillcategory'),
          medicalExpiry: get('medicalexpiry'),
          policeVerified:
            idx('policeverified') >= 0
              ? ['true', '1', 'yes', 'y'].includes(get('policeverified').toLowerCase())
              : false,
          pfNumber: idx('pfnumber') >= 0 ? get('pfnumber') || undefined : undefined,
          esicNumber: idx('esicnumber') >= 0 ? get('esicnumber') || undefined : undefined,
          hourlyRate:
            idx('hourlyrate') >= 0 && get('hourlyrate')
              ? parseFloat(get('hourlyrate'))
              : undefined,
        });
        results.push({ row: i + 1, ok: true, id: created.id, fullName: created.fullName });
      } catch (e: any) {
        results.push({ row: i + 1, ok: false, error: e?.message ?? 'unknown error' });
      }
    }

    return {
      total: results.length,
      created: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  /**
   * Hours-worked + overtime report. For each worker with attendance in the
   * window: total hours, overtime hours (> 8 / day), estimated pay if
   * hourlyRate is set.
   */
  async workerHoursReport(user: JwtUser, days = 7) {
    const cap = Math.min(Math.max(days, 1), 90);
    const since = new Date(Date.now() - cap * 24 * 60 * 60 * 1000);

    const records = await this.prisma.attendance.findMany({
      where: {
        checkOut: { not: null },
        checkIn: { gte: since },
        ...attendanceScope(user),
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            skillCategory: true,
            hourlyRate: true,
            pfNumber: true,
            esicNumber: true,
            contractor: { select: { companyName: true } },
          },
        },
      },
    });

    // Aggregate per worker per day, then sum
    const perWorkerDay = new Map<string, { day: string; hours: number }[]>();
    const workers = new Map<string, any>();

    for (const r of records) {
      if (!r.checkOut) continue;
      const dayKey = r.checkIn.toISOString().slice(0, 10);
      const hours = Math.max(0, (r.checkOut.getTime() - r.checkIn.getTime()) / 3_600_000);
      const list = perWorkerDay.get(r.workerId) ?? [];
      const existing = list.find((d) => d.day === dayKey);
      if (existing) existing.hours += hours;
      else list.push({ day: dayKey, hours });
      perWorkerDay.set(r.workerId, list);
      workers.set(r.workerId, r.worker);
    }

    const rows: any[] = [];
    for (const [workerId, days] of perWorkerDay) {
      const w = workers.get(workerId);
      let total = 0;
      let overtime = 0;
      for (const d of days) {
        total += d.hours;
        if (d.hours > 8) overtime += d.hours - 8;
      }
      rows.push({
        workerId,
        fullName: w.fullName,
        contractor: w.contractor.companyName,
        skillCategory: w.skillCategory,
        pfNumber: w.pfNumber,
        esicNumber: w.esicNumber,
        hourlyRate: w.hourlyRate,
        daysWorked: days.length,
        totalHours: Number(total.toFixed(2)),
        overtimeHours: Number(overtime.toFixed(2)),
        estimatedPay:
          w.hourlyRate != null
            ? Number(((total - overtime) * w.hourlyRate + overtime * w.hourlyRate * 1.5).toFixed(2))
            : null,
      });
    }
    rows.sort((a, b) => b.totalHours - a.totalHours);
    return { windowDays: cap, rows };
  }

  async createHost(
    user: JwtUser,
    data: {
      branchId: string;
      email: string;
      password: string;
      fullName: string;
      role?: keyof typeof Role;
    },
  ) {
    if (!data.email || !data.password || !data.fullName || !data.branchId) {
      throw new BadRequestException('email, password, fullName, branchId required');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: data.branchId },
      select: { id: true, organizationId: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (!isSuperAdmin(user) && branch.organizationId !== requireOrg(user)) {
      throw new ForbiddenException('Branch belongs to another organization');
    }

    return this.prisma.user.create({
      data: {
        branchId: data.branchId,
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, 10),
        fullName: data.fullName,
        role: Role[data.role ?? 'EMPLOYEE'] ?? Role.EMPLOYEE,
      },
      select: { id: true, email: true, fullName: true, role: true, branchId: true },
    });
  }
}
