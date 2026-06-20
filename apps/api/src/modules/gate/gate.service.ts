import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { EventBus } from '../../platform/events/event-bus';
import { FaceService } from '../face/face.service';
import { JwtUser, isSuperAdmin, workerScope } from '../../common/tenant';

// Auto-grant only on a tight match; looser matches still identify the person
// but a human (compliance gate / gateman) makes the final call.
const AUTO_GRANT_DISTANCE = 0.5;

@Injectable()
export class GateService {
  constructor(
    private readonly events: EventBus,
    private readonly prisma: PrismaService,
    private readonly face: FaceService,
  ) {}

  private emitWorkerEvent(kind: 'in' | 'out', branchId: string, workerId: string, workerName: string) {
    const ts = new Date().toISOString();
    this.events.emit(kind === 'in' ? 'worker.checked_in' : 'worker.checked_out', {
      branchId,
      kind: 'worker',
      actorId: workerId,
      actorName: workerName,
      ts,
    });
    this.events.emit('headcount.invalidated', { branchId, reason: `worker.checked_${kind}`, ts });
  }

  /** Mark a worker on-site (creates Attendance if not already open). */
  async workerCheckIn(
    user: JwtUser,
    data: { workerId: string; gateId: string; branchId?: string },
  ) {
    if (!data.workerId || !data.gateId) {
      throw new BadRequestException('workerId and gateId are required');
    }

    const worker = await this.prisma.worker.findFirst({
      where: { id: data.workerId, ...workerScope(user) },
      include: { contractor: { select: { organizationId: true } } },
    });
    if (!worker) throw new NotFoundException('Worker not found in your organization');
    if (!worker.isActive) throw new BadRequestException('Worker is inactive');

    // Compliance gating
    if (!worker.policeVerified) {
      throw new BadRequestException('Worker is not police-verified yet');
    }
    if (new Date(worker.medicalExpiry) < new Date()) {
      throw new BadRequestException('Worker medical certificate has expired');
    }

    // Already inside? Return the open record without creating another.
    const open = await this.prisma.attendance.findFirst({
      where: { workerId: worker.id, checkOut: null },
    });
    if (open) {
      return { alreadyInside: true, attendanceId: open.id, workerName: worker.fullName };
    }

    // Resolve branchId — caller can pass it; otherwise pick the user's branch.
    let branchId = data.branchId;
    if (!branchId) {
      if (!user?.branchId) throw new BadRequestException('branchId required');
      branchId = user.branchId;
    } else if (!isSuperAdmin(user)) {
      // Authorize: branch must be in user's org
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { organizationId: true },
      });
      if (!branch || branch.organizationId !== (user as any).orgId) {
        throw new ForbiddenException('Branch belongs to another organization');
      }
    }

    const attendance = await this.prisma.attendance.create({
      data: {
        workerId: worker.id,
        branchId,
        gateId: data.gateId,
        checkIn: new Date(),
      },
    });

    this.emitWorkerEvent('in', branchId, worker.id, worker.fullName);

    return {
      success: true,
      attendanceId: attendance.id,
      workerId: worker.id,
      workerName: worker.fullName,
      checkedInAt: attendance.checkIn,
    };
  }

  /**
   * Worker check-in/out by their permanent QR token. Public surface
   * for the kiosk + mobile to scan a worker badge. Idempotent toggle:
   * if worker is currently on-site, it checks them out; otherwise in.
   */
  async workerQrToggle(token: string, gateId = 'kiosk', branchId?: string) {
    if (!token) throw new BadRequestException('Token required');
    const worker = await this.prisma.worker.findUnique({
      where: { qrCodeToken: token },
      include: { contractor: { select: { companyName: true } } },
    });
    if (!worker) throw new NotFoundException('Unknown worker QR');
    if (!worker.isActive) throw new BadRequestException('Worker is inactive');

    const open = await this.prisma.attendance.findFirst({
      where: { workerId: worker.id, checkOut: null },
    });

    if (open) {
      const updated = await this.prisma.attendance.update({
        where: { id: open.id },
        data: { checkOut: new Date() },
      });
      this.emitWorkerEvent('out', updated.branchId, worker.id, worker.fullName);
      return {
        action: 'checked-out',
        workerName: worker.fullName,
        contractor: worker.contractor.companyName,
        checkedInAt: updated.checkIn,
        checkedOutAt: updated.checkOut,
      };
    }

    // Compliance gate
    if (!worker.policeVerified) {
      throw new BadRequestException('Worker is not police-verified yet');
    }
    if (new Date(worker.medicalExpiry) < new Date()) {
      throw new BadRequestException('Worker medical certificate has expired');
    }

    const chosenBranch = branchId ?? (await this.prisma.branch.findFirst())?.id;
    if (!chosenBranch) throw new BadRequestException('No branch available');

    const att = await this.prisma.attendance.create({
      data: {
        workerId: worker.id,
        branchId: chosenBranch,
        gateId,
        checkIn: new Date(),
      },
    });
    this.emitWorkerEvent('in', chosenBranch, worker.id, worker.fullName);
    return {
      action: 'checked-in',
      workerName: worker.fullName,
      contractor: worker.contractor.companyName,
      attendanceId: att.id,
      checkedInAt: att.checkIn,
    };
  }

  /** Mark a worker as leaving (close open Attendance). */
  async workerCheckOut(user: JwtUser, workerId: string) {
    if (!workerId) throw new BadRequestException('workerId is required');

    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, ...workerScope(user) },
      select: { id: true, fullName: true, skillCategory: true },
    });
    if (!worker) throw new NotFoundException('Worker not found in your organization');

    const open = await this.prisma.attendance.findFirst({
      where: { workerId, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });
    if (!open) {
      throw new BadRequestException('Worker is not currently checked in');
    }

    const updated = await this.prisma.attendance.update({
      where: { id: open.id },
      data: { checkOut: new Date() },
    });

    this.emitWorkerEvent('out', updated.branchId, worker.id, worker.fullName);

    return {
      success: true,
      attendanceId: updated.id,
      workerName: worker.fullName,
      checkedInAt: updated.checkIn,
      checkedOutAt: updated.checkOut,
    };
  }

  /**
   * Face-gate entry. The visitor/worker stands at the camera; the client
   * (kiosk/mobile) computes the 128-d embedding via face-api.js and posts it.
   *
   * Decision flow:
   *   - identify the embedding (1:N, threshold 0.6)
   *   - no match           → { decision: 'unmatched' }  (register them)
   *   - worker, compliant  → auto check-in (toggle)  → { decision: 'granted' }
   *   - worker, blocked    → { decision: 'denied', reason } — gateman can override
   *   - visitor, approved  → auto check-in            → { decision: 'granted' }
   *   - visitor, no pass   → { decision: 'denied', reason }
   *
   * Public surface (kiosk). Override is the authenticated path below.
   */
  async faceEntry(embedding: number[], gateId = 'face-gate', branchId?: string) {
    const match: any = await this.face.identify(embedding, 0.6);
    if (!match?.matched) {
      this.events.emit('face.observed', {
        branchId, matched: false, distance: match?.bestDistance, ts: new Date().toISOString(),
      });
      return { decision: 'unmatched' as const, reason: match?.reason ?? 'Face not recognized' };
    }

    this.events.emit('face.observed', {
      branchId,
      matched: true,
      kind: match.kind,
      matchedId: match.id,
      matchedName: match.name,
      blacklisted: !!match.meta?.isBlacklisted,
      distance: match.distance,
      ts: new Date().toISOString(),
    });

    const lowConfidence = match.distance > AUTO_GRANT_DISTANCE;

    if (match.kind === 'worker') {
      return this.faceEntryWorker(match, gateId, branchId, lowConfidence);
    }
    return this.faceEntryVisitor(match, lowConfidence);
  }

  private async faceEntryWorker(match: any, gateId: string, branchId: string | undefined, lowConfidence: boolean) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: match.id },
      include: { contractor: { select: { companyName: true } } },
    });
    if (!worker) return { decision: 'unmatched' as const, reason: 'Worker record missing' };

    const reasons: string[] = [];
    if (!worker.isActive) reasons.push('Worker is inactive');
    if (!worker.policeVerified) reasons.push('Police verification incomplete');
    if (new Date(worker.medicalExpiry) < new Date()) reasons.push('Medical certificate expired');
    if (lowConfidence) reasons.push('Low face-match confidence');

    if (reasons.length > 0) {
      return {
        decision: 'denied' as const,
        kind: 'worker' as const,
        id: worker.id,
        name: worker.fullName,
        contractor: worker.contractor.companyName,
        distance: match.distance,
        reasons,
        canOverride: true,
      };
    }

    const result = await this.toggleWorkerAttendance(worker.id, worker.fullName, gateId, branchId);
    return { decision: 'granted' as const, kind: 'worker' as const, id: worker.id, name: worker.fullName, distance: match.distance, ...result };
  }

  private async faceEntryVisitor(match: any, lowConfidence: boolean) {
    if (match.meta?.isBlacklisted) {
      return { decision: 'denied' as const, kind: 'visitor' as const, id: match.id, name: match.name, reasons: ['Visitor is blacklisted'], canOverride: false };
    }
    const visit = await this.prisma.visit.findFirst({
      where: { visitorId: match.id, status: { in: [VisitStatus.APPROVED, VisitStatus.CHECKED_IN] } },
      orderBy: { expectedEntry: 'desc' },
    });
    if (!visit) {
      return { decision: 'denied' as const, kind: 'visitor' as const, id: match.id, name: match.name, reasons: ['No approved visit on file'], canOverride: true };
    }
    if (lowConfidence) {
      return { decision: 'denied' as const, kind: 'visitor' as const, id: match.id, name: match.name, visitId: visit.id, reasons: ['Low face-match confidence'], canOverride: true };
    }
    const res = await this.checkInByQrToken(visit.qrCodeToken);
    return { decision: 'granted' as const, kind: 'visitor' as const, id: match.id, name: match.name, distance: match.distance, ...res };
  }

  /** Toggle worker attendance in/out by id (used by face-gate + override). */
  private async toggleWorkerAttendance(workerId: string, workerName: string, gateId: string, branchId?: string) {
    const open = await this.prisma.attendance.findFirst({ where: { workerId, checkOut: null } });
    if (open) {
      const updated = await this.prisma.attendance.update({ where: { id: open.id }, data: { checkOut: new Date() } });
      this.emitWorkerEvent('out', updated.branchId, workerId, workerName);
      return { action: 'checked-out' as const, attendanceId: updated.id, checkedOutAt: updated.checkOut };
    }
    const chosenBranch = branchId ?? (await this.prisma.branch.findFirst())?.id;
    if (!chosenBranch) throw new BadRequestException('No branch available');
    const att = await this.prisma.attendance.create({
      data: { workerId, branchId: chosenBranch, gateId, checkIn: new Date() },
    });
    this.emitWorkerEvent('in', chosenBranch, workerId, workerName);
    return { action: 'checked-in' as const, attendanceId: att.id, checkedInAt: att.checkIn };
  }

  /**
   * Gateman override — force entry for a face-gate denial. Authenticated
   * (security roles only). Logs a security-relevant override event so it
   * surfaces as an incident, with the guard's identity + reason on record.
   */
  async faceEntryOverride(
    user: JwtUser,
    body: { kind: 'worker' | 'visitor'; id: string; gateId?: string; branchId?: string; reason: string },
  ) {
    if (!body?.id || !body?.reason?.trim()) {
      throw new BadRequestException('id and reason are required');
    }
    const gateId = body.gateId ?? 'face-gate';

    if (body.kind === 'worker') {
      const worker = await this.prisma.worker.findUnique({ where: { id: body.id }, select: { id: true, fullName: true } });
      if (!worker) throw new NotFoundException('Worker not found');
      const result = await this.toggleWorkerAttendance(worker.id, worker.fullName, gateId, body.branchId);
      this.events.emit('gate.override', {
        branchId: body.branchId, kind: 'worker', actorId: worker.id, actorName: worker.fullName,
        byUserId: (user as any).userId, byEmail: user.email, reason: body.reason.slice(0, 500), ts: new Date().toISOString(),
      });
      return { decision: 'override-granted', kind: 'worker', id: worker.id, name: worker.fullName, ...result };
    }

    // visitor override — check them in regardless of approval state
    const visit = await this.prisma.visit.findFirst({
      where: { visitorId: body.id },
      orderBy: { expectedEntry: 'desc' },
      include: { visitor: { select: { fullName: true } } },
    });
    if (!visit) throw new NotFoundException('No visit on file for this visitor');
    const ts = new Date().toISOString();
    const upd = await this.prisma.visit.update({
      where: { id: visit.id },
      data: { status: VisitStatus.CHECKED_IN, actualEntry: new Date() },
    });
    this.events.emit('visit.checked_in', { branchId: upd.branchId, kind: 'visitor', actorId: body.id, actorName: visit.visitor.fullName, ts });
    this.events.emit('headcount.invalidated', { branchId: upd.branchId, reason: 'override.entry', ts });
    this.events.emit('gate.override', {
      branchId: upd.branchId, kind: 'visitor', actorId: body.id, actorName: visit.visitor.fullName,
      byUserId: (user as any).userId, byEmail: user.email, reason: body.reason.slice(0, 500), ts,
    });
    return { decision: 'override-granted', kind: 'visitor', id: body.id, name: visit.visitor.fullName, visitId: upd.id };
  }

  async checkInByQrToken(qrCodeToken: string) {
    if (!qrCodeToken?.trim()) {
      throw new BadRequestException('qrCodeToken is required');
    }

    const visit = await this.prisma.visit.findUnique({
      where: { qrCodeToken },
      include: { visitor: true },
    });

    if (!visit) {
      // Maybe it's a worker badge QR — try that route before failing
      const worker = await this.prisma.worker.findUnique({ where: { qrCodeToken } });
      if (worker) {
        return this.workerQrToggle(qrCodeToken);
      }
      throw new NotFoundException('Invalid QR token');
    }

    const scan = (outcome: string, reason?: string) =>
      this.events.emit('gate.scan', {
        branchId: visit.branchId,
        outcome,
        reason,
        visitId: visit.id,
        visitorId: visit.visitorId,
        visitorName: visit.visitor.fullName,
        ts: new Date().toISOString(),
      });

    // Blacklist check — visitor record OR visit status
    if (visit.visitor.isBlacklisted) {
      scan('rejected', 'blacklist');
      throw new BadRequestException(
        `Visitor ${visit.visitor.fullName} is blacklisted — entry denied`,
      );
    }

    // Multi-entry / multi-day / recurring passes: validity window + cap,
    // and a scan toggles in↔out (re-entry allowed). SINGLE passes fall
    // through to the original one-shot logic below.
    if (visit.passKind !== 'SINGLE') {
      const now = new Date();
      if (visit.status === VisitStatus.PENDING) {
        scan('rejected', 'pending approval');
        throw new BadRequestException('Pass is awaiting host approval');
      }
      if (visit.status === VisitStatus.REJECTED || visit.status === VisitStatus.BLACKLISTED) {
        scan('rejected', `reject:${visit.status}`);
        throw new BadRequestException(`Visit is ${visit.status}`);
      }
      if (visit.validFrom && now < visit.validFrom) {
        scan('rejected', 'pass not yet valid');
        throw new BadRequestException('Pass is not valid yet');
      }
      if (visit.validUntil && now > visit.validUntil) {
        scan('rejected', 'pass expired');
        throw new BadRequestException('Pass has expired');
      }

      const ts2 = now.toISOString();
      if (visit.status === VisitStatus.CHECKED_IN) {
        // toggle out
        await this.prisma.visit.update({
          where: { id: visit.id },
          data: { status: VisitStatus.CHECKED_OUT, actualExit: now },
        });
        scan('approved', 'exit');
        this.events.emit('visit.checked_out', {
          branchId: visit.branchId, kind: 'visitor',
          actorId: visit.visitorId, actorName: visit.visitor.fullName, ts: ts2,
        });
        this.events.emit('headcount.invalidated', { branchId: visit.branchId, reason: 'multipass.exit', ts: ts2 });
        return { success: true, action: 'checked-out', visitorName: visit.visitor.fullName, visitId: visit.id };
      }

      // entering (APPROVED first time, or CHECKED_OUT re-entry)
      if (visit.maxEntries != null && visit.entryCount >= visit.maxEntries) {
        scan('rejected', 'entry cap reached');
        throw new BadRequestException(`Pass entry limit (${visit.maxEntries}) reached`);
      }
      const upd = await this.prisma.visit.update({
        where: { id: visit.id },
        data: { status: VisitStatus.CHECKED_IN, actualEntry: now, entryCount: { increment: 1 } },
      });
      scan('approved');
      this.events.emit('visit.checked_in', {
        branchId: visit.branchId, kind: 'visitor',
        actorId: visit.visitorId, actorName: visit.visitor.fullName, ts: ts2,
      });
      this.events.emit('headcount.invalidated', { branchId: visit.branchId, reason: 'multipass.entry', ts: ts2 });
      return {
        success: true,
        action: 'checked-in',
        visitorName: visit.visitor.fullName,
        visitId: visit.id,
        entryCount: upd.entryCount,
        maxEntries: visit.maxEntries ?? null,
      };
    }

    if (visit.status === VisitStatus.CHECKED_IN) {
      return {
        success: true,
        already: true,
        visitorName: visit.visitor.fullName,
        visitId: visit.id,
        checkedInAt: visit.actualEntry,
      };
    }

    if (visit.status === VisitStatus.REJECTED || visit.status === VisitStatus.BLACKLISTED) {
      scan('rejected', `reject:${visit.status}`);
      throw new BadRequestException(`Visit is ${visit.status}`);
    }

    if (visit.status === VisitStatus.PENDING) {
      scan('rejected', 'pending approval');
      throw new BadRequestException(
        'Visit is still awaiting host approval — ask your host to approve first',
      );
    }

    const updated = await this.prisma.visit.update({
      where: { id: visit.id },
      data: {
        status: VisitStatus.CHECKED_IN,
        actualEntry: new Date(),
      },
    });

    const ts = new Date().toISOString();
    scan('approved');
    this.events.emit('visit.checked_in', {
      branchId: updated.branchId,
      kind: 'visitor',
      actorId: visit.visitorId,
      actorName: visit.visitor.fullName,
      ts,
    });
    this.events.emit('headcount.invalidated', { branchId: updated.branchId, reason: 'gate.qr_checkin', ts });

    return {
      success: true,
      visitorName: visit.visitor.fullName,
      visitId: updated.id,
      checkedInAt: updated.actualEntry,
    };
  }

  async getGateLog(gateId: string, hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.prisma.attendance.findMany({
      where: {
        gateId,
        checkIn: { gte: since },
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            skillCategory: true,
          },
        },
      },
      orderBy: { checkIn: 'desc' },
    });
  }
}
