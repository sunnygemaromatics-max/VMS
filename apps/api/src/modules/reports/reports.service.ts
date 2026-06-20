import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  JwtUser,
  attendanceScope,
  branchScope,
  contractorScope,
  isSuperAdmin,
  requireOrg,
  userScope,
  visitScope,
} from '../../common/tenant';

// ───────────────────────────────────────────────────────────────────
// Reporting engine.
//
// Every report accepts a common filter (date range + optional branch /
// contractor) and an optional `groupBy` dimension. Aggregation is done
// in-memory over scoped Prisma reads — same approach as the rest of the
// codebase (admin.service worker-hours / heatmap) — so it stays portable
// across Postgres without raw SQL and respects multi-tenant scoping.
// ───────────────────────────────────────────────────────────────────

export interface ReportFilter {
  from?: string;
  to?: string;
  branchId?: string;
  contractorId?: string;
  groupBy?: string;
  /** Optional column projection — output rows keep only these keys, in order. */
  columns?: string[];
  /** When true, the service also computes the same query for the prior window and returns deltas. */
  compare?: boolean;
}

type Period = 'day' | 'week' | 'month' | 'year';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const OVERTIME_THRESHOLD_HOURS = 8;
const OVERTIME_MULTIPLIER = 1.5;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Date helpers ──────────────────────────────────────────────────

  /** Resolve a {from,to} filter into a concrete window. Defaults to last 30d. */
  private resolveRange(f: ReportFilter): { from: Date; to: Date } {
    const to = f.to ? new Date(f.to) : new Date();
    let from: Date;
    if (f.from) {
      from = new Date(f.from);
    } else {
      from = new Date(to.getTime() - 30 * DAY_MS);
    }
    if (Number.isNaN(from.getTime())) from = new Date(to.getTime() - 30 * DAY_MS);
    if (Number.isNaN(to.getTime())) return { from, to: new Date() };
    // Make `to` inclusive of the whole day when only a date was supplied
    if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  private isoWeek(d: Date): string {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  /** Bucket a date into a period label (UTC). */
  private periodKey(d: Date, period: Period): string {
    const dt = new Date(d);
    switch (period) {
      case 'year':
        return `${dt.getUTCFullYear()}`;
      case 'month':
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
      case 'week':
        return this.isoWeek(dt);
      case 'day':
      default:
        return dt.toISOString().slice(0, 10);
    }
  }

  private round(n: number, places = 2): number {
    const f = Math.pow(10, places);
    return Math.round(n * f) / f;
  }

  // ── Visit reporting ───────────────────────────────────────────────

  /**
   * Visit analytics grouped by a chosen dimension.
   * groupBy: month | week | day | year | branch | host | status | company | purpose
   */
  async visits(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'month';

    const where: any = { createdAt: { gte: from, lte: to }, ...visitScope(user) };
    if (f.branchId) where.branchId = f.branchId;

    const visits = await this.prisma.visit.findMany({
      where,
      select: {
        id: true,
        status: true,
        purpose: true,
        groupSize: true,
        vehicleNumber: true,
        createdAt: true,
        actualEntry: true,
        actualExit: true,
        visitorId: true,
        visitor: { select: { company: true } },
        host: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
    });

    const groups = new Map<string, any>();
    const ensure = (key: string) => {
      let g = groups.get(key);
      if (!g) {
        g = {
          group: key,
          total: 0,
          headcount: 0,
          pending: 0,
          approved: 0,
          checkedIn: 0,
          checkedOut: 0,
          rejected: 0,
          blacklisted: 0,
          withVehicle: 0,
          _visitors: new Set<string>(),
          _durations: [] as number[],
        };
        groups.set(key, g);
      }
      return g;
    };

    const keyFor = (v: (typeof visits)[number]): string => {
      switch (groupBy) {
        case 'branch':
          return v.branch?.name || '—';
        case 'host':
          return v.host?.fullName || '—';
        case 'status':
          return v.status;
        case 'company':
          return v.visitor?.company || '(none)';
        case 'purpose':
          return (v.purpose || '—').slice(0, 60);
        default:
          return this.periodKey(v.createdAt, groupBy as Period);
      }
    };

    for (const v of visits) {
      const g = ensure(keyFor(v));
      g.total += 1;
      g.headcount += v.groupSize || 1;
      g._visitors.add(v.visitorId);
      if (v.vehicleNumber) g.withVehicle += 1;
      switch (v.status) {
        case 'PENDING': g.pending += 1; break;
        case 'APPROVED': g.approved += 1; break;
        case 'CHECKED_IN': g.checkedIn += 1; break;
        case 'CHECKED_OUT': g.checkedOut += 1; break;
        case 'REJECTED': g.rejected += 1; break;
        case 'BLACKLISTED': g.blacklisted += 1; break;
      }
      if (v.actualEntry && v.actualExit) {
        const mins = (new Date(v.actualExit).getTime() - new Date(v.actualEntry).getTime()) / 60_000;
        if (mins > 0) g._durations.push(mins);
      }
    }

    const rows = [...groups.values()].map((g) => ({
      group: g.group,
      total: g.total,
      uniqueVisitors: g._visitors.size,
      headcount: g.headcount,
      pending: g.pending,
      approved: g.approved,
      checkedIn: g.checkedIn,
      checkedOut: g.checkedOut,
      rejected: g.rejected,
      blacklisted: g.blacklisted,
      withVehicle: g.withVehicle,
      avgDurationMin: g._durations.length
        ? this.round(g._durations.reduce((a: number, b: number) => a + b, 0) / g._durations.length)
        : null,
    }));

    this.sortRows(rows, groupBy);

    return {
      report: 'visits',
      groupBy,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        visits: visits.length,
        uniqueVisitors: new Set(visits.map((v) => v.visitorId)).size,
        checkedIn: visits.filter((v) => v.status === 'CHECKED_IN').length,
        rejected: visits.filter((v) => v.status === 'REJECTED').length,
      },
      rows,
    };
  }

  // ── Workforce / attendance reporting ──────────────────────────────

  /**
   * Worker attendance + hours + overtime + estimated pay, grouped.
   * groupBy: month | week | day | year | contractor | worker | branch | skill
   */
  async workforce(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'month';

    const where: any = { checkIn: { gte: from, lte: to }, ...attendanceScope(user) };
    if (f.branchId) where.branchId = f.branchId;
    if (f.contractorId) where.worker = { contractorId: f.contractorId };

    const records = await this.prisma.attendance.findMany({
      where,
      select: {
        workerId: true,
        branchId: true,
        checkIn: true,
        checkOut: true,
        worker: {
          select: {
            fullName: true,
            skillCategory: true,
            hourlyRate: true,
            contractor: { select: { companyName: true } },
          },
        },
        branch: { select: { name: true } },
      },
    });

    // Pre-aggregate to (group, worker, day) so overtime (>8h/worker/day) is correct.
    type Cell = { hours: number; rate: number | null };
    const cells = new Map<string, Cell>();
    const groupMeta = new Map<string, { workers: Set<string>; workerDays: Set<string> }>();

    const keyFor = (r: (typeof records)[number]): string => {
      switch (groupBy) {
        case 'contractor':
          return r.worker?.contractor?.companyName || '—';
        case 'worker':
          return r.worker?.fullName || '—';
        case 'branch':
          return r.branch?.name || '—';
        case 'skill':
          return r.worker?.skillCategory || '—';
        default:
          return this.periodKey(r.checkIn, groupBy as Period);
      }
    };

    for (const r of records) {
      const groupKey = keyFor(r);
      const day = r.checkIn.toISOString().slice(0, 10);
      const hours = r.checkOut
        ? Math.max(0, (r.checkOut.getTime() - r.checkIn.getTime()) / HOUR_MS)
        : 0;
      const cellKey = `${groupKey}|${r.workerId}|${day}`;
      const c = cells.get(cellKey) || { hours: 0, rate: r.worker?.hourlyRate ?? null };
      c.hours += hours;
      cells.set(cellKey, c);

      const meta = groupMeta.get(groupKey) || { workers: new Set<string>(), workerDays: new Set<string>() };
      meta.workers.add(r.workerId);
      meta.workerDays.add(`${r.workerId}|${day}`);
      groupMeta.set(groupKey, meta);
    }

    const agg = new Map<string, { totalHours: number; overtimeHours: number; estimatedPay: number; hasRate: boolean }>();
    for (const [cellKey, c] of cells) {
      const groupKey = cellKey.split('|')[0];
      const ot = Math.max(0, c.hours - OVERTIME_THRESHOLD_HOURS);
      const reg = c.hours - ot;
      const a = agg.get(groupKey) || { totalHours: 0, overtimeHours: 0, estimatedPay: 0, hasRate: false };
      a.totalHours += c.hours;
      a.overtimeHours += ot;
      if (c.rate != null) {
        a.estimatedPay += reg * c.rate + ot * c.rate * OVERTIME_MULTIPLIER;
        a.hasRate = true;
      }
      agg.set(groupKey, a);
    }

    const rows = [...agg.entries()].map(([group, a]) => {
      const meta = groupMeta.get(group)!;
      return {
        group,
        workers: meta.workers.size,
        shifts: meta.workerDays.size,
        totalHours: this.round(a.totalHours),
        overtimeHours: this.round(a.overtimeHours),
        avgHoursPerWorker: meta.workers.size ? this.round(a.totalHours / meta.workers.size) : 0,
        estimatedPay: a.hasRate ? this.round(a.estimatedPay) : null,
      };
    });

    this.sortRows(rows, groupBy);

    const totalHours = rows.reduce((s, r) => s + r.totalHours, 0);
    return {
      report: 'workforce',
      groupBy,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        records: records.length,
        uniqueWorkers: new Set(records.map((r) => r.workerId)).size,
        totalHours: this.round(totalHours),
        overtimeHours: this.round(rows.reduce((s, r) => s + r.overtimeHours, 0)),
        estimatedPay: this.round(rows.reduce((s, r) => s + (r.estimatedPay ?? 0), 0)),
      },
      rows,
    };
  }

  // ── Contractor-wise summary ───────────────────────────────────────

  async contractors(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);

    const contractors = await this.prisma.contractor.findMany({
      where: contractorScope(user),
      select: {
        id: true,
        companyName: true,
        gstNumber: true,
        complianceScore: true,
        createdAt: true,
        workers: {
          select: {
            id: true,
            isActive: true,
            policeVerified: true,
            medicalExpiry: true,
            hourlyRate: true,
          },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    // Pull attendance for the window once, scoped, keyed by worker.
    const attendance = await this.prisma.attendance.findMany({
      where: { checkIn: { gte: from, lte: to }, checkOut: { not: null }, ...attendanceScope(user) },
      select: { workerId: true, checkIn: true, checkOut: true, worker: { select: { contractorId: true, hourlyRate: true } } },
    });

    // (contractorId) -> per (worker,day) hours for overtime-correct pay
    const perContractorCells = new Map<string, Map<string, { hours: number; rate: number | null }>>();
    for (const a of attendance) {
      const cId = a.worker?.contractorId;
      if (!cId || !a.checkOut) continue;
      const day = a.checkIn.toISOString().slice(0, 10);
      const cells = perContractorCells.get(cId) || new Map();
      const cellKey = `${a.workerId}|${day}`;
      const c = cells.get(cellKey) || { hours: 0, rate: a.worker?.hourlyRate ?? null };
      c.hours += Math.max(0, (a.checkOut.getTime() - a.checkIn.getTime()) / HOUR_MS);
      cells.set(cellKey, c);
      perContractorCells.set(cId, cells);
    }

    const now = Date.now();
    const rows = contractors.map((c) => {
      const cells = perContractorCells.get(c.id);
      let totalHours = 0;
      let overtimeHours = 0;
      let estimatedPay = 0;
      let hasRate = false;
      const activeWorkerIds = new Set<string>();
      if (cells) {
        for (const [cellKey, cell] of cells) {
          activeWorkerIds.add(cellKey.split('|')[0]);
          const ot = Math.max(0, cell.hours - OVERTIME_THRESHOLD_HOURS);
          totalHours += cell.hours;
          overtimeHours += ot;
          if (cell.rate != null) {
            estimatedPay += (cell.hours - ot) * cell.rate + ot * cell.rate * OVERTIME_MULTIPLIER;
            hasRate = true;
          }
        }
      }
      const expiredMedical = c.workers.filter((w) => w.medicalExpiry && w.medicalExpiry.getTime() < now).length;
      const unverified = c.workers.filter((w) => !w.policeVerified).length;
      return {
        contractor: c.companyName,
        gstNumber: c.gstNumber,
        complianceScore: c.complianceScore,
        totalWorkers: c.workers.length,
        activeWorkers: c.workers.filter((w) => w.isActive).length,
        workersOnSite: activeWorkerIds.size,
        expiredMedical,
        policeUnverified: unverified,
        totalHours: this.round(totalHours),
        overtimeHours: this.round(overtimeHours),
        estimatedPay: hasRate ? this.round(estimatedPay) : null,
      };
    });

    return {
      report: 'contractors',
      groupBy: 'contractor',
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        contractors: rows.length,
        totalWorkers: rows.reduce((s, r) => s + r.totalWorkers, 0),
        totalHours: this.round(rows.reduce((s, r) => s + r.totalHours, 0)),
        estimatedPay: this.round(rows.reduce((s, r) => s + (r.estimatedPay ?? 0), 0)),
      },
      rows,
    };
  }

  // ── Branch / location-wise summary ────────────────────────────────

  async branches(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);

    const branches = await this.prisma.branch.findMany({
      where: branchScope(user),
      select: { id: true, name: true, location: true },
      orderBy: { name: 'asc' },
    });
    const branchIndex = new Map(branches.map((b) => [b.id, b]));

    const visits = await this.prisma.visit.findMany({
      where: { createdAt: { gte: from, lte: to }, ...visitScope(user) },
      select: { branchId: true, status: true, visitorId: true, groupSize: true },
    });

    const attendance = await this.prisma.attendance.findMany({
      where: { checkIn: { gte: from, lte: to }, ...attendanceScope(user) },
      select: { branchId: true, workerId: true, checkIn: true, checkOut: true },
    });

    type Acc = {
      visits: number;
      headcount: number;
      checkedIn: number;
      rejected: number;
      visitors: Set<string>;
      workers: Set<string>;
      workerHours: number;
    };
    const acc = new Map<string, Acc>();
    const ensure = (id: string) => {
      let a = acc.get(id);
      if (!a) {
        a = { visits: 0, headcount: 0, checkedIn: 0, rejected: 0, visitors: new Set(), workers: new Set(), workerHours: 0 };
        acc.set(id, a);
      }
      return a;
    };

    for (const v of visits) {
      const a = ensure(v.branchId);
      a.visits += 1;
      a.headcount += v.groupSize || 1;
      a.visitors.add(v.visitorId);
      if (v.status === 'CHECKED_IN') a.checkedIn += 1;
      if (v.status === 'REJECTED') a.rejected += 1;
    }
    for (const at of attendance) {
      const a = ensure(at.branchId);
      a.workers.add(at.workerId);
      if (at.checkOut) a.workerHours += Math.max(0, (at.checkOut.getTime() - at.checkIn.getTime()) / HOUR_MS);
    }

    const rows = [...acc.entries()]
      .filter(([id]) => branchIndex.has(id))
      .map(([id, a]) => {
        const b = branchIndex.get(id)!;
        return {
          branch: b.name,
          location: b.location,
          visits: a.visits,
          headcount: a.headcount,
          uniqueVisitors: a.visitors.size,
          checkedIn: a.checkedIn,
          rejected: a.rejected,
          workersOnSite: a.workers.size,
          workerHours: this.round(a.workerHours),
        };
      });

    // Include branches with zero activity too (full directory).
    for (const b of branches) {
      if (!acc.has(b.id)) {
        rows.push({
          branch: b.name,
          location: b.location,
          visits: 0,
          headcount: 0,
          uniqueVisitors: 0,
          checkedIn: 0,
          rejected: 0,
          workersOnSite: 0,
          workerHours: 0,
        });
      }
    }
    rows.sort((a, b) => b.visits - a.visits);

    return {
      report: 'branches',
      groupBy: 'branch',
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        branches: rows.length,
        visits: visits.length,
        workerHours: this.round(rows.reduce((s, r) => s + r.workerHours, 0)),
      },
      rows,
    };
  }

  // ── User / host activity ──────────────────────────────────────────

  async users(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);

    const where: any = { createdAt: { gte: from, lte: to }, ...visitScope(user) };
    if (f.branchId) where.branchId = f.branchId;

    const visits = await this.prisma.visit.findMany({
      where,
      select: {
        status: true,
        hostId: true,
        host: { select: { fullName: true, email: true, role: true, branch: { select: { name: true } } } },
      },
    });

    const groups = new Map<string, any>();
    for (const v of visits) {
      let g = groups.get(v.hostId);
      if (!g) {
        g = {
          host: v.host?.fullName || '—',
          email: v.host?.email || '—',
          role: v.host?.role || '—',
          branch: v.host?.branch?.name || '—',
          total: 0,
          pending: 0,
          approved: 0,
          checkedIn: 0,
          checkedOut: 0,
          rejected: 0,
        };
        groups.set(v.hostId, g);
      }
      g.total += 1;
      switch (v.status) {
        case 'PENDING': g.pending += 1; break;
        case 'APPROVED': g.approved += 1; break;
        case 'CHECKED_IN': g.checkedIn += 1; break;
        case 'CHECKED_OUT': g.checkedOut += 1; break;
        case 'REJECTED': g.rejected += 1; break;
      }
    }

    const rows = [...groups.values()].sort((a, b) => b.total - a.total);
    return {
      report: 'users',
      groupBy: 'host',
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: { hosts: rows.length, visits: visits.length },
      rows,
    };
  }

  // ── Material gate-pass movement ───────────────────────────────────

  async materials(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'month';

    const where: any = { createdAt: { gte: from, lte: to } };
    if (!isSuperAdmin(user)) where.visit = { branch: { organizationId: requireOrg(user) } };
    if (f.branchId) where.visit = { ...(where.visit || {}), branchId: f.branchId };

    const passes = await this.prisma.materialGatePass.findMany({
      where,
      select: {
        direction: true,
        quantity: true,
        createdAt: true,
        visit: { select: { branch: { select: { name: true } } } },
      },
    });

    const groups = new Map<string, any>();
    const keyFor = (p: (typeof passes)[number]) => {
      if (groupBy === 'branch') return p.visit?.branch?.name || '—';
      if (groupBy === 'direction') return p.direction;
      return this.periodKey(p.createdAt, groupBy as Period);
    };

    for (const p of passes) {
      const key = keyFor(p);
      let g = groups.get(key);
      if (!g) {
        g = { group: key, inCount: 0, inQty: 0, outCount: 0, outQty: 0 };
        groups.set(key, g);
      }
      if (p.direction === 'IN') {
        g.inCount += 1;
        g.inQty += p.quantity || 1;
      } else {
        g.outCount += 1;
        g.outQty += p.quantity || 1;
      }
    }

    const rows = [...groups.values()];
    this.sortRows(rows, groupBy);

    return {
      report: 'materials',
      groupBy,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        passes: passes.length,
        inQty: rows.reduce((s, r) => s + r.inQty, 0),
        outQty: rows.reduce((s, r) => s + r.outQty, 0),
      },
      rows,
    };
  }

  // ── Executive overview / KPIs ─────────────────────────────────────

  async overview(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const branchFilter = f.branchId ? { branchId: f.branchId } : {};

    const [visits, attendance, contractors, workerCount, activeWorkerCount] = await Promise.all([
      this.prisma.visit.findMany({
        where: { createdAt: { gte: from, lte: to }, ...visitScope(user), ...branchFilter },
        select: { status: true, visitorId: true, groupSize: true, actualEntry: true, actualExit: true },
      }),
      this.prisma.attendance.findMany({
        where: { checkIn: { gte: from, lte: to }, ...attendanceScope(user), ...branchFilter },
        select: { workerId: true, checkIn: true, checkOut: true },
      }),
      this.prisma.contractor.findMany({
        where: contractorScope(user),
        select: { complianceScore: true },
      }),
      this.prisma.worker.count({ where: isSuperAdmin(user) ? {} : { contractor: { organizationId: requireOrg(user) } } }),
      this.prisma.worker.count({
        where: { isActive: true, ...(isSuperAdmin(user) ? {} : { contractor: { organizationId: requireOrg(user) } }) },
      }),
    ]);

    const durations = visits
      .filter((v) => v.actualEntry && v.actualExit)
      .map((v) => (new Date(v.actualExit!).getTime() - new Date(v.actualEntry!).getTime()) / 60_000)
      .filter((m) => m > 0);

    let workerHours = 0;
    for (const a of attendance) {
      if (a.checkOut) workerHours += Math.max(0, (a.checkOut.getTime() - a.checkIn.getTime()) / HOUR_MS);
    }

    const avgCompliance = contractors.length
      ? this.round(contractors.reduce((s, c) => s + c.complianceScore, 0) / contractors.length, 1)
      : null;

    const kpis = {
      totalVisits: visits.length,
      uniqueVisitors: new Set(visits.map((v) => v.visitorId)).size,
      totalHeadcount: visits.reduce((s, v) => s + (v.groupSize || 1), 0),
      checkedInVisits: visits.filter((v) => v.status === 'CHECKED_IN').length,
      completedVisits: visits.filter((v) => v.status === 'CHECKED_OUT').length,
      rejectedVisits: visits.filter((v) => v.status === 'REJECTED').length,
      avgVisitDurationMin: durations.length
        ? this.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null,
      attendanceRecords: attendance.length,
      uniqueWorkersOnSite: new Set(attendance.map((a) => a.workerId)).size,
      totalWorkerHours: this.round(workerHours),
      contractors: contractors.length,
      totalWorkers: workerCount,
      activeWorkers: activeWorkerCount,
      avgComplianceScore: avgCompliance,
    };
    return {
      report: 'overview',
      range: { from: from.toISOString(), to: to.toISOString() },
      kpis,
      // Aliased for runCompared() so it can compute period deltas uniformly.
      totals: kpis,
      rows: [] as any[],
    };
  }

  // ── Executive dashboard ────────────────────────────────────────────

  /**
   * Single-shot leadership view: KPIs, top performers, daily trends and
   * risk indicators. Designed for the /executive page so the C-suite can
   * open one URL and have a complete read.
   */
  async executive(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const branchFilter = f.branchId ? { branchId: f.branchId } : {};

    const [
      visits,
      attendance,
      contractors,
      workerCount,
      activeWorkerCount,
      incidents,
      branches,
    ] = await Promise.all([
      this.prisma.visit.findMany({
        where: { createdAt: { gte: from, lte: to }, ...visitScope(user), ...branchFilter },
        select: {
          status: true,
          visitorId: true,
          groupSize: true,
          createdAt: true,
          actualEntry: true,
          actualExit: true,
          visitor: { select: { company: true } },
          host: { select: { fullName: true, branch: { select: { name: true } } } },
          branch: { select: { name: true } },
        },
      }),
      this.prisma.attendance.findMany({
        where: { checkIn: { gte: from, lte: to }, ...attendanceScope(user), ...branchFilter },
        select: {
          workerId: true,
          checkIn: true,
          checkOut: true,
          worker: { select: { contractor: { select: { id: true, companyName: true, complianceScore: true } } } },
        },
      }),
      this.prisma.contractor.findMany({
        where: contractorScope(user),
        select: {
          id: true,
          companyName: true,
          complianceScore: true,
          workers: {
            select: { id: true, isActive: true, policeVerified: true, medicalExpiry: true },
          },
        },
      }),
      this.prisma.worker.count({
        where: isSuperAdmin(user) ? {} : { contractor: { organizationId: requireOrg(user) } },
      }),
      this.prisma.worker.count({
        where: { isActive: true, ...(isSuperAdmin(user) ? {} : { contractor: { organizationId: requireOrg(user) } }) },
      }),
      this.prisma.incident.findMany({
        where: {
          openedAt: { gte: from, lte: to },
          ...(isSuperAdmin(user) ? {} : { orgId: requireOrg(user) }),
          ...(f.branchId ? { branchId: f.branchId } : {}),
        },
        select: {
          status: true,
          severity: true,
          openedAt: true,
          closedAt: true,
        },
      }),
      this.prisma.branch.findMany({
        where: isSuperAdmin(user) ? {} : { organizationId: requireOrg(user) },
        select: { id: true, name: true, location: true },
      }),
    ]);

    // KPIs
    const durations = visits
      .filter((v) => v.actualEntry && v.actualExit)
      .map((v) => (v.actualExit!.getTime() - v.actualEntry!.getTime()) / 60_000)
      .filter((m) => m > 0);
    let workerHours = 0;
    for (const a of attendance) {
      if (a.checkOut) workerHours += Math.max(0, (a.checkOut.getTime() - a.checkIn.getTime()) / HOUR_MS);
    }
    const avgCompliance = contractors.length
      ? this.round(contractors.reduce((s, c) => s + c.complianceScore, 0) / contractors.length, 1)
      : 0;
    const openIncidents = incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length;

    const kpis = {
      totalVisits: visits.length,
      uniqueVisitors: new Set(visits.map((v) => v.visitorId)).size,
      totalHeadcount: visits.reduce((s, v) => s + (v.groupSize || 1), 0),
      checkedInVisits: visits.filter((v) => v.status === 'CHECKED_IN').length,
      rejectedVisits: visits.filter((v) => v.status === 'REJECTED').length,
      avgVisitDurationMin: durations.length
        ? this.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      totalWorkerHours: this.round(workerHours),
      uniqueWorkersOnSite: new Set(attendance.map((a) => a.workerId)).size,
      contractors: contractors.length,
      totalWorkers: workerCount,
      activeWorkers: activeWorkerCount,
      avgComplianceScore: avgCompliance,
      openIncidents,
    };

    // Top hosts (by visits hosted)
    const hostMap = new Map<string, { name: string; branch: string; total: number }>();
    for (const v of visits) {
      const key = v.host?.fullName || '—';
      const entry = hostMap.get(key) || { name: key, branch: v.host?.branch?.name || '—', total: 0 };
      entry.total += 1;
      hostMap.set(key, entry);
    }
    const topHosts = [...hostMap.values()].sort((a, b) => b.total - a.total).slice(0, 5);

    // Top contractors (by hours, with on-site count)
    const ctMap = new Map<string, { name: string; hours: number; onSite: Set<string>; complianceScore: number }>();
    for (const a of attendance) {
      const c = a.worker?.contractor;
      if (!c) continue;
      const entry = ctMap.get(c.id) || { name: c.companyName, hours: 0, onSite: new Set(), complianceScore: c.complianceScore };
      if (a.checkOut) entry.hours += Math.max(0, (a.checkOut.getTime() - a.checkIn.getTime()) / HOUR_MS);
      entry.onSite.add(a.workerId);
      ctMap.set(c.id, entry);
    }
    const topContractors = [...ctMap.values()]
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)
      .map((c) => ({
        name: c.name,
        hours: this.round(c.hours),
        workersOnSite: c.onSite.size,
        complianceScore: c.complianceScore,
      }));

    // Top visitor companies
    const companyMap = new Map<string, number>();
    for (const v of visits) {
      const k = v.visitor?.company?.trim();
      if (!k) continue;
      companyMap.set(k, (companyMap.get(k) || 0) + 1);
    }
    const topCompanies = [...companyMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, visits]) => ({ name, visits }));

    // Top branches (by visits + worker hours)
    const branchMap = new Map<string, { name: string; visits: number; workerHours: number }>();
    for (const b of branches) branchMap.set(b.name, { name: b.name, visits: 0, workerHours: 0 });
    for (const v of visits) {
      const k = v.branch?.name;
      if (!k) continue;
      const entry = branchMap.get(k) || { name: k, visits: 0, workerHours: 0 };
      entry.visits += 1;
      branchMap.set(k, entry);
    }
    const topBranches = [...branchMap.values()].sort((a, b) => b.visits - a.visits).slice(0, 5);

    // Daily visits trend
    const dailyMap = new Map<string, { date: string; visits: number; workerHours: number }>();
    for (const v of visits) {
      const k = this.periodKey(v.createdAt, 'day');
      const e = dailyMap.get(k) || { date: k, visits: 0, workerHours: 0 };
      e.visits += 1;
      dailyMap.set(k, e);
    }
    for (const a of attendance) {
      const k = this.periodKey(a.checkIn, 'day');
      const e = dailyMap.get(k) || { date: k, visits: 0, workerHours: 0 };
      if (a.checkOut) e.workerHours += Math.max(0, (a.checkOut.getTime() - a.checkIn.getTime()) / HOUR_MS);
      dailyMap.set(k, e);
    }
    const trend = [...dailyMap.values()]
      .map((d) => ({ ...d, workerHours: this.round(d.workerHours) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Incident breakdown
    const incidentsBySeverity: Record<string, number> = { sev1: 0, sev2: 0, sev3: 0, sev4: 0, sev5: 0 };
    const incidentsByStatus: Record<string, number> = { open: 0, investigating: 0, resolved: 0, false_positive: 0 };
    for (const i of incidents) {
      const sk = `sev${Math.min(5, Math.max(1, i.severity || 1))}`;
      incidentsBySeverity[sk] = (incidentsBySeverity[sk] || 0) + 1;
      incidentsByStatus[i.status] = (incidentsByStatus[i.status] || 0) + 1;
    }

    // Risk indicators
    const now = Date.now();
    const SEVEN_DAYS = 7 * DAY_MS;
    const allWorkers = contractors.flatMap((c) => c.workers);
    const risk = {
      expiredMedicals: allWorkers.filter((w) => w.medicalExpiry && w.medicalExpiry.getTime() < now).length,
      policeUnverified: allWorkers.filter((w) => !w.policeVerified).length,
      openIncidentsAged: incidents.filter(
        (i) => (i.status === 'open' || i.status === 'investigating') && now - i.openedAt.getTime() > SEVEN_DAYS,
      ).length,
      contractorsBelowCompliance: contractors.filter((c) => c.complianceScore < 70).length,
    };

    return {
      report: 'executive',
      range: { from: from.toISOString(), to: to.toISOString() },
      kpis,
      totals: kpis, // alias so runCompared can produce deltas uniformly
      rows: trend as any[], // rows = daily trend
      topHosts,
      topContractors,
      topCompanies,
      topBranches,
      incidentsBySeverity,
      incidentsByStatus,
      risk,
    };
  }

  // ── Drill-down: raw records behind one grouped row ────────────────

  /** Convert a time-bucket label back into an absolute [from,to] window. */
  private bucketSubRange(groupBy: string, value: string): { from: Date; to: Date } | null {
    try {
      if (groupBy === 'year' && /^\d{4}$/.test(value)) {
        return {
          from: new Date(Date.UTC(+value, 0, 1)),
          to: new Date(Date.UTC(+value, 11, 31, 23, 59, 59, 999)),
        };
      }
      if (groupBy === 'month' && /^\d{4}-\d{2}$/.test(value)) {
        const [y, m] = value.split('-').map(Number);
        return {
          from: new Date(Date.UTC(y, m - 1, 1)),
          to: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
        };
      }
      if (groupBy === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const from = new Date(`${value}T00:00:00.000Z`);
        const to = new Date(`${value}T23:59:59.999Z`);
        return { from, to };
      }
      if (groupBy === 'week' && /^\d{4}-W\d{2}$/.test(value)) {
        const [y, w] = value.split('-W').map(Number);
        // ISO week: week 1 contains the first Thursday.
        const jan4 = new Date(Date.UTC(y, 0, 4));
        const day = jan4.getUTCDay() || 7;
        const week1Mon = new Date(jan4);
        week1Mon.setUTCDate(jan4.getUTCDate() - day + 1);
        const from = new Date(week1Mon);
        from.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7);
        const to = new Date(from);
        to.setUTCDate(from.getUTCDate() + 6);
        to.setUTCHours(23, 59, 59, 999);
        return { from, to };
      }
    } catch {
      /* fallthrough */
    }
    return null;
  }

  private isTimeGroup(groupBy: string) {
    return ['day', 'week', 'month', 'year'].includes(groupBy);
  }

  /**
   * Return the underlying records for a single grouped row (the value the
   * user clicked). Capped at 500 rows — exports use the grouped endpoints.
   */
  async detail(user: JwtUser, report: string, f: ReportFilter, value: string) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'month';
    const sub = this.isTimeGroup(groupBy) ? this.bucketSubRange(groupBy, value) : null;
    const winFrom = sub ? new Date(Math.max(from.getTime(), sub.from.getTime())) : from;
    const winTo = sub ? new Date(Math.min(to.getTime(), sub.to.getTime())) : to;
    const TAKE = 500;

    if (report === 'visits' || report === 'users' || report === 'branches') {
      const where: any = { createdAt: { gte: winFrom, lte: winTo }, ...visitScope(user) };
      if (f.branchId) where.branchId = f.branchId;
      if (!this.isTimeGroup(groupBy)) {
        if (groupBy === 'branch' || report === 'branches') where.branch = { name: value };
        else if (groupBy === 'host' || report === 'users') where.host = { fullName: value };
        else if (groupBy === 'status') where.status = value;
        else if (groupBy === 'company') where.visitor = value === '(none)' ? { company: null } : { company: value };
        else if (groupBy === 'purpose') where.purpose = { startsWith: value.slice(0, 40) };
      }
      const rows = await this.prisma.visit.findMany({
        where,
        take: TAKE,
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          status: true,
          purpose: true,
          actualEntry: true,
          actualExit: true,
          vehicleNumber: true,
          visitor: { select: { fullName: true, phone: true, company: true } },
          host: { select: { fullName: true } },
          branch: { select: { name: true } },
        },
      });
      return {
        report,
        value,
        count: rows.length,
        rows: rows.map((v) => ({
          date: v.createdAt.toISOString().slice(0, 16).replace('T', ' '),
          visitor: v.visitor?.fullName ?? '—',
          phone: v.visitor?.phone ?? '—',
          company: v.visitor?.company ?? '—',
          host: v.host?.fullName ?? '—',
          branch: v.branch?.name ?? '—',
          status: v.status,
          purpose: v.purpose,
          vehicle: v.vehicleNumber ?? '—',
        })),
      };
    }

    if (report === 'workforce' || report === 'contractors') {
      const where: any = { checkIn: { gte: winFrom, lte: winTo }, ...attendanceScope(user) };
      if (f.branchId) where.branchId = f.branchId;
      const workerWhere: any = {};
      if (f.contractorId) workerWhere.contractorId = f.contractorId;
      if (report === 'contractors') workerWhere.contractor = { companyName: value };
      else if (!this.isTimeGroup(groupBy)) {
        if (groupBy === 'contractor') workerWhere.contractor = { companyName: value };
        else if (groupBy === 'worker') workerWhere.fullName = value;
        else if (groupBy === 'skill') workerWhere.skillCategory = value;
        else if (groupBy === 'branch') where.branch = { name: value };
      }
      if (Object.keys(workerWhere).length) where.worker = workerWhere;

      const rows = await this.prisma.attendance.findMany({
        where,
        take: TAKE,
        orderBy: { checkIn: 'desc' },
        select: {
          checkIn: true,
          checkOut: true,
          worker: {
            select: { fullName: true, skillCategory: true, contractor: { select: { companyName: true } } },
          },
          branch: { select: { name: true } },
        },
      });
      return {
        report,
        value,
        count: rows.length,
        rows: rows.map((a) => ({
          checkIn: a.checkIn.toISOString().slice(0, 16).replace('T', ' '),
          checkOut: a.checkOut ? a.checkOut.toISOString().slice(0, 16).replace('T', ' ') : '—',
          hours: a.checkOut ? this.round(Math.max(0, (a.checkOut.getTime() - a.checkIn.getTime()) / HOUR_MS)) : null,
          worker: a.worker?.fullName ?? '—',
          contractor: a.worker?.contractor?.companyName ?? '—',
          skill: a.worker?.skillCategory ?? '—',
          branch: a.branch?.name ?? '—',
        })),
      };
    }

    if (report === 'materials') {
      const where: any = { createdAt: { gte: winFrom, lte: winTo } };
      if (!isSuperAdmin(user)) where.visit = { branch: { organizationId: requireOrg(user) } };
      if (f.branchId) where.visit = { ...(where.visit || {}), branchId: f.branchId };
      if (groupBy === 'direction') where.direction = value;
      if (groupBy === 'branch') where.visit = { ...(where.visit || {}), branch: { name: value } };
      const rows = await this.prisma.materialGatePass.findMany({
        where,
        take: TAKE,
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          direction: true,
          description: true,
          quantity: true,
          serialNumber: true,
          recordedBy: true,
          visit: { select: { branch: { select: { name: true } }, visitor: { select: { fullName: true } } } },
        },
      });
      return {
        report,
        value,
        count: rows.length,
        rows: rows.map((p) => ({
          date: p.createdAt.toISOString().slice(0, 16).replace('T', ' '),
          direction: p.direction,
          description: p.description,
          quantity: p.quantity,
          serial: p.serialNumber ?? '—',
          branch: p.visit?.branch?.name ?? '—',
          visitor: p.visit?.visitor?.fullName ?? '—',
          recordedBy: p.recordedBy ?? '—',
        })),
      };
    }

    return { report, value, count: 0, rows: [] };
  }

  // ── Incident reporting ────────────────────────────────────────────

  async incidents(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'month';

    const where: any = {
      openedAt: { gte: from, lte: to },
      ...(isSuperAdmin(user) ? {} : { orgId: requireOrg(user) }),
    };
    if (f.branchId) where.branchId = f.branchId;

    const items = await this.prisma.incident.findMany({
      where,
      select: {
        id: true,
        kind: true,
        severity: true,
        status: true,
        title: true,
        openedAt: true,
        closedAt: true,
        branchId: true,
      },
    });

    const branches = await this.prisma.branch.findMany({
      where: isSuperAdmin(user) ? {} : { organizationId: requireOrg(user) },
      select: { id: true, name: true },
    });
    const branchName = new Map(branches.map((b) => [b.id, b.name]));

    const keyFor = (i: (typeof items)[number]) => {
      switch (groupBy) {
        case 'branch': return i.branchId ? (branchName.get(i.branchId) || '—') : '—';
        case 'kind': return i.kind || '—';
        case 'status': return i.status || '—';
        case 'severity': return `Sev ${i.severity}`;
        default: return this.periodKey(i.openedAt, groupBy as Period);
      }
    };

    const groups = new Map<string, any>();
    for (const i of items) {
      const k = keyFor(i);
      let g = groups.get(k);
      if (!g) {
        g = { group: k, total: 0, open: 0, investigating: 0, resolved: 0, falsePositive: 0, avgSeverity: 0, _sevSum: 0 };
        groups.set(k, g);
      }
      g.total += 1;
      g._sevSum += i.severity || 0;
      if (i.status === 'open') g.open += 1;
      else if (i.status === 'investigating') g.investigating += 1;
      else if (i.status === 'resolved') g.resolved += 1;
      else if (i.status === 'false_positive') g.falsePositive += 1;
    }
    const rows = [...groups.values()].map((g) => ({
      group: g.group,
      total: g.total,
      open: g.open,
      investigating: g.investigating,
      resolved: g.resolved,
      falsePositive: g.falsePositive,
      avgSeverity: g.total ? this.round(g._sevSum / g.total, 1) : 0,
    }));
    this.sortRows(rows, groupBy);

    return {
      report: 'incidents',
      groupBy,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        incidents: items.length,
        open: items.filter((i) => i.status === 'open').length,
        resolved: items.filter((i) => i.status === 'resolved').length,
        avgSeverity: items.length ? this.round(items.reduce((s, i) => s + (i.severity || 0), 0) / items.length, 1) : 0,
      },
      rows,
    };
  }

  // ── Audit reporting ───────────────────────────────────────────────

  async audit(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'day';

    const logs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        // AuditLog rows aren't org-scoped; SUPER_ADMIN only sees them.
        ...(isSuperAdmin(user) ? {} : { actorRole: { not: 'SUPER_ADMIN' } }),
      },
      select: {
        actorEmail: true,
        actorRole: true,
        method: true,
        path: true,
        status: true,
        durationMs: true,
        ipAddress: true,
        createdAt: true,
      },
      take: 50_000,
    });

    const keyFor = (l: (typeof logs)[number]) => {
      switch (groupBy) {
        case 'actor': return l.actorEmail || 'anonymous';
        case 'role': return l.actorRole || '—';
        case 'path': return l.path.slice(0, 80);
        case 'method': return l.method;
        case 'status':
          return l.status >= 500 ? '5xx error' :
                 l.status >= 400 ? '4xx error' :
                 l.status >= 300 ? '3xx redirect' : '2xx ok';
        default: return this.periodKey(l.createdAt, groupBy as Period);
      }
    };

    const groups = new Map<string, any>();
    for (const l of logs) {
      const k = keyFor(l);
      let g = groups.get(k);
      if (!g) {
        g = { group: k, requests: 0, errors: 0, p50: 0, p95: 0, _durations: [] as number[] };
        groups.set(k, g);
      }
      g.requests += 1;
      if (l.status >= 400) g.errors += 1;
      g._durations.push(l.durationMs);
    }
    const pct = (a: number[], p: number) => {
      if (!a.length) return 0;
      const s = [...a].sort((x, y) => x - y);
      return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
    };
    const rows = [...groups.values()].map((g) => ({
      group: g.group,
      requests: g.requests,
      errors: g.errors,
      errorRate: g.requests ? this.round((g.errors / g.requests) * 100, 1) : 0,
      p50Ms: pct(g._durations, 50),
      p95Ms: pct(g._durations, 95),
    }));
    this.sortRows(rows, groupBy);

    return {
      report: 'audit',
      groupBy,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        requests: logs.length,
        errors: logs.filter((l) => l.status >= 400).length,
        uniqueActors: new Set(logs.map((l) => l.actorEmail).filter(Boolean)).size,
      },
      rows,
    };
  }

  // ── Vehicle reporting ─────────────────────────────────────────────

  async vehicles(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'month';

    const where: any = {
      createdAt: { gte: from, lte: to },
      vehicleNumber: { not: null },
      ...visitScope(user),
    };
    if (f.branchId) where.branchId = f.branchId;

    const visits = await this.prisma.visit.findMany({
      where,
      select: {
        vehicleNumber: true,
        createdAt: true,
        actualEntry: true,
        actualExit: true,
        status: true,
        visitor: { select: { fullName: true, company: true } },
        branch: { select: { name: true } },
      },
    });

    const keyFor = (v: (typeof visits)[number]) => {
      switch (groupBy) {
        case 'branch': return v.branch?.name || '—';
        case 'vehicle': return v.vehicleNumber || '—';
        case 'company': return v.visitor?.company || '(none)';
        case 'status': return v.status;
        default: return this.periodKey(v.createdAt, groupBy as Period);
      }
    };

    const groups = new Map<string, any>();
    for (const v of visits) {
      const k = keyFor(v);
      let g = groups.get(k);
      if (!g) {
        g = { group: k, vehicles: 0, _plates: new Set<string>(), checkedIn: 0, completed: 0 };
        groups.set(k, g);
      }
      g.vehicles += 1;
      if (v.vehicleNumber) g._plates.add(v.vehicleNumber);
      if (v.status === 'CHECKED_IN') g.checkedIn += 1;
      if (v.status === 'CHECKED_OUT') g.completed += 1;
    }
    const rows = [...groups.values()].map((g) => ({
      group: g.group,
      vehicles: g.vehicles,
      uniquePlates: g._plates.size,
      checkedIn: g.checkedIn,
      completed: g.completed,
    }));
    this.sortRows(rows, groupBy);

    return {
      report: 'vehicles',
      groupBy,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        records: visits.length,
        uniquePlates: new Set(visits.map((v) => v.vehicleNumber).filter(Boolean)).size,
      },
      rows,
    };
  }

  // ── Gate activity (composite: visit + attendance) ─────────────────

  async gateActivity(user: JwtUser, f: ReportFilter) {
    const { from, to } = this.resolveRange(f);
    const groupBy = f.groupBy || 'day';

    const branchFilter = f.branchId ? { branchId: f.branchId } : {};

    const [visits, attendance] = await Promise.all([
      this.prisma.visit.findMany({
        where: {
          actualEntry: { gte: from, lte: to },
          ...visitScope(user),
          ...branchFilter,
        },
        select: { actualEntry: true, actualExit: true, branch: { select: { name: true } } },
      }),
      this.prisma.attendance.findMany({
        where: { checkIn: { gte: from, lte: to }, ...attendanceScope(user), ...branchFilter },
        select: { checkIn: true, checkOut: true, branch: { select: { name: true } } },
      }),
    ]);

    type Cell = {
      visitorEntries: number;
      visitorExits: number;
      workerEntries: number;
      workerExits: number;
      /** For heatmap rows only — day-of-week (0=Sun) and hour 0..23. */
      dow?: number;
      hour?: number;
    };
    const groups = new Map<string, Cell>();
    const ensure = (k: string, init?: Partial<Cell>) => {
      let g = groups.get(k);
      if (!g) {
        g = { visitorEntries: 0, visitorExits: 0, workerEntries: 0, workerExits: 0, ...init };
        groups.set(k, g);
      }
      return g;
    };
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const keyFor = (when: Date, branch: string | undefined) => {
      if (groupBy === 'branch') return { key: branch || '—' };
      if (groupBy === 'hour') return { key: `${String(when.getUTCHours()).padStart(2, '0')}:00` };
      if (groupBy === 'heatmap') {
        const dow = when.getUTCDay();
        const hour = when.getUTCHours();
        return {
          key: `${DOW[dow]} ${String(hour).padStart(2, '0')}:00`,
          init: { dow, hour },
        };
      }
      return { key: this.periodKey(when, groupBy as Period) };
    };

    for (const v of visits) {
      if (!v.actualEntry) continue;
      const { key, init } = keyFor(v.actualEntry, v.branch?.name);
      const g = ensure(key, init);
      g.visitorEntries += 1;
      if (v.actualExit) g.visitorExits += 1;
    }
    for (const a of attendance) {
      const { key, init } = keyFor(a.checkIn, a.branch?.name);
      const g = ensure(key, init);
      g.workerEntries += 1;
      if (a.checkOut) g.workerExits += 1;
    }

    const rows = [...groups.entries()].map(([group, c]) => ({
      group,
      ...(groupBy === 'heatmap' ? { dow: c.dow, hour: c.hour } : {}),
      visitorEntries: c.visitorEntries,
      visitorExits: c.visitorExits,
      workerEntries: c.workerEntries,
      workerExits: c.workerExits,
      totalEntries: c.visitorEntries + c.workerEntries,
    }));
    if (groupBy === 'heatmap') {
      rows.sort((a, b) => (a.dow! - b.dow!) || (a.hour! - b.hour!));
    } else {
      this.sortRows(rows, groupBy === 'hour' ? 'day' : groupBy);
    }

    return {
      report: 'gate-activity',
      groupBy,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        visitorEntries: visits.length,
        workerEntries: attendance.length,
        totalEntries: visits.length + attendance.length,
      },
      rows,
    };
  }

  // ── Catalog: drives the left-rail navigation in the web client ────

  catalog() {
    return {
      sections: [
        {
          key: 'visitor-ops',
          label: 'Visitor operations',
          reports: [
            { key: 'visits', label: 'Visits', description: 'Volume, status mix, unique visitors, dwell time.', icon: 'Users' },
            { key: 'gate-activity', label: 'Gate activity', description: 'Entries / exits split by visitors and workers.', icon: 'DoorOpen' },
            { key: 'vehicles', label: 'Vehicles', description: 'Vehicle traffic by plate, branch and company.', icon: 'Car' },
            { key: 'materials', label: 'Material movement', description: 'Inbound / outbound gate-pass quantities.', icon: 'Package' },
          ],
        },
        {
          key: 'workforce',
          label: 'Workforce',
          reports: [
            { key: 'workforce', label: 'Workforce hours', description: 'Attendance, hours, overtime, estimated pay.', icon: 'HardHat' },
            { key: 'contractors', label: 'Contractors', description: 'Per-contractor compliance, hours and pay.', icon: 'Building2' },
            { key: 'users', label: 'Hosts / users', description: 'Visits hosted per employee with outcomes.', icon: 'UserCog' },
          ],
        },
        {
          key: 'security',
          label: 'Security & compliance',
          reports: [
            { key: 'incidents', label: 'Incidents', description: 'Security incidents grouped by severity, kind or status.', icon: 'ShieldAlert' },
            { key: 'audit', label: 'API audit', description: 'API request volume, error rates and latency.', icon: 'ScrollText' },
          ],
        },
        {
          key: 'org',
          label: 'Organization',
          reports: [
            { key: 'branches', label: 'Branches / locations', description: 'Per-location footfall and worker hours.', icon: 'Building2' },
          ],
        },
      ],
    };
  }

  /** Render any grouped report to a flat row array (for server-side export/email). */
  async renderRows(user: JwtUser, report: string, f: ReportFilter): Promise<{ title: string; rows: any[] }> {
    let res: any;
    switch (report) {
      case 'visits': res = await this.visits(user, f); break;
      case 'workforce': res = await this.workforce(user, f); break;
      case 'contractors': res = await this.contractors(user, f); break;
      case 'branches': res = await this.branches(user, f); break;
      case 'users': res = await this.users(user, f); break;
      case 'materials': res = await this.materials(user, f); break;
      case 'incidents': res = await this.incidents(user, f); break;
      case 'audit': res = await this.audit(user, f); break;
      case 'vehicles': res = await this.vehicles(user, f); break;
      case 'gate-activity': res = await this.gateActivity(user, f); break;
      default: res = { rows: [] };
    }
    const title = report.charAt(0).toUpperCase() + report.slice(1).replace(/-/g, ' ');
    const rows = res.rows ?? [];
    return { title, rows: f.columns ? this.projectColumns(rows, f.columns) : rows };
  }

  // ── Period-over-period comparison wrapper ─────────────────────────

  /**
   * Returns a window of the same length immediately before `f`. Used by
   * runCompared() so any report can be re-run for the prior period and
   * the client can compute trend deltas.
   */
  priorWindow(f: ReportFilter): { from: string; to: string } {
    const { from, to } = this.resolveRange(f);
    const span = Math.max(DAY_MS, to.getTime() - from.getTime());
    const priorTo = new Date(from.getTime() - 1);
    const priorFrom = new Date(priorTo.getTime() - span);
    return {
      from: priorFrom.toISOString().slice(0, 10),
      to: priorTo.toISOString().slice(0, 10),
    };
  }

  /** Pct change (rounded to 1 decimal). 0 when prior is 0, sign preserved. */
  pctDeltas(current: Record<string, any> | undefined, prior: Record<string, any> | undefined): Record<string, number> {
    const out: Record<string, number> = {};
    if (!current || !prior) return out;
    for (const [k, v] of Object.entries(current)) {
      if (typeof v === 'number' && typeof prior[k] === 'number') {
        const denom = (prior[k] as number) || 0;
        out[k] = denom ? Math.round(((v - denom) / denom) * 1000) / 10 : 0;
      }
    }
    return out;
  }

  /**
   * Run any report-producing function. If the filter has compare=true,
   * also runs it for the prior window and attaches { prior, deltas }.
   */
  async runCompared<T extends { totals?: any; rows: any[]; range?: { from: string; to: string } }>(
    user: JwtUser,
    f: ReportFilter,
    fn: (u: JwtUser, ff: ReportFilter) => Promise<T>,
  ): Promise<T & { prior?: T; deltas?: Record<string, number> }> {
    const current = await fn(user, f);
    if (!f.compare) return current as any;
    const priorRange = this.priorWindow(f);
    const prior = await fn(user, { ...f, from: priorRange.from, to: priorRange.to, compare: false });
    return {
      ...current,
      prior,
      deltas: this.pctDeltas(current.totals, prior.totals),
    } as any;
  }

  /** Trim each row to the user-selected columns (preserves order). */
  projectColumns(rows: any[], columns: string[]): any[] {
    if (!columns?.length || !rows.length) return rows;
    const set = new Set(columns);
    return rows.map((row) => {
      const out: Record<string, any> = {};
      for (const k of Object.keys(row)) {
        if (set.has(k)) out[k] = row[k];
      }
      return out;
    });
  }

  // ── Shared sorting: time buckets ascending, categorical by volume ──

  private sortRows(rows: any[], groupBy: string) {
    const isTime = ['day', 'week', 'month', 'year'].includes(groupBy);
    if (isTime) {
      rows.sort((a, b) => String(a.group).localeCompare(String(b.group)));
    } else {
      rows.sort((a, b) => (b.total ?? b.totalHours ?? b.inQty ?? 0) - (a.total ?? a.totalHours ?? a.inQty ?? 0));
    }
  }
}
