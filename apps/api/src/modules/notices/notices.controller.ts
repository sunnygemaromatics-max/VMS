import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';
import { NoticesService } from './notices.service';

@Controller('notices')
@UseGuards(JwtAuthGuard)
export class NoticesController {
  constructor(private readonly svc: NoticesService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query('branchId') branchId?: string) {
    return this.svc.list(user, branchId || undefined);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER)
  create(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      title: string;
      body: string;
      level?: string;
      branchId?: string | null;
      expiresAt?: string | null;
    },
  ) {
    return this.svc.create(user, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.remove(user, id);
  }
}
