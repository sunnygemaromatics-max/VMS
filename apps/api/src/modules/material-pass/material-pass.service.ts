import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PassDirection } from '@prisma/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtUser, isSuperAdmin, visitScope } from '../../common/tenant';

@Injectable()
export class MaterialPassService {
  constructor(private readonly prisma: PrismaService) {}

  /** All passes for a single visit (scoped). */
  async listForVisit(user: JwtUser, visitId: string) {
    if (!isSuperAdmin(user)) {
      const ok = await this.prisma.visit.findFirst({
        where: { id: visitId, ...visitScope(user) },
        select: { id: true },
      });
      if (!ok) throw new NotFoundException('Visit not found');
    }
    return this.prisma.materialGatePass.findMany({
      where: { visitId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Recent passes across the user's whole org. */
  async listRecent(user: JwtUser, limit = 100) {
    return this.prisma.materialGatePass.findMany({
      where: { visit: { ...visitScope(user) } } as any,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        visit: {
          select: {
            id: true,
            visitor: { select: { fullName: true, company: true } },
            branch: { select: { name: true } },
          },
        },
      },
    });
  }

  async create(
    user: JwtUser,
    data: {
      visitId: string;
      direction: 'IN' | 'OUT';
      description: string;
      quantity?: number;
      serialNumber?: string;
    },
  ) {
    if (!data.visitId || !data.description || !data.direction) {
      throw new BadRequestException('visitId, direction and description are required');
    }
    if (!isSuperAdmin(user)) {
      const ok = await this.prisma.visit.findFirst({
        where: { id: data.visitId, ...visitScope(user) },
        select: { id: true },
      });
      if (!ok) throw new NotFoundException('Visit not found');
    }
    return this.prisma.materialGatePass.create({
      data: {
        visitId: data.visitId,
        direction: PassDirection[data.direction],
        description: data.description.slice(0, 1000),
        quantity: Math.max(1, Math.min(999, data.quantity ?? 1)),
        serialNumber: data.serialNumber?.slice(0, 200) || null,
        recordedBy: user?.email ?? null,
      },
    });
  }
}
