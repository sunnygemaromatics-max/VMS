import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportScheduleService } from './report-schedule.service';
import { ReportTemplatesService } from './report-templates.service';
import { ReportExportsService } from './report-exports.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportScheduleService,
    ReportTemplatesService,
    ReportExportsService,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
