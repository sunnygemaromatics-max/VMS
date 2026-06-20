import { Module } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { NoticesController } from './notices.controller';
import { HeadcountModule } from '../../gateways/headcount.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [HeadcountModule, NotificationsModule],
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}
