import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { VisitorsService } from './visitors.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';

@Controller('visitors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitorsController {
  constructor(private visitorsService: VisitorsService) {}

  // --- Reads --------------------------------------------------
  @Get()
  getVisitors(@CurrentUser() user: JwtUser) {
    return this.visitorsService.getVisitors(user);
  }

  @Get('visits')
  getAllVisits(@CurrentUser() user: JwtUser) {
    return this.visitorsService.getAllVisits(user);
  }

  @Get('pending')
  getPendingVisits(@CurrentUser() user: JwtUser) {
    return this.visitorsService.getPendingVisits(user);
  }

  @Get('vehicles')
  listVehicles(@CurrentUser() user: JwtUser) {
    return this.visitorsService.listVehicles(user);
  }

  @Get('analytics')
  analytics(@CurrentUser() user: JwtUser, @Query('days') days?: string) {
    const d = days ? parseInt(days, 10) : 7;
    return this.visitorsService.getDailyAnalytics(user, Number.isFinite(d) ? d : 7);
  }

  @Get('headcount')
  getHeadcountDefault(@CurrentUser() user: JwtUser) {
    return this.visitorsService.getLiveHeadcount(user);
  }

  @Get('headcount-by-company')
  getHeadcountByCompany(@CurrentUser() user: JwtUser, @Query('branchId') branchId?: string) {
    return this.visitorsService.getOccupancyByCompany(user, branchId || undefined);
  }

  @Get('active')
  getActive(@CurrentUser() user: JwtUser, @Query('branchId') branchId?: string) {
    return this.visitorsService.getActiveOnSite(user, branchId || undefined);
  }

  @Get('headcount/:branchId')
  getHeadcount(@CurrentUser() user: JwtUser, @Param('branchId') branchId: string) {
    return this.visitorsService.getLiveHeadcount(user, branchId);
  }

  @Get('visit/list/:branchId')
  getVisitsByBranch(@CurrentUser() user: JwtUser, @Param('branchId') branchId: string) {
    return this.visitorsService.getAllVisits(user, branchId);
  }

  @Get('visit/:id')
  getVisit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.visitorsService.getVisit(user, id);
  }

  // --- Writes -------------------------------------------------
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.RECEPTIONIST)
  createVisitor(@Body() body: any) {
    return this.visitorsService.createVisitor(body);
  }

  @Post('visit')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.RECEPTIONIST, Role.EMPLOYEE)
  createVisit(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.visitorsService.createVisit(user, body);
  }

  @Put('visit/:id/checkin')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_GUARD, Role.RECEPTIONIST)
  checkIn(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.visitorsService.checkInVisitor(user, id);
  }

  @Put('visit/:id/checkout')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_GUARD, Role.RECEPTIONIST)
  checkOut(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.visitorsService.checkOutVisitor(user, id);
  }

  @Put('visit/:id/status')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER)
  updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.visitorsService.updateVisitStatus(user, id, body.status);
  }

  @Put(':id/vip')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.RECEPTIONIST)
  toggleVip(@Param('id') id: string, @Body() body: { isVip: boolean }) {
    return this.visitorsService.setVip(id, !!body?.isVip);
  }
}
