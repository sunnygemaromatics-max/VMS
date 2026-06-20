import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';

// face-api.js embeddings are Float32Array(128). We accept them as a JSON
// array of numbers (preferred for size) or as base64-encoded bytes.
const DIM = 128;

function decodeEmbedding(input: unknown): Float32Array {
  if (Array.isArray(input)) {
    if (input.length !== DIM) {
      throw new BadRequestException(`Embedding must have ${DIM} dimensions`);
    }
    const out = new Float32Array(DIM);
    for (let i = 0; i < DIM; i++) {
      const n = Number(input[i]);
      if (!Number.isFinite(n)) throw new BadRequestException('Non-finite value in embedding');
      out[i] = n;
    }
    return out;
  }
  throw new BadRequestException('embedding must be an array of 128 numbers');
}

function bufFromFloat32(arr: Float32Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

function float32FromBuf(buf: Buffer | Uint8Array): Float32Array {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

function euclidean(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < DIM; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

@Injectable()
export class FaceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Look up a person by their face embedding. Returns nearest match if below threshold. */
  async identify(input: unknown, threshold = 0.6) {
    const q = decodeEmbedding(input);

    const [visitors, workers] = await Promise.all([
      this.prisma.visitor.findMany({
        where: { faceEmbedding: { not: null } },
        select: { id: true, fullName: true, phone: true, faceEmbedding: true, isBlacklisted: true },
      }),
      this.prisma.worker.findMany({
        where: { faceEmbedding: { not: null }, isActive: true },
        select: {
          id: true,
          fullName: true,
          phone: true,
          faceEmbedding: true,
          contractor: { select: { companyName: true } },
          medicalExpiry: true,
          policeVerified: true,
        },
      }),
    ]);

    let best: { kind: 'visitor' | 'worker'; id: string; name: string; distance: number; meta?: any } | null = null;

    for (const v of visitors) {
      if (!v.faceEmbedding) continue;
      const emb = float32FromBuf(v.faceEmbedding as Uint8Array);
      const d = euclidean(q, emb);
      if (!best || d < best.distance) {
        best = {
          kind: 'visitor',
          id: v.id,
          name: v.fullName,
          distance: d,
          meta: { phone: v.phone, isBlacklisted: v.isBlacklisted },
        };
      }
    }
    for (const w of workers) {
      if (!w.faceEmbedding) continue;
      const emb = float32FromBuf(w.faceEmbedding as Uint8Array);
      const d = euclidean(q, emb);
      if (!best || d < best.distance) {
        best = {
          kind: 'worker',
          id: w.id,
          name: w.fullName,
          distance: d,
          meta: {
            phone: w.phone,
            contractor: w.contractor.companyName,
            policeVerified: w.policeVerified,
            medicalExpiry: w.medicalExpiry,
          },
        };
      }
    }

    if (!best) {
      return { matched: false, reason: 'No enrolled faces yet' };
    }
    if (best.distance > threshold) {
      return {
        matched: false,
        reason: 'No face matched within threshold',
        bestDistance: Number(best.distance.toFixed(3)),
        threshold,
      };
    }
    return {
      matched: true,
      kind: best.kind,
      id: best.id,
      name: best.name,
      distance: Number(best.distance.toFixed(3)),
      threshold,
      meta: best.meta,
    };
  }

  /** Store / replace a face embedding for a visitor or worker. */
  async enroll(kind: 'visitor' | 'worker', id: string, embedding: unknown) {
    const q = decodeEmbedding(embedding);
    const buf = bufFromFloat32(q);
    if (kind === 'visitor') {
      return this.prisma.visitor.update({
        where: { id },
        data: { faceEmbedding: buf },
        select: { id: true, fullName: true },
      });
    }
    return this.prisma.worker.update({
      where: { id },
      data: { faceEmbedding: buf },
      select: { id: true, fullName: true },
    });
  }
}
