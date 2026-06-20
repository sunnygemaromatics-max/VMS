import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  JwtUser,
  branchScope,
  isSuperAdmin,
  requireOrg,
  workerScope,
} from '../../common/tenant';

const TIME_RE = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

@Injectable()
export class WorkforceService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Shifts -----------------------------------------------------
  listShifts(user: JwtUser) {
    return this.prisma.shift.findMany({
      where: { branch: branchScope(user) } as any,
      include: {
        branch: { select: { name: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: [{ branchId: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createShift(
    user: JwtUser,
    data: { branchId: string; name: string; startTime: string; endTime: string },
  ) {
    if (!data.branchId || !data.name || !data.startTime || !data.endTime) {
      throw new BadRequestException('branchId, name, startTime, endTime required');
    }
    if (!TIME_RE.test(data.startTime) || !TIME_RE.test(data.endTime)) {
      throw new BadRequestException('startTime / endTime must be HH:MM');
    }
    const branch = await this.prisma.branch.findUnique({
      where: { id: data.branchId },
      select: { organizationId: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (!isSuperAdmin(user) && branch.organizationId !== requireOrg(user)) {
      throw new ForbiddenException('Branch belongs to another organization');
    }
    return this.prisma.shift.create({
      data: {
        branchId: data.branchId,
        name: data.name.slice(0, 100),
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });
  }

  async assignWorkerToShift(user: JwtUser, shiftId: string, workerId: string) {
    if (!shiftId || !workerId) {
      throw new BadRequestException('shiftId and workerId required');
    }
    // Scope check
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, branch: branchScope(user) as any },
      select: { id: true, branchId: true },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, ...workerScope(user) },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    return this.prisma.workerShift.upsert({
      where: { workerId_shiftId: { workerId, shiftId } },
      update: {},
      create: { workerId, shiftId },
    });
  }

  async unassignWorker(user: JwtUser, shiftId: string, workerId: string) {
    // Verify shift is in scope
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, branch: branchScope(user) as any },
      select: { id: true },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    await this.prisma.workerShift.deleteMany({ where: { shiftId, workerId } });
    return { ok: true };
  }

  shiftAssignments(user: JwtUser, shiftId: string) {
    return this.prisma.workerShift.findMany({
      where: {
        shiftId,
        shift: { branch: branchScope(user) as any },
      } as any,
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            skillCategory: true,
            isActive: true,
            contractor: { select: { companyName: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // --- Parking slots ---------------------------------------------
  listParkingSlots(user: JwtUser) {
    return this.prisma.parkingSlot.findMany({
      where: { branch: branchScope(user) } as any,
      include: {
        branch: { select: { name: true } },
        visits: {
          where: { actualEntry: { not: null }, actualExit: null },
          select: {
            id: true,
            visitor: { select: { fullName: true } },
            vehicleNumber: true,
          },
        },
      },
      orderBy: [{ branchId: 'asc' }, { label: 'asc' }],
    });
  }

  async createParkingSlot(
    user: JwtUser,
    data: { branchId: string; label: string; zone?: string },
  ) {
    if (!data.branchId || !data.label) {
      throw new BadRequestException('branchId and label required');
    }
    const branch = await this.prisma.branch.findUnique({
      where: { id: data.branchId },
      select: { organizationId: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (!isSuperAdmin(user) && branch.organizationId !== requireOrg(user)) {
      throw new ForbiddenException('Branch belongs to another organization');
    }
    return this.prisma.parkingSlot.create({
      data: {
        branchId: data.branchId,
        label: data.label.slice(0, 50),
        zone: data.zone?.slice(0, 50) || null,
      },
    });
  }

  async assignSlotToVisit(user: JwtUser, visitId: string, slotId: string | null) {
    // Scope visit
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, branch: branchScope(user) as any },
      select: { id: true, branchId: true },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    if (slotId) {
      const slot = await this.prisma.parkingSlot.findFirst({
        where: { id: slotId, branchId: visit.branchId },
        select: { id: true },
      });
      if (!slot) throw new BadRequestException('Slot not in this visit\'s branch');
    }
    return this.prisma.visit.update({
      where: { id: visitId },
      data: { parkingSlotId: slotId },
      select: { id: true, parkingSlotId: true },
    });
  }
}
