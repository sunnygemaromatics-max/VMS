import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PutObjectInput, PutObjectResult, SignedUrlOptions, StorageDriver } from '../storage.types';

const ROOT = path.resolve(process.env.STORAGE_LOCAL_DIR || '.storage');

function safeJoin(key: string): string {
  // Reject any traversal attempt before touching the FS
  if (key.includes('..') || path.isAbsolute(key)) {
    throw new Error('storage: invalid key');
  }
  return path.join(ROOT, key);
}

/**
 * Filesystem driver. Bytes live under STORAGE_LOCAL_DIR (.storage by default).
 * Signed URLs are served by the StorageController at /storage/local/:token.
 *
 * Suitable for dev and single-node deployments. Do not use behind multiple
 * API replicas — files won't be visible across instances.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;
  private readonly log = new Logger('Storage:local');
  /** key → expiresAt epoch ms. In-memory; resets on restart. */
  private readonly tokens = new Map<string, { key: string; expiresAt: number; disposition?: string; filename?: string }>();

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const target = safeJoin(input.key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, input.body);
    return {
      key: input.key,
      size: input.body.byteLength,
      etag: crypto.createHash('md5').update(input.body).digest('hex'),
    };
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(safeJoin(key));
    } catch (e: any) {
      if (e?.code === 'ENOENT') return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(safeJoin(key));
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(safeJoin(key));
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(key: string, opts?: SignedUrlOptions): Promise<string> {
    const token = crypto.randomBytes(24).toString('base64url');
    const ttl = Math.min(opts?.expiresIn ?? 300, 3600);
    this.tokens.set(token, {
      key,
      expiresAt: Date.now() + ttl * 1000,
      disposition: opts?.disposition,
      filename: opts?.filename,
    });
    const base = process.env.PUBLIC_API_URL || '';
    return `${base}/storage/local/${token}`;
  }

  /** Used by the controller to redeem a token. Internal. */
  consume(token: string): { key: string; disposition?: string; filename?: string } | null {
    const t = this.tokens.get(token);
    if (!t) return null;
    if (Date.now() > t.expiresAt) {
      this.tokens.delete(token);
      return null;
    }
    return t;
  }
}
