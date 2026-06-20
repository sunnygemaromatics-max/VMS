import { Module } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { VisitorsController } from './visitors.controller';
import { PublicPassController } from './public-pass.controller';
import { HeadcountModule } from '../../gateways/headcount.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [HeadcountModule, NotificationsModule],
  providers: [VisitorsService],
  controllers: [VisitorsController, PublicPassController],
  exports: [VisitorsService],
})
export class VisitorsModule {}
