import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../platform/rbac/permission.guard';
import { RequirePermission } from '../../platform/rbac/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Get('templates')
  @RequirePermission('document:template:read')
  listTemplates(@CurrentUser() user: JwtUser) {
    return this.svc.listTemplates(user);
  }

  @Post('templates')
  @RequirePermission('document:template:write')
  createTemplate(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.svc.createTemplate(user, body);
  }

  @Put('templates/:id')
  @RequirePermission('document:template:write')
  updateTemplate(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateTemplate(user, id, body);
  }

  @Post('send')
  @RequirePermission('document:send')
  send(
    @CurrentUser() user: JwtUser,
    @Body() body: { visitorId: string; templateId: string; visitId?: string },
  ) {
    return this.svc.send(user, body);
  }

  @Get('visitor/:visitorId')
  @RequirePermission('document:template:read')
  listForVisitor(@CurrentUser() user: JwtUser, @Param('visitorId') visitorId: string) {
    return this.svc.listForVisitor(user, visitorId);
  }

  @Get(':id')
  @RequirePermission('document:template:read')
  detail(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.detail(user, id);
  }
}

/**
 * Public signing surface — no auth. The signing link (/sign/:token) is the
 * only credential. Throttler (global) protects against brute force.
 */
@Controller('sign')
export class PublicSignController {
  constructor(private readonly svc: DocumentsService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.svc.getByToken(token);
  }

  @Post(':token')
  sign(
    @Param('token') token: string,
    @Body() body: { signatureData: string; filledFields?: Record<string, unknown> },
    @Req() req: Request,
  ) {
    const ip = (req.ip || (req.headers['x-forwarded-for'] as string) || '').toString();
    return this.svc.sign(token, body, { ip, userAgent: req.headers['user-agent'] });
  }

  @Post(':token/decline')
  decline(@Param('token') token: string) {
    return this.svc.decline(token);
  }
}
