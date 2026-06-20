import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../platform/rbac/permission.guard';
import { RequirePermission } from '../../platform/rbac/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';
import { WatchlistsService } from './watchlists.service';

@Controller('watchlists')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WatchlistsController {
  constructor(private readonly svc: WatchlistsService) {}

  @Get()
  @RequirePermission('watchlist:read')
  list(@CurrentUser() user: JwtUser) {
    return this.svc.list(user);
  }

  @Post()
  @RequirePermission('watchlist:manage')
  create(
    @CurrentUser() user: JwtUser,
    @Body() body: { name: string; description?: string; kind?: string; severity?: number },
  ) {
    return this.svc.create(user, body);
  }

  @Get(':id/entries')
  @RequirePermission('watchlist:read')
  entries(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.entries(user, id);
  }

  @Post(':id/entries')
  @RequirePermission('watchlist:add_entry')
  addEntry(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { visitorId: string; reason: string; expiresAt?: string | null },
  ) {
    return this.svc.addEntry(user, id, body);
  }

  @Delete(':id/entries/:entryId')
  @RequirePermission('watchlist:manage')
  removeEntry(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ) {
    return this.svc.removeEntry(user, id, entryId);
  }
}
