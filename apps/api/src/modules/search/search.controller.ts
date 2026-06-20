import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/tenant';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  search(
    @CurrentUser() user: JwtUser,
    @Query('q') q: string,
    @Query('kinds') kinds?: string,
  ) {
    const kindList = kinds ? kinds.split(',').map((k) => k.trim()).filter(Boolean) : undefined;
    return this.svc.search(user, q ?? '', kindList);
  }
}
