import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtUser, isSuperAdmin, requireOrg } from '../../common/tenant';

const VALID_REPORTS = [
  'visits',
  'workforce',
  'contractors',
  'branches',
  'users',
  'materials',
  'incidents',
  'audit',
  'vehicles',
  'gate-activity',
];
const VALID_PRESETS = ['thisMonth', 'lastMonth', 'last7d', 'last30d', 'last90d', 'ytd'];

export interface TemplateInput {
  name: string;
  report: string;
  groupBy?: string;
  branchId?: string;
  contractorId?: string;
  rangePreset?: string;
  /** Comma-separated column keys or null for "all columns". */
  columns?: string | null;
  isFavorite?: boolean;
}

/**
 * Saved report templates. Each template captures the user's "view" of a
 * report — the chosen group-by, filters and column selection — so it can
 * be re-opened with one click from the right-rail "Saved" list.
 */
@Injectable()
export class ReportTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: JwtUser) {
    const where = isSuperAdmin(user) ? {} : { orgId: requireOrg(user) };
    return this.prisma.reportTemplate.findMany({
      where,
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async create(user: JwtUser, input: TemplateInput) {
    this.validate(input);
    return this.prisma.reportTemplate.create({
      data: {
        orgId: isSuperAdmin(user) ? null : requireOrg(user),
        createdBy: user.userId,
        name: input.name.slice(0, 160),
        report: input.report,
        groupBy: input.groupBy || null,
        branchId: input.branchId || null,
        contractorId: input.contractorId || null,
        rangePreset: input.rangePreset || 'thisMonth',
        columns: input.columns?.slice(0, 2000) || null,
        isFavorite: !!input.isFavorite,
      },
    });
  }

  async update(user: JwtUser, id: string, input: Partial<TemplateInput>) {
    await this.owned(user, id);
    if (input.report || input.name) this.validate({ ...input, name: input.name || 'tmp', report: input.report || 'visits' } as TemplateInput);
    return this.prisma.reportTemplate.update({
      where: { id },
      data: {
        name: input.name?.slice(0, 160),
        report: input.report,
        groupBy: input.groupBy ?? undefined,
        branchId: input.branchId ?? undefined,
        contractorId: input.contractorId ?? undefined,
        rangePreset: input.rangePreset ?? undefined,
        columns: input.columns === null ? null : input.columns?.slice(0, 2000),
        isFavorite: input.isFavorite,
      },
    });
  }

  async remove(user: JwtUser, id: string) {
    await this.owned(user, id);
    await this.prisma.reportTemplate.delete({ where: { id } });
    return { ok: true };
  }

  async toggleFavorite(user: JwtUser, id: string) {
    const t = await this.owned(user, id);
    return this.prisma.reportTemplate.update({
      where: { id },
      data: { isFavorite: !t.isFavorite },
    });
  }

  private async owned(user: JwtUser, id: string) {
    const t = await this.prisma.reportTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    if (!isSuperAdmin(user) && t.orgId !== requireOrg(user)) {
      throw new NotFoundException('Template not found');
    }
    return t;
  }

  private validate(input: TemplateInput) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    if (!VALID_REPORTS.includes(input.report)) throw new BadRequestException('invalid report');
    if (input.rangePreset && !VALID_PRESETS.includes(input.rangePreset)) {
      throw new BadRequestException('invalid rangePreset');
    }
  }
}
