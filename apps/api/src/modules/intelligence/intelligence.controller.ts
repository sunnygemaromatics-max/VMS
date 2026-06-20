import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../platform/rbac/permission.guard';
import { RequirePermission } from '../../platform/rbac/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';
import { IncidentsService } from './incidents.service';

@Controller('incidents')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IntelligenceController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  @RequirePermission('incident:read')
  list(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.incidents.list(user, { status, branchId });
  }

  @Get('open-count')
  @RequirePermission('incident:read')
  openCount(@CurrentUser() user: JwtUser) {
    return this.incidents.openCount(user);
  }

  @Get(':id')
  @RequirePermission('incident:read')
  detail(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.incidents.detail(user, id);
  }

  @Post(':id/acknowledge')
  @RequirePermission('anomaly:ack')
  acknowledge(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.incidents.acknowledge(user, id);
  }

  @Post(':id/assign')
  @RequirePermission('incident:resolve')
  assign(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.incidents.assign(user, id, body?.userId);
  }

  @Post(':id/note')
  @RequirePermission('anomaly:ack')
  note(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: { text: string }) {
    return this.incidents.note(user, id, body?.text ?? '');
  }

  @Post(':id/escalate')
  @RequirePermission('anomaly:escalate')
  escalate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.incidents.escalate(user, id);
  }

  @Post(':id/resolve')
  @RequirePermission('incident:resolve')
  resolve(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { resolution: string; falsePositive?: boolean },
  ) {
    return this.incidents.resolve(user, id, body);
  }
}
