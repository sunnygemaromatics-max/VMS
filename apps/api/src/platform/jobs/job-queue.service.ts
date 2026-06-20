import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, JobsOptions, Queue, QueueEvents, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { buildRedisOptions, createRedis } from './redis.connection';

/**
 * Background job runner.
 *
 * Modes:
 *   - "queue" mode (default when REDIS_URL is set): jobs persist in Redis,
 *     workers consume them. Survives restarts, parallelizable.
 *   - "inline" mode (no REDIS_URL): handlers run on the same process,
 *     same tick — useful for local dev with no Redis. Production must
 *     have REDIS_URL.
 *
 * Names a queue once via register(); enqueue with enqueue().
 * Workers are co-located in this process today; can be moved to a
 * separate apps/ai-worker process later by importing the same registry.
 */

type Handler<T = unknown> = (data: T, job: Job<T>) => Promise<unknown>;

interface Registration<T = unknown> {
  name: string;
  handler: Handler<T>;
  concurrency: number;
  defaultOpts?: JobsOptions;
}

@Injectable()
export class JobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Jobs');
  private redis: Redis | null = null;
  private queues = new Map<string, Queue>();
  private workers: Worker[] = [];
  private events: QueueEvents[] = [];
  private registry = new Map<string, Registration>();

  onModuleInit() {
    this.redis = createRedis();
    if (!this.redis) {
      this.log.warn('inline mode active — jobs run synchronously');
    }
  }

  async onModuleDestroy() {
    await Promise.allSettled(this.workers.map((w) => w.close()));
    await Promise.allSettled(this.events.map((e) => e.close()));
    await Promise.allSettled([...this.queues.values()].map((q) => q.close()));
    if (this.redis) {
      await this.redis.quit().catch(() => {});
    }
  }

  /**
   * Register a queue + handler. Idempotent: calling twice with the same
   * name throws — each queue is owned by one module.
   */
  register<T>(name: string, handler: Handler<T>, opts?: { concurrency?: number; defaultOpts?: JobsOptions }) {
    if (this.registry.has(name)) {
      throw new Error(`JobQueue: queue "${name}" already registered`);
    }
    const reg: Registration<T> = {
      name,
      handler,
      concurrency: opts?.concurrency ?? 4,
      defaultOpts: opts?.defaultOpts,
    };
    this.registry.set(name, reg as Registration);

    if (!this.redis) return; // inline mode: no queue, no worker

    const connection = buildRedisOptions()!;
    const queue = new Queue(name, { connection });
    this.queues.set(name, queue);

    const worker = new Worker<T>(
      name,
      async (job) => handler(job.data, job),
      { connection, concurrency: reg.concurrency },
    );
    worker.on('failed', (job, err) =>
      this.log.warn(`[${name}] job ${job?.id} failed: ${err.message}`),
    );
    this.workers.push(worker as Worker);

    const events = new QueueEvents(name, { connection });
    this.events.push(events);
  }

  /**
   * Enqueue a job. In inline mode, runs the handler immediately and
   * swallows errors (mirrors BullMQ's fire-and-forget semantics).
   */
  async enqueue<T>(name: string, data: T, opts?: JobsOptions): Promise<void> {
    const reg = this.registry.get(name);
    if (!reg) {
      this.log.warn(`enqueue("${name}"): no handler registered, dropping`);
      return;
    }

    if (!this.redis) {
      // Inline mode: run on next tick so we don't block the request
      setImmediate(() => {
        Promise.resolve(reg.handler(data, { data, id: 'inline', name } as any))
          .catch((e) => this.log.warn(`[${name}] inline job failed: ${e?.message ?? e}`));
      });
      return;
    }

    const queue = this.queues.get(name)!;
    await queue.add(name, data, {
      removeOnComplete: { count: 1000, age: 3600 },
      removeOnFail: { count: 5000, age: 24 * 3600 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      ...reg.defaultOpts,
      ...opts,
    });
  }

  /**
   * Register a repeatable (cron-like) job that fires every `everyMs`.
   * BullMQ keys repeatables by name + repeat options, so calling this from
   * multiple instances is safe — only one repeat entry exists, and each
   * emitted occurrence is consumed by exactly one worker.
   *
   * No-op in inline mode (no Redis) — callers should run their own timer.
   */
  async addRepeatable(name: string, everyMs: number, data: unknown = {}): Promise<void> {
    const reg = this.registry.get(name);
    if (!reg) {
      this.log.warn(`addRepeatable("${name}"): no handler registered, skipping`);
      return;
    }
    if (!this.redis) return; // inline mode: caller drives its own interval
    const queue = this.queues.get(name)!;
    await queue.add(name, data, {
      repeat: { every: everyMs },
      removeOnComplete: true,
      removeOnFail: { count: 500 },
    });
  }

  isQueueMode(): boolean {
    return !!this.redis;
  }
}
