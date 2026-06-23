import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MaterialPassService } from './material-pass.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';

@Controller('material-pass')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialPassController {
  constructor(private readonly svc: MaterialPassService) {}

  @Get()
  recent(@CurrentUser() user: JwtUser, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 100;
    return this.svc.listRecent(user, Number.isFinite(n) ? n : 100);
  }

  @Get('visit/:visitId')
  forVisit(@CurrentUser() user: JwtUser, @Param('visitId') visitId: string) {
    return this.svc.listForVisit(user, visitId);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_GUARD, Role.RECEPTIONIST)
  create(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.svc.create(user, body);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtUser, @Query('branchId') branchId?: string) {
    return this.svc.dashboard(user, branchId);
  }

  @Get('entries')
  entries(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.svc.listEntries(user, q);
  }

  @Get('entries/:id')
  entry(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.getEntry(user, id);
  }

  @Post('entries')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD, Role.SECURITY_GUARD, Role.CONTRACTOR_SUPERVISOR)
  createEntry(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.svc.createEntry(user, body);
  }

  @Put('entries/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD, Role.SECURITY_GUARD, Role.CONTRACTOR_SUPERVISOR)
  updateEntry(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateEntry(user, id, body);
  }

  @Post('entries/:id/status')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD, Role.SECURITY_GUARD, Role.CONTRACTOR_SUPERVISOR)
  updateStatus(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateStatus(user, id, body);
  }

  @Get('lookup')
  lookup(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.svc.lookup(user, q);
  }

  @Get('drivers')
  drivers(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.svc.listDrivers(user, q);
  }

  @Post('drivers')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD, Role.SECURITY_GUARD)
  createDriver(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.svc.createDriver(user, body);
  }

  @Put('drivers/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD, Role.SECURITY_GUARD)
  updateDriver(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateDriver(user, id, body);
  }

  @Get('vehicles-master')
  vehicles(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.svc.listVehicles(user, q);
  }

  @Post('vehicles-master')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD, Role.SECURITY_GUARD)
  createVehicle(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.svc.createVehicle(user, body);
  }

  @Put('vehicles-master/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD, Role.SECURITY_GUARD)
  updateVehicle(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateVehicle(user, id, body);
  }

  @Get('reports')
  reports(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.svc.report(user, q);
  }
}
