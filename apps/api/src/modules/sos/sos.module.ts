import { Module } from '@nestjs/common';
import { SosController } from './sos.controller';
import { HeadcountModule } from '../../gateways/headcount.module';

@Module({
  imports: [HeadcountModule],
  controllers: [SosController],
})
export class SosModule {}
