import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';

@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private complianceService: ComplianceService) {}

  @Get()
  getAllCompliance(@CurrentUser() user: JwtUser) {
    return this.complianceService.getAllComplianceStatus(user);
  }

  @Get('alerts')
  getAlerts(@CurrentUser() user: JwtUser) {
    return this.complianceService.getExpiringSoon(user, 30);
  }

  @Get('worker/:workerId')
  getWorkerCompliance(@CurrentUser() user: JwtUser, @Param('workerId') workerId: string) {
    return this.complianceService.getWorkerCompliance(user, workerId);
  }

  @Get('contractor/:contractorId')
  getContractorCompliance(
    @CurrentUser() user: JwtUser,
    @Param('contractorId') contractorId: string,
  ) {
    return this.complianceService.getContractorCompliance(user, contractorId);
  }

  @Put('worker/:workerId')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER)
  updateWorkerCompliance(
    @CurrentUser() user: JwtUser,
    @Param('workerId') workerId: string,
    @Body() body: any,
  ) {
    return this.complianceService.updateWorkerCompliance(user, workerId, body);
  }
}
