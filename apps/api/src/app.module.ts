import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './platform/prisma/prisma.module';
import { EventsModule } from './platform/events/events.module';
import { JobsModule } from './platform/jobs/jobs.module';
import { StorageModule } from './platform/storage/storage.module';
import { RbacModule } from './platform/rbac/rbac.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { VisitorsModule } from './modules/visitors/visitors.module';
import { GateModule } from './modules/gate/gate.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { AdminModule } from './modules/admin/admin.module';
import { PublicModule } from './modules/public/public.module';
import { MaterialPassModule } from './modules/material-pass/material-pass.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { FaceModule } from './modules/face/face.module';
import { SosModule } from './modules/sos/sos.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NoticesModule } from './modules/notices/notices.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { WatchlistsModule } from './modules/watchlists/watchlists.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SearchModule } from './modules/search/search.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HeadcountModule } from './gateways/headcount.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },   // 10 req/sec burst
      { name: 'medium', ttl: 60_000, limit: 120 }, // 120 req/min sustained
    ]),
    PrismaModule,
    EventsModule,
    JobsModule,
    StorageModule,
    RbacModule,
    HeadcountModule,
    AuthModule,
    VisitorsModule,
    GateModule,
    ComplianceModule,
    AdminModule,
    PublicModule,
    MaterialPassModule,
    WorkforceModule,
    FaceModule,
    SosModule,
    NotificationsModule,
    NoticesModule,
    IntelligenceModule,
    WatchlistsModule,
    DocumentsModule,
    SearchModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
