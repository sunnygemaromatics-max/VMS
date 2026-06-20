import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController, PublicSignController } from './documents.controller';

@Module({
  controllers: [DocumentsController, PublicSignController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
