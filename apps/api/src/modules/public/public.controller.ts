import { Body, Controller, Get, Header, NotFoundException, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PublicService } from './public.service';
import { PrismaService } from '../../platform/prisma/prisma.service';

// All routes here are intentionally unguarded — they're consumed by the
// kiosk and other public terminals. Rate limiter (global) protects them.
@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('branches')
  branches() {
    return this.publicService.listBranches();
  }

  @Get('hosts')
  hosts() {
    return this.publicService.listHosts();
  }

  @Post('walk-in')
  walkIn(@Body() body: any) {
    return this.publicService.walkIn(body);
  }

  @Post('lookup')
  lookup(@Body() body: { phone: string }) {
    return this.publicService.lookupByPhone(body?.phone ?? '');
  }

  /**
   * Returns the visitor's stored face photo as a JPEG image. Lives on
   * /public so the visitor's pass page (no auth) can render it.
   * Returns 404 if no photo was captured.
   */
  @Get('visitor/:id/photo')
  async visitorPhoto(@Param('id') id: string, @Res() res: Response) {
    const v = await this.prisma.visitor.findUnique({
      where: { id },
      select: { faceData: true },
    });
    if (!v?.faceData) throw new NotFoundException('No photo');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.isBuffer(v.faceData) ? v.faceData : Buffer.from(v.faceData));
  }
}
