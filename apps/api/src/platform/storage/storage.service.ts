import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LocalStorageDriver } from './drivers/local.driver';
import { R2StorageDriver } from './drivers/r2.driver';
import { PutObjectInput, PutObjectResult, SignedUrlOptions, StorageDriver } from './storage.types';

/**
 * Driver-agnostic storage. Driver chosen by STORAGE_DRIVER env:
 *   "local" → on-disk under STORAGE_LOCAL_DIR (default)
 *   "r2"    → Cloudflare R2 (requires R2_* env vars)
 *
 * Adding a new backend = implement StorageDriver and register here.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger('Storage');
  private driver!: StorageDriver;

  onModuleInit() {
    const name = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
    switch (name) {
      case 'r2':
      case 's3':
        this.driver = new R2StorageDriver();
        break;
      case 'local':
      default:
        this.driver = new LocalStorageDriver();
    }
    this.log.log(`driver=${this.driver.name}`);
  }

  /** Exposed so the LocalStorageController can redeem tokens. */
  get localDriver(): LocalStorageDriver | null {
    return this.driver instanceof LocalStorageDriver ? this.driver : null;
  }

  driverName(): StorageDriver['name'] {
    return this.driver.name;
  }

  put(input: PutObjectInput): Promise<PutObjectResult> {
    return this.driver.put(input);
  }

  getBuffer(key: string): Promise<Buffer | null> {
    return this.driver.getBuffer(key);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }

  exists(key: string): Promise<boolean> {
    return this.driver.exists(key);
  }

  signedUrl(key: string, opts?: SignedUrlOptions): Promise<string> {
    return this.driver.signedUrl(key, opts);
  }
}
