import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EventBus } from '../../platform/events/event-bus';
import { PrismaService } from '../../platform/prisma/prisma.service';
import type { JwtUser } from '../../common/tenant';

@Controller('sos')
@UseGuards(JwtAuthGuard)
export class SosController {
  constructor(
    private readonly events: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  @Post('trigger')
  async trigger(@CurrentUser() user: JwtUser, @Body() body: { message?: string }) {
    const me = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true, email: true, branchId: true, branch: { select: { name: true } } },
    });
    this.events.emit('sos.triggered', {
      actorId: user.userId,
      actorEmail: me?.email ?? user.email,
      actorName: me?.fullName ?? user.email,
      branchId: me?.branchId,
      branchName: me?.branch?.name,
      message: body?.message?.slice(0, 200),
      ts: new Date().toISOString(),
    });
    return { ok: true };
  }

  @Post('clear')
  async clear(@CurrentUser() user: JwtUser) {
    this.events.emit('sos.cleared', { actorId: user.userId, ts: new Date().toISOString() });
    return { ok: true };
  }
}
