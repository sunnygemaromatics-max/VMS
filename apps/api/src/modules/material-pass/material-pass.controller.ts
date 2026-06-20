import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
  @Roles(
    Role.SUPER_ADMIN,
    Role.ORG_ADMIN,
    Role.HR_MANAGER,
    Role.SECURITY_GUARD,
    Role.RECEPTIONIST,
  )
  create(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.svc.create(user, body);
  }
}
