import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GateService } from './gate.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';

@Controller('gate')
export class GateController {
  constructor(private gateService: GateService) {}

  // Public — kiosk/mobile post a face embedding; engine identifies +
  // applies entry rules and auto checks-in, or returns a denial the
  // gateman can override.
  @Post('face-entry')
  async faceEntry(
    @Body() body: { embedding: number[]; gateId?: string; branchId?: string },
  ) {
    return this.gateService.faceEntry(body?.embedding, body?.gateId, body?.branchId);
  }

  // Authenticated — gateman forces entry after a denial. Logged as a
  // security override (raises an incident with guard identity + reason).
  @Post('face-entry/override')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_GUARD)
  faceEntryOverride(
    @CurrentUser() user: JwtUser,
    @Body() body: { kind: 'worker' | 'visitor'; id: string; gateId?: string; branchId?: string; reason: string },
  ) {
    return this.gateService.faceEntryOverride(user, body);
  }

  // Public — kiosk + mobile use this
  @Post('check-in')
  async checkIn(@Body() body: { qrCodeToken: string }) {
    return this.gateService.checkInByQrToken(body.qrCodeToken);
  }

  // Public — kiosk scans a worker badge QR. Idempotent toggle (in/out).
  @Post('worker-qr')
  async workerQr(@Body() body: { qrCodeToken: string; gateId?: string; branchId?: string }) {
    return this.gateService.workerQrToggle(body?.qrCodeToken, body?.gateId, body?.branchId);
  }

  @Get('log/:gateId')
  @UseGuards(JwtAuthGuard)
  async getGateLog(@Param('gateId') gateId: string) {
    return this.gateService.getGateLog(gateId, 24);
  }

  // Worker check-in / check-out — auth required, security/HR/supervisor roles
  @Post('worker-check-in')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.HR_MANAGER,
    Role.SECURITY_GUARD,
    Role.CONTRACTOR_SUPERVISOR,
  )
  workerCheckIn(
    @CurrentUser() user: JwtUser,
    @Body() body: { workerId: string; gateId: string; branchId?: string },
  ) {
    return this.gateService.workerCheckIn(user, body);
  }

  @Post('worker-check-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.HR_MANAGER,
    Role.SECURITY_GUARD,
    Role.CONTRACTOR_SUPERVISOR,
  )
  workerCheckOut(
    @CurrentUser() user: JwtUser,
    @Body() body: { workerId: string },
  ) {
    return this.gateService.workerCheckOut(user, body?.workerId);
  }
}
