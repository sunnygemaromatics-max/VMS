import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsService, ReportFilter } from './reports.service';
import { ReportTemplatesService, TemplateInput } from './report-templates.service';
import { ReportScheduleService, ScheduleInput } from './report-schedule.service';
import { ReportExportsService, ExportLogInput } from './report-exports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';

// All endpoints are org-scoped via the service (SUPER_ADMIN sees everything).
// Common query params: from, to (ISO date), branchId, contractorId, groupBy.
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly schedules: ReportScheduleService,
    private readonly templates: ReportTemplatesService,
    private readonly exports: ReportExportsService,
  ) {}

  private filter(q: Record<string, string | undefined>): ReportFilter {
    return {
      from: q.from,
      to: q.to,
      branchId: q.branchId,
      contractorId: q.contractorId,
      groupBy: q.groupBy,
      columns: q.columns ? q.columns.split(',').map((c) => c.trim()).filter(Boolean) : undefined,
      compare: q.compare === 'true' || q.compare === '1',
    };
  }

  @Get('catalog')
  catalog() {
    return this.reports.catalog();
  }

  @Get('overview')
  overview(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.overview(u, f) as any);
  }

  @Get('executive')
  executive(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.executive(u, f) as any);
  }

  @Get('visits')
  visits(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.visits(u, f));
  }

  @Get('workforce')
  workforce(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.workforce(u, f));
  }

  @Get('contractors')
  contractors(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.contractors(u, f));
  }

  @Get('branches')
  branches(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.branches(u, f));
  }

  @Get('users')
  users(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.users(u, f));
  }

  @Get('materials')
  materials(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.materials(u, f));
  }

  @Get('incidents')
  incidents(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.incidents(u, f));
  }

  @Get('audit')
  audit(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.audit(u, f));
  }

  @Get('vehicles')
  vehicles(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.vehicles(u, f));
  }

  @Get('gate-activity')
  gateActivity(@CurrentUser() user: JwtUser, @Query() q: Record<string, string>) {
    return this.reports.runCompared(user, this.filter(q), (u, f) => this.reports.gateActivity(u, f));
  }

  // ── Ad-hoc "email this report now" ────────────────────────────────
  @Post('email')
  async emailReport(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      report: string;
      groupBy?: string;
      from?: string;
      to?: string;
      branchId?: string;
      contractorId?: string;
      recipients: string;
      subject?: string;
    },
  ) {
    const result = await this.schedules.emailAdHoc(user, body);
    // Best-effort audit log; don't fail the send if logging fails.
    this.exports
      .log(user, {
        report: body.report,
        format: 'email',
        scope: 'email',
        rowCount: result.rows,
        recipients: body.recipients,
        filters: {
          from: body.from,
          to: body.to,
          groupBy: body.groupBy,
          branchId: body.branchId,
          contractorId: body.contractorId,
        },
      })
      .catch(() => {});
    return result;
  }

  // ── Drill-down: raw records behind a grouped row ──────────────────
  @Get(':report/detail')
  detail(
    @CurrentUser() user: JwtUser,
    @Param('report') report: string,
    @Query() q: Record<string, string>,
  ) {
    return this.reports.detail(user, report, this.filter(q), q.value ?? '');
  }

  // ── Scheduled email reports ───────────────────────────────────────
  @Get('schedules/list')
  listSchedules(@CurrentUser() user: JwtUser) {
    return this.schedules.list(user);
  }

  @Post('schedules')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD)
  createSchedule(@CurrentUser() user: JwtUser, @Body() body: ScheduleInput) {
    return this.schedules.create(user, body);
  }

  @Put('schedules/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD)
  updateSchedule(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Partial<ScheduleInput>) {
    return this.schedules.update(user, id, body);
  }

  @Delete('schedules/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD)
  deleteSchedule(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.schedules.remove(user, id);
  }

  // ── Saved report templates ────────────────────────────────────────
  @Get('templates/list')
  listTemplates(@CurrentUser() user: JwtUser) {
    return this.templates.list(user);
  }

  @Post('templates')
  createTemplate(@CurrentUser() user: JwtUser, @Body() body: TemplateInput) {
    return this.templates.create(user, body);
  }

  @Put('templates/:id')
  updateTemplate(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Partial<TemplateInput>) {
    return this.templates.update(user, id, body);
  }

  @Delete('templates/:id')
  deleteTemplate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.templates.remove(user, id);
  }

  @Post('templates/:id/favorite')
  favoriteTemplate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.templates.toggleFavorite(user, id);
  }

  // ── Export audit trail ────────────────────────────────────────────
  @Get('exports/list')
  listExports(@CurrentUser() user: JwtUser, @Query('take') take?: string) {
    return this.exports.list(user, take ? parseInt(take, 10) : 50);
  }

  @Post('exports')
  logExport(@CurrentUser() user: JwtUser, @Body() body: ExportLogInput) {
    return this.exports.log(user, body);
  }

  @Post('schedules/:id/run')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.HR_MANAGER, Role.SECURITY_HEAD)
  runSchedule(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.schedules.runNow(user, id);
  }
}
