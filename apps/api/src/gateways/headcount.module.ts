import { Module } from '@nestjs/common';
import { HeadcountGateway } from './headcount.gateway';

@Module({
  providers: [HeadcountGateway],
  exports: [HeadcountGateway],
})
export class HeadcountModule {}
