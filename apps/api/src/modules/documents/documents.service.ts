import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { DocumentKind, DocumentStatus } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtUser, isSuperAdmin } from '../../common/tenant';

const KINDS = new Set(Object.values(DocumentKind));

/**
 * Document / NDA signing.
 *
 * Durable-by-design: the signed artifact (signature data-URL + filled
 * fields + a sha256 tamper hash) lives in Postgres, not on the ephemeral
 * container disk. A printable view is rendered on demand from the row.
 * pdfStorageKey stays null until R2 object storage is wired.
 */
@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private orgWhere(user: JwtUser) {
    if (isSuperAdmin(user)) return {};
    return { OR: [{ orgId: (user as any).orgId ?? '__none__' }, { orgId: null }] };
  }

  // ── Templates (admin) ───────────────────────────────────────────
  listTemplates(user: JwtUser) {
    return this.prisma.documentTemplate.findMany({
      where: this.orgWhere(user),
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { documents: true } } },
    });
  }

  async createTemplate(
    user: JwtUser,
    data: { name: string; kind?: string; bodyMarkdown: string; validityDays?: number; requiresFields?: unknown },
  ) {
    if (!data?.name?.trim() || !data?.bodyMarkdown?.trim()) {
      throw new BadRequestException('name and bodyMarkdown are required');
    }
    const kind = KINDS.has(data.kind as DocumentKind) ? (data.kind as DocumentKind) : DocumentKind.NDA;
    return this.prisma.documentTemplate.create({
      data: {
        name: data.name.trim().slice(0, 160),
        kind,
        bodyMarkdown: data.bodyMarkdown,
        validityDays: data.validityDays ?? null,
        requiresFields: (data.requiresFields ?? null) as any,
        orgId: isSuperAdmin(user) ? null : ((user as any).orgId ?? null),
      },
    });
  }

  async updateTemplate(user: JwtUser, id: string, data: any) {
    await this.ensureTemplateScope(user, id);
    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        name: data.name?.slice(0, 160),
        bodyMarkdown: data.bodyMarkdown,
        validityDays: data.validityDays,
        isActive: data.isActive,
        requiresFields: data.requiresFields,
        // bump version on body change so existing signatures stay pinned
        version: data.bodyMarkdown ? { increment: 1 } : undefined,
      },
    });
  }

  // ── Send a document to a visitor ────────────────────────────────
  async send(
    user: JwtUser,
    body: { visitorId: string; templateId: string; visitId?: string },
  ) {
    const tpl = await this.ensureTemplateScope(user, body.templateId);
    const visitor = await this.prisma.visitor.findUnique({
      where: { id: body.visitorId },
      select: { id: true },
    });
    if (!visitor) throw new NotFoundException('Visitor not found');

    const signToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = tpl.validityDays
      ? new Date(Date.now() + tpl.validityDays * 86_400_000)
      : null;

    const doc = await this.prisma.visitorDocument.create({
      data: {
        visitorId: body.visitorId,
        visitId: body.visitId ?? null,
        templateId: tpl.id,
        templateVersion: tpl.version,
        signToken,
        status: DocumentStatus.PENDING,
        expiresAt,
      },
    });
    const base = process.env.PUBLIC_WEB_URL || 'https://vms-web-theta.vercel.app';
    return { id: doc.id, signUrl: `${base}/sign/${signToken}`, signToken };
  }

  listForVisitor(user: JwtUser, visitorId: string) {
    return this.prisma.visitorDocument.findMany({
      where: { visitorId },
      orderBy: { createdAt: 'desc' },
      include: { template: { select: { name: true, kind: true } } },
    });
  }

  // ── Public signing surface (no auth) ────────────────────────────
  async getByToken(token: string) {
    const doc = await this.prisma.visitorDocument.findUnique({
      where: { signToken: token },
      include: {
        template: true,
        visitor: { select: { fullName: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.expiresAt && doc.expiresAt < new Date() && doc.status === DocumentStatus.PENDING) {
      await this.prisma.visitorDocument.update({ where: { id: doc.id }, data: { status: DocumentStatus.EXPIRED } });
      doc.status = DocumentStatus.EXPIRED;
    }
    return {
      id: doc.id,
      status: doc.status,
      signerName: doc.visitor.fullName,
      template: {
        name: doc.template.name,
        kind: doc.template.kind,
        bodyMarkdown: doc.template.bodyMarkdown,
        requiresFields: doc.template.requiresFields,
      },
      signedAt: doc.signedAt,
    };
  }

  async sign(
    token: string,
    body: { signatureData: string; filledFields?: Record<string, unknown> },
    meta: { ip?: string; userAgent?: string },
  ) {
    const doc = await this.prisma.visitorDocument.findUnique({
      where: { signToken: token },
      include: { template: { select: { version: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status !== DocumentStatus.PENDING) {
      throw new BadRequestException(`Document is already ${doc.status.toLowerCase()}`);
    }
    if (doc.expiresAt && doc.expiresAt < new Date()) {
      await this.prisma.visitorDocument.update({ where: { id: doc.id }, data: { status: DocumentStatus.EXPIRED } });
      throw new BadRequestException('Document has expired');
    }
    if (!body?.signatureData || !/^data:image\//.test(body.signatureData)) {
      throw new BadRequestException('A signature image is required');
    }

    const signedAt = new Date();
    // tamper-evident hash over the canonical signed content
    const canonical = JSON.stringify({
      documentId: doc.id,
      visitorId: doc.visitorId,
      templateId: doc.templateId,
      templateVersion: doc.templateVersion,
      filledFields: body.filledFields ?? {},
      signedAt: signedAt.toISOString(),
    });
    const hash = crypto.createHash('sha256').update(canonical + body.signatureData).digest('hex');

    await this.prisma.visitorDocument.update({
      where: { id: doc.id },
      data: {
        status: DocumentStatus.SIGNED,
        signedAt,
        signatureData: body.signatureData,
        filledFields: (body.filledFields ?? {}) as any,
        ipAddress: meta.ip?.slice(0, 64) ?? null,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
        hash,
      },
    });
    return { ok: true, signedAt, hash };
  }

  async decline(token: string) {
    const doc = await this.prisma.visitorDocument.findUnique({ where: { signToken: token }, select: { id: true, status: true } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status !== DocumentStatus.PENDING) throw new BadRequestException('Document is not pending');
    await this.prisma.visitorDocument.update({ where: { id: doc.id }, data: { status: DocumentStatus.DECLINED, declinedAt: new Date() } });
    return { ok: true };
  }

  /** Admin view of a signed record incl. signature + tamper hash. */
  async detail(user: JwtUser, id: string) {
    const doc = await this.prisma.visitorDocument.findUnique({
      where: { id },
      include: { template: true, visitor: { select: { fullName: true, phone: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (!isSuperAdmin(user) && doc.template.orgId && doc.template.orgId !== (user as any).orgId) {
      throw new ForbiddenException('Document belongs to another organization');
    }
    return doc;
  }

  private async ensureTemplateScope(user: JwtUser, templateId: string) {
    const tpl = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, ...this.orgWhere(user) },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    if (!isSuperAdmin(user) && tpl.orgId === null) {
      throw new ForbiddenException('Global templates are read-only for your role');
    }
    return tpl;
  }
}
