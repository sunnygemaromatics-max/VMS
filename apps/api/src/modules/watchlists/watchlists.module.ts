import { Module } from '@nestjs/common';
import { WatchlistsService } from './watchlists.service';
import { WatchlistsController } from './watchlists.controller';

@Module({
  controllers: [WatchlistsController],
  providers: [WatchlistsService],
})
export class WatchlistsModule {}
