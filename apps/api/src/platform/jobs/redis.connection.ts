import { Logger } from '@nestjs/common';
import { Redis, RedisOptions } from 'ioredis';

const log = new Logger('Redis');

/**
 * Parses REDIS_URL into ioredis options and creates a connection
 * suitable for BullMQ (maxRetriesPerRequest: null is required).
 *
 * Supports both `redis://` and `rediss://` (TLS — Upstash, ElastiCache).
 * Returns null when REDIS_URL is unset, so callers can no-op gracefully.
 */
export function buildRedisOptions(): RedisOptions | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const u = new URL(url);
  const isTls = u.protocol === 'rediss:';

  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    tls: isTls ? {} : undefined,
    // BullMQ requirement: workers + queues with blocking commands must use null
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    family: 0, // dual-stack (IPv4 + IPv6) — Upstash uses IPv6 on some regions
  };
}

export function createRedis(): Redis | null {
  const opts = buildRedisOptions();
  if (!opts) {
    log.warn('REDIS_URL unset — JobQueue running in inline mode');
    return null;
  }
  const r = new Redis(opts);
  r.on('error', (e) => log.warn(`redis: ${e.message}`));
  r.on('ready', () => log.log('connected'));
  return r;
}
