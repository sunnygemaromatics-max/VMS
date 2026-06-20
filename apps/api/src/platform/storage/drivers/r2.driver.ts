import { Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectInput, PutObjectResult, SignedUrlOptions, StorageDriver } from '../storage.types';

/**
 * Cloudflare R2 driver — S3-compatible. Same interface works for AWS S3
 * by pointing the endpoint at AWS.
 *
 * Required env vars:
 *   R2_ENDPOINT              https://<accountid>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET                bucket name
 *   R2_PUBLIC_BASE_URL       optional — custom public CDN base for public assets
 */
export class R2StorageDriver implements StorageDriver {
  readonly name = 'r2' as const;
  private readonly log = new Logger('Storage:r2');
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase?: string;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('R2 driver: missing R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET');
    }
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // R2 + many S3-compatible vendors require this
    });
    this.bucket = bucket;
    this.publicBase = process.env.R2_PUBLIC_BASE_URL || undefined;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const res = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
        Metadata: input.metadata,
      }),
    );
    return {
      key: input.key,
      size: input.body.byteLength,
      etag: res.ETag?.replace(/"/g, ''),
    };
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const body = res.Body as any;
      if (!body) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (e: any) {
      if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (e: any) {
      if (e?.$metadata?.httpStatusCode === 404) return false;
      throw e;
    }
  }

  async signedUrl(key: string, opts?: SignedUrlOptions): Promise<string> {
    const expiresIn = Math.min(opts?.expiresIn ?? 300, 7 * 24 * 3600);

    // If the bucket is fronted by a public CDN and no disposition is forced,
    // skip signing — faster, cacheable, no per-request crypto.
    if (this.publicBase && !opts?.disposition) {
      return `${this.publicBase.replace(/\/$/, '')}/${key}`;
    }

    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: opts?.disposition
        ? `${opts.disposition}${opts.filename ? `; filename="${opts.filename}"` : ''}`
        : undefined,
    });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }
}
