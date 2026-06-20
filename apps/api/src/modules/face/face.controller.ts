import { Body, Controller, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { FaceService } from './face.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { EventBus } from '../../platform/events/event-bus';

@Controller('face')
export class FaceController {
  constructor(
    private readonly svc: FaceService,
    private readonly events: EventBus,
  ) {}

  // Public: kiosk + mobile fire this. Rate limiter is the only gate.
  @Post('identify')
  async identify(@Body() body: { embedding: number[]; threshold?: number; branchId?: string }) {
    const result: any = await this.svc.identify(body?.embedding, body?.threshold);
    // Feed the intelligence detectors (blacklist-face / unknown-face)
    this.events.emit('face.observed', {
      branchId: body?.branchId,
      matched: !!result?.matched,
      kind: result?.kind,
      matchedId: result?.id,
      matchedName: result?.name,
      blacklisted: !!result?.meta?.isBlacklisted,
      distance: result?.distance ?? result?.bestDistance,
      ts: new Date().toISOString(),
    });
    return result;
  }

  @Post('enroll/visitor/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.RECEPTIONIST, Role.SECURITY_GUARD)
  enrollVisitor(@Param('id') id: string, @Body() body: { embedding: number[] }) {
    return this.svc.enroll('visitor', id, body?.embedding).catch((e) => {
      if (e?.code === 'P2025') throw new NotFoundException('Visitor not found');
      throw e;
    });
  }

  @Post('enroll/worker/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.CONTRACTOR_SUPERVISOR, Role.SECURITY_GUARD)
  enrollWorker(@Param('id') id: string, @Body() body: { embedding: number[] }) {
    return this.svc.enroll('worker', id, body?.embedding).catch((e) => {
      if (e?.code === 'P2025') throw new NotFoundException('Worker not found');
      throw e;
    });
  }
}
