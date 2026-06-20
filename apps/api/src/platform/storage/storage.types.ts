export interface PutObjectInput {
  /** Logical key. Drivers may prefix it with a tenant or env namespace. */
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  /** Optional cache directive for HTTP responses (CDN/Edge). */
  cacheControl?: string;
  /** Optional file metadata stored alongside the object. */
  metadata?: Record<string, string>;
}

export interface PutObjectResult {
  key: string;
  size: number;
  etag?: string;
}

export interface SignedUrlOptions {
  /** Seconds until the URL expires. Capped per driver. */
  expiresIn?: number;
  /** Override content-disposition for downloads. */
  disposition?: 'inline' | 'attachment';
  filename?: string;
}

/**
 * Driver-agnostic blob storage. Used by face photos, badge/NDA PDFs,
 * video clips. Drivers: local (dev), r2 (prod).
 *
 * Keys are storage-relative — never include a bucket or hostname.
 * Treat keys like file paths: "visitors/{id}/face.jpg", "clips/{cameraId}/{ts}.mp4".
 */
export interface StorageDriver {
  readonly name: 'local' | 'r2' | 's3';
  put(input: PutObjectInput): Promise<PutObjectResult>;
  getBuffer(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /**
   * Returns a URL the client can fetch directly. For local driver this
   * is a path through the API; for R2/S3 it's a signed URL.
   */
  signedUrl(key: string, opts?: SignedUrlOptions): Promise<string>;
}
