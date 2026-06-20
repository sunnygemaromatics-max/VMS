import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // --- Reads: any authenticated user, scoped to their org --------
  @Get('branches')
  branches(@CurrentUser() user: JwtUser) {
    return this.admin.listBranches(user);
  }

  @Get('hosts')
  hosts(@CurrentUser() user: JwtUser) {
    return this.admin.listHosts(user);
  }

  @Get('users')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  users(@CurrentUser() user: JwtUser) {
    return this.admin.listUsers(user);
  }

  @Put('users/:id/active')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  setUserActive(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.admin.setUserActive(user, id, !!body?.isActive);
  }

  @Post('branches')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  createBranch(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.admin.createBranch(user, body);
  }

  @Get('visitors')
  visitors(@CurrentUser() user: JwtUser) {
    return this.admin.listVisitors(user);
  }

  @Get('contractors')
  contractors(@CurrentUser() user: JwtUser) {
    return this.admin.listContractors(user);
  }

  @Get('workers')
  workers(@CurrentUser() user: JwtUser, @Query('contractorId') contractorId?: string) {
    return this.admin.listWorkers(user, contractorId);
  }

  @Get('attendance')
  attendance(@CurrentUser() user: JwtUser) {
    return this.admin.listAttendance(user);
  }

  @Get('audit')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  audit(@CurrentUser() user: JwtUser) {
    return this.admin.listAuditLogs(user);
  }

  @Get('anomalies')
  anomalies(@CurrentUser() user: JwtUser) {
    return this.admin.detectAnomalies(user);
  }

  @Get('heatmap')
  heatmap(@CurrentUser() user: JwtUser, @Query('days') days?: string) {
    const d = days ? parseInt(days, 10) : 30;
    return this.admin.getHeatmap(user, Number.isFinite(d) ? d : 30);
  }

  @Get('worker-hours')
  workerHours(@CurrentUser() user: JwtUser, @Query('days') days?: string) {
    const d = days ? parseInt(days, 10) : 7;
    return this.admin.workerHoursReport(user, Number.isFinite(d) ? d : 7);
  }

  // --- Writes: scoped + role-checked -----------------------------
  @Post('contractors')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER)
  createContractor(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.admin.createContractor(user, body);
  }

  @Post('workers')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.HR_MANAGER,
    Role.CONTRACTOR_SUPERVISOR,
    Role.SECURITY_GUARD,
  )
  createWorker(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.admin.createWorker(user, body);
  }

  @Post('workers/bulk-import')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.CONTRACTOR_SUPERVISOR)
  bulkImportWorkers(@CurrentUser() user: JwtUser, @Body() body: { csv: string }) {
    return this.admin.bulkImportWorkers(user, body?.csv ?? '');
  }

  @Post('hosts')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  createHost(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.admin.createHost(user, body);
  }

  @Put('visitors/:id/blacklist')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_GUARD)
  setBlacklist(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { blacklist: boolean },
  ) {
    return this.admin.setVisitorBlacklist(user, id, !!body?.blacklist);
  }
}
