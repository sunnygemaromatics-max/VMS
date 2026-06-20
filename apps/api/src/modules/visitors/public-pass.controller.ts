import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { VisitorsService } from './visitors.service';

// Intentionally NOT guarded — visitors open this link without an account.
@Controller('pass')
export class PublicPassController {
  constructor(private readonly visitors: VisitorsService) {}

  @Get(':id')
  async pass(@Param('id') id: string) {
    const pass = await this.visitors.getPublicPass(id);
    if (!pass) throw new NotFoundException('Pass not found');
    return pass;
  }
}
