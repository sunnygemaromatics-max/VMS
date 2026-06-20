import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client for the whole API process. Nest's DI ensures
 * a single instance per module — combined with @Global() on PrismaModule,
 * that means one connection pool across the entire app.
 *
 * Never instantiate PrismaClient directly anywhere else.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Prisma');

  constructor() {
    super({
      log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.log.log('connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
