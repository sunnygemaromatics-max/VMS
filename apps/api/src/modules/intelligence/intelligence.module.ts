import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { IncidentsService } from './incidents.service';
import { Detectors } from './detectors';
import { IntelligenceController } from './intelligence.controller';

/**
 * Intelligence module — Phase 4.
 * Detectors subscribe to the global EventBus (no explicit wiring needed,
 * @nestjs/event-emitter discovers @OnEvent handlers on providers).
 */
@Module({
  controllers: [IntelligenceController],
  providers: [AlertsService, IncidentsService, Detectors],
  exports: [AlertsService],
})
export class IntelligenceModule {}
