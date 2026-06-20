import { Module } from '@nestjs/common';
import { GateService } from './gate.service';
import { GateController } from './gate.controller';
import { HeadcountModule } from '../../gateways/headcount.module';
import { FaceModule } from '../face/face.module';

@Module({
  imports: [HeadcountModule, FaceModule],
  providers: [GateService],
  controllers: [GateController],
  exports: [GateService],
})
export class GateModule {}
