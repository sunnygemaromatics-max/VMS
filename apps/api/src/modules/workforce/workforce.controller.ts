import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { WorkforceService } from './workforce.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkforceController {
  constructor(private readonly svc: WorkforceService) {}

  // --- Shifts -----------------------------------------------------
  @Get('shifts')
  listShifts(@CurrentUser() user: JwtUser) {
    return this.svc.listShifts(user);
  }

  @Post('shifts')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER)
  createShift(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.svc.createShift(user, body);
  }

  @Get('shifts/:id/assignments')
  shiftAssignments(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.shiftAssignments(user, id);
  }

  @Post('shifts/:id/assign')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.CONTRACTOR_SUPERVISOR)
  assignWorker(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { workerId: string },
  ) {
    return this.svc.assignWorkerToShift(user, id, body?.workerId);
  }

  @Delete('shifts/:id/assign/:workerId')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.CONTRACTOR_SUPERVISOR)
  unassignWorker(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('workerId') workerId: string,
  ) {
    return this.svc.unassignWorker(user, id, workerId);
  }

  // --- Parking ----------------------------------------------------
  @Get('parking')
  listParkingSlots(@CurrentUser() user: JwtUser) {
    return this.svc.listParkingSlots(user);
  }

  @Post('parking')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER)
  createParkingSlot(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.svc.createParkingSlot(user, body);
  }

  @Put('visits/:visitId/parking')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.RECEPTIONIST, Role.SECURITY_GUARD)
  assignSlot(
    @CurrentUser() user: JwtUser,
    @Param('visitId') visitId: string,
    @Body() body: { slotId: string | null },
  ) {
    return this.svc.assignSlotToVisit(user, visitId, body?.slotId ?? null);
  }
}
