import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  /** Register an Expo push token for the authenticated device. */
  @Post('register')
  @UseGuards(JwtAuthGuard)
  register(
    @CurrentUser() user: JwtUser,
    @Body() body: { token: string; platform?: string },
  ) {
    return this.svc.registerDeviceToken({
      token: body?.token,
      platform: body?.platform || 'unknown',
      userId: (user as any).userId,
      branchId: (user as any).branchId,
      orgId: (user as any).orgId,
    });
  }

  @Post('unregister')
  @UseGuards(JwtAuthGuard)
  unregister(@Body() body: { token: string }) {
    return this.svc.unregisterDeviceToken(body?.token);
  }
}
