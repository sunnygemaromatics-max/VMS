import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  JwtUser,
  contractorScope,
  isSuperAdmin,
  visitorScope,
  workerScope,
} from '../../common/tenant';

export interface SearchHit {
  kind: 'visitor' | 'worker' | 'contractor';
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  badge?: string;
}

/**
 * Cross-entity search, tenant-scoped. Uses case-insensitive contains —
 * fine for the per-tenant row counts here. The SearchProvider seam (swap
 * to Postgres tsvector / Meilisearch) is documented in the Phase 5 plan;
 * this is the Postgres-native implementation.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(user: JwtUser, q: string, kinds?: string[]): Promise<SearchHit[]> {
    const term = (q || '').trim();
    if (term.length < 2) return [];
    const want = (k: string) => !kinds || kinds.length === 0 || kinds.includes(k);
    const like = { contains: term, mode: 'insensitive' as const };

    const [visitors, workers, contractors] = await Promise.all([
      want('visitor')
        ? this.prisma.visitor.findMany({
            where: {
              ...(isSuperAdmin(user) ? {} : visitorScope(user)),
              OR: [
                { fullName: like },
                { phone: like },
                { email: like },
                { company: like },
                { documentNumber: like },
              ],
            },
            select: { id: true, fullName: true, phone: true, company: true, isBlacklisted: true, isVip: true },
            take: 8,
          })
        : [],
      want('worker')
        ? this.prisma.worker.findMany({
            where: {
              ...(isSuperAdmin(user) ? {} : workerScope(user)),
              OR: [{ fullName: like }, { phone: like }, { skillCategory: like }, { documentNumber: like }],
            },
            select: {
              id: true,
              fullName: true,
              skillCategory: true,
              isActive: true,
              contractor: { select: { companyName: true } },
            },
            take: 8,
          })
        : [],
      want('contractor')
        ? this.prisma.contractor.findMany({
            where: {
              ...(isSuperAdmin(user) ? {} : contractorScope(user)),
              OR: [{ companyName: like }, { gstNumber: like }],
            },
            select: { id: true, companyName: true, gstNumber: true, _count: { select: { workers: true } } },
            take: 6,
          })
        : [],
    ]);

    const hits: SearchHit[] = [];
    for (const v of visitors) {
      hits.push({
        kind: 'visitor',
        id: v.id,
        label: v.fullName,
        sublabel: [v.phone, v.company].filter(Boolean).join(' · '),
        href: '/visitors-list',
        badge: v.isBlacklisted ? 'blacklisted' : v.isVip ? 'VIP' : undefined,
      });
    }
    for (const w of workers) {
      hits.push({
        kind: 'worker',
        id: w.id,
        label: w.fullName,
        sublabel: [w.skillCategory, w.contractor?.companyName].filter(Boolean).join(' · '),
        href: '/workers',
        badge: w.isActive ? undefined : 'inactive',
      });
    }
    for (const c of contractors) {
      hits.push({
        kind: 'contractor',
        id: c.id,
        label: c.companyName,
        sublabel: `${c.gstNumber} · ${c._count.workers} workers`,
        href: '/contractors',
      });
    }
    return hits;
  }
}
