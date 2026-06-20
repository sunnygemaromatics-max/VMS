import { Module } from '@nestjs/common';
import { MaterialPassController } from './material-pass.controller';
import { MaterialPassService } from './material-pass.service';

@Module({
  controllers: [MaterialPassController],
  providers: [MaterialPassService],
  exports: [MaterialPassService],
})
export class MaterialPassModule {}
