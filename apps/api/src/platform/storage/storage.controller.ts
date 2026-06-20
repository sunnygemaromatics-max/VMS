import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';

/**
 * Serves signed-URL token redemptions for the local driver.
 * R2/S3 don't hit this — they sign URLs that bypass the API entirely.
 *
 * Unguarded by design: tokens are short-lived secrets that act as bearer
 * credentials for the object. The rate limiter applies.
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('local/:token')
  async serveLocal(@Param('token') token: string, @Res() res: Response) {
    const driver = this.storage.localDriver;
    if (!driver) throw new NotFoundException();

    const entry = driver.consume(token);
    if (!entry) throw new NotFoundException();

    const buf = await driver.getBuffer(entry.key);
    if (!buf) throw new NotFoundException();

    if (entry.disposition) {
      const filename = entry.filename
        ? `; filename="${entry.filename.replace(/"/g, '')}"`
        : '';
      res.setHeader('Content-Disposition', `${entry.disposition}${filename}`);
    }
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(buf);
  }
}
