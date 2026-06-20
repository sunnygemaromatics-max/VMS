import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtUser, isSuperAdmin, requireOrg } from '../../common/tenant';

export interface ExportLogInput {
  report: string;
  /** xlsx | csv | pdf | json | xml | print | email */
  format: string;
  /** current | full | summary | email */
  scope?: string;
  rowCount?: number;
  filters?: Record<string, unknown>;
  recipients?: string;
}

/**
 * Append-only audit trail of every report export and email. The web client
 * POSTs here right after a download / email succeeds; the API also logs
 * its own emails. Required for SOX-style change history; surfaced in the
 * right rail of /reports.
 */
@Injectable()
export class ReportExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(user: JwtUser, input: ExportLogInput) {
    await this.prisma.reportExport.create({
      data: {
        orgId: isSuperAdmin(user) ? null : requireOrg(user),
        actorId: user.userId,
        actorEmail: user.email,
        report: input.report.slice(0, 40),
        format: input.format.slice(0, 20),
        scope: (input.scope || 'current').slice(0, 20),
        rowCount: input.rowCount ?? 0,
        filters: (input.filters ?? null) as any,
        recipients: input.recipients?.slice(0, 1000) || null,
      },
    });
    return { ok: true };
  }

  list(user: JwtUser, take = 50) {
    const where = isSuperAdmin(user) ? {} : { orgId: requireOrg(user) };
    return this.prisma.reportExport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, take)),
    });
  }
}
