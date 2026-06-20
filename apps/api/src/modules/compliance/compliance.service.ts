import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  JwtUser,
  contractorScope,
  isSuperAdmin,
  workerScope,
} from '../../common/tenant';

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkerCompliance(user: JwtUser, workerId: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, ...workerScope(user) },
    });
    if (!worker) return null;

    const now = new Date();
    const medicalExpired = worker.medicalExpiry < now;
    return {
      workerId: worker.id,
      fullName: worker.fullName,
      medicalStatus: medicalExpired ? 'EXPIRED' : 'VALID',
      medicalExpiry: worker.medicalExpiry,
      policeVerified: worker.policeVerified,
      documentType: worker.documentType,
      documentNumber: worker.documentNumber,
      overallCompliance:
        worker.policeVerified && !medicalExpired ? 'COMPLIANT' : 'NON_COMPLIANT',
    };
  }

  async getContractorCompliance(user: JwtUser, contractorId: string) {
    const contractor = await this.prisma.contractor.findFirst({
      where: { id: contractorId, ...contractorScope(user) },
    });
    if (!contractor) return null;

    const workers = await this.prisma.worker.findMany({ where: { contractorId } });
    const now = new Date();
    const compliantWorkers = workers.filter(
      (w: any) => w.policeVerified && w.medicalExpiry > now,
    ).length;
    const complianceScore = workers.length > 0 ? (compliantWorkers / workers.length) * 100 : 0;

    return {
      contractorId: contractor.id,
      companyName: contractor.companyName,
      gstNumber: contractor.gstNumber,
      totalWorkers: workers.length,
      compliantWorkers,
      complianceScore: Math.round(complianceScore),
      status: complianceScore >= 80 ? 'COMPLIANT' : 'WARNING',
    };
  }

  async getAllComplianceStatus(user: JwtUser) {
    const contractors = await this.prisma.contractor.findMany({
      where: contractorScope(user),
      include: { workers: true },
    });
    const now = new Date();

    return contractors.map((c: any) => {
      const compliantWorkers = c.workers.filter(
        (w: any) => w.policeVerified && w.medicalExpiry > now,
      ).length;
      const score = c.workers.length > 0 ? (compliantWorkers / c.workers.length) * 100 : 0;
      return {
        contractorId: c.id,
        companyName: c.companyName,
        totalWorkers: c.workers.length,
        compliantWorkers,
        complianceScore: Math.round(score),
        status: score >= 80 ? 'COMPLIANT' : 'WARNING',
      };
    });
  }

  async updateWorkerCompliance(user: JwtUser, workerId: string, data: any) {
    if (!isSuperAdmin(user)) {
      const w = await this.prisma.worker.findFirst({
        where: { id: workerId, ...workerScope(user) },
        select: { id: true },
      });
      if (!w) throw new NotFoundException('Worker not found');
    }
    return this.prisma.worker.update({
      where: { id: workerId },
      data: {
        policeVerified: data.policeVerified !== undefined ? data.policeVerified : undefined,
        medicalExpiry: data.medicalExpiry ? new Date(data.medicalExpiry) : undefined,
      },
    });
  }

  async getExpiringSoon(user: JwtUser, daysAhead = 30) {
    const now = new Date();
    const threshold = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

    const workers = await this.prisma.worker.findMany({
      where: { isActive: true, medicalExpiry: { lte: threshold }, ...workerScope(user) },
      include: { contractor: { select: { companyName: true } } },
      orderBy: { medicalExpiry: 'asc' },
    });

    return workers.map((w: any) => ({
      workerId: w.id,
      fullName: w.fullName,
      contractor: w.contractor.companyName,
      skillCategory: w.skillCategory,
      medicalExpiry: w.medicalExpiry,
      daysUntilExpiry: Math.floor(
        (new Date(w.medicalExpiry).getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      ),
      policeVerified: w.policeVerified,
      severity:
        new Date(w.medicalExpiry) < now
          ? 'EXPIRED'
          : new Date(w.medicalExpiry).getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000
          ? 'CRITICAL'
          : 'WARNING',
    }));
  }
}
