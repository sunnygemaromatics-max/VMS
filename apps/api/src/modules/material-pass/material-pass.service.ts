import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MasterListStatus, MaterialEntryType, MaterialGateStatus, PassDirection, Role, VehicleMasterType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtUser, isSuperAdmin, requireOrg, visitScope } from '../../common/tenant';

function normalizeVehicle(value?: string | null) {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}
function cleanText(value?: string | null, max = 255) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text.slice(0, max) : undefined;
}
function cleanDate(value?: string | Date | null) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
function parseDataField(value?: string | null) {
  if (!value) return undefined;
  const text = value.trim();
  return /^data:/i.test(text) ? text.slice(0, 4_000_000) : undefined;
}
function canOverride(user: JwtUser) {
  return user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN || user.role === Role.SECURITY_HEAD;
}
function isClosedStatus(status: MaterialGateStatus) {
  return status === MaterialGateStatus.GATE_OUT || status === MaterialGateStatus.REJECTED;
}
function isGateInStatus(status: MaterialGateStatus) {
  return status === MaterialGateStatus.SECURITY_IN || status === MaterialGateStatus.SECURITY_VERIFIED || status === MaterialGateStatus.WEIGHMENT || status === MaterialGateStatus.STORE_ACCEPTED || status === MaterialGateStatus.LOADED;
}

@Injectable()
export class MaterialPassService {
  constructor(private readonly prisma: PrismaService) {}

  private movementScope(user: JwtUser) {
    return isSuperAdmin(user) ? {} : { organizationId: requireOrg(user) };
  }

  private async ensureBranch(user: JwtUser, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: isSuperAdmin(user) ? { id: branchId } : { id: branchId, organizationId: requireOrg(user) },
      select: { id: true, name: true, location: true, organizationId: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  private movementInclude() {
    return {
      branch: { select: { id: true, name: true, location: true } },
      driverMaster: { select: { id: true, fullName: true, mobile: true, licenseNumber: true, licenseExpiry: true, listStatus: true, transporterName: true } },
      vehicleMaster: { select: { id: true, vehicleNumber: true, vehicleType: true, transporterName: true, listStatus: true, insuranceExpiry: true, pucExpiry: true, fitnessExpiry: true } },
      events: { orderBy: { createdAt: 'asc' }, take: 100 },
    } as const;
  }

  private statusOptions(entryType: MaterialEntryType) {
    return entryType === MaterialEntryType.RECEIPT
      ? [MaterialGateStatus.PENDING, MaterialGateStatus.SECURITY_IN, MaterialGateStatus.WEIGHMENT, MaterialGateStatus.STORE_ACCEPTED, MaterialGateStatus.REJECTED, MaterialGateStatus.GATE_OUT]
      : [MaterialGateStatus.PENDING, MaterialGateStatus.SECURITY_VERIFIED, MaterialGateStatus.LOADED, MaterialGateStatus.REJECTED, MaterialGateStatus.GATE_OUT];
  }

  private alerts(row: any) {
    const out: string[] = [];
    const now = new Date();
    if (row.driverMaster?.listStatus === MasterListStatus.BLACKLISTED) out.push('Driver is blacklisted');
    if (row.vehicleMaster?.listStatus === MasterListStatus.BLACKLISTED) out.push('Vehicle is blacklisted');
    if (row.driverMaster?.licenseExpiry && new Date(row.driverMaster.licenseExpiry) < now) out.push('Driver license expired');
    if (row.vehicleMaster?.insuranceExpiry && new Date(row.vehicleMaster.insuranceExpiry) < now) out.push('Vehicle insurance expired');
    if (row.vehicleMaster?.pucExpiry && new Date(row.vehicleMaster.pucExpiry) < now) out.push('Vehicle PUC expired');
    if (row.vehicleMaster?.fitnessExpiry && new Date(row.vehicleMaster.fitnessExpiry) < now) out.push('Vehicle fitness expired');
    if (row.anprDetectedNumber && row.anprCorrectedNumber && row.anprDetectedNumber !== row.anprCorrectedNumber) out.push('ANPR corrected manually');
    return out;
  }

  private mapRow(row: any) {
    return { ...row, alerts: this.alerts(row), insidePlant: !isClosedStatus(row.status) };
  }

  async listForVisit(user: JwtUser, visitId: string) {
    if (!isSuperAdmin(user)) {
      const ok = await this.prisma.visit.findFirst({ where: { id: visitId, ...visitScope(user) }, select: { id: true } });
      if (!ok) throw new NotFoundException('Visit not found');
    }
    return this.prisma.materialGatePass.findMany({ where: { visitId }, orderBy: { createdAt: 'desc' } });
  }

  async listRecent(user: JwtUser, limit = 100) {
    return this.prisma.materialGatePass.findMany({
      where: { visit: { ...visitScope(user) } } as any,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { visit: { select: { id: true, visitor: { select: { fullName: true, company: true } }, branch: { select: { name: true } } } } },
    });
  }

  async create(user: JwtUser, data: { visitId: string; direction: 'IN' | 'OUT'; description: string; quantity?: number; serialNumber?: string }) {
    if (!data.visitId || !data.description || !data.direction) throw new BadRequestException('visitId, direction and description are required');
    if (!isSuperAdmin(user)) {
      const ok = await this.prisma.visit.findFirst({ where: { id: data.visitId, ...visitScope(user) }, select: { id: true } });
      if (!ok) throw new NotFoundException('Visit not found');
    }
    return this.prisma.materialGatePass.create({ data: { visitId: data.visitId, direction: PassDirection[data.direction], description: data.description.slice(0, 1000), quantity: Math.max(1, Math.min(999, data.quantity ?? 1)), serialNumber: data.serialNumber?.slice(0, 200) || null, recordedBy: user.email ?? null } });
  }

  private async autoLinkDriver(user: JwtUser, payload: any) {
    if (payload.driverMasterId) return this.prisma.driverMaster.findFirst({ where: { id: payload.driverMasterId, ...this.movementScope(user) } });
    const mobile = cleanText(payload.driverMobile, 20);
    const licenseNumber = cleanText(payload.driverLicenseNumber, 100);
    if (!mobile && !licenseNumber) return null;
    return this.prisma.driverMaster.findFirst({ where: { ...this.movementScope(user), OR: [...(mobile ? [{ mobile }] : []), ...(licenseNumber ? [{ licenseNumber }] : [])] } });
  }

  private async autoLinkVehicle(user: JwtUser, payload: any, vehicleNumber: string) {
    if (payload.vehicleMasterId) return this.prisma.vehicleMaster.findFirst({ where: { id: payload.vehicleMasterId, ...this.movementScope(user) } });
    return this.prisma.vehicleMaster.findFirst({ where: { vehicleNumber, ...this.movementScope(user) } });
  }

  private ensureOverrideAllowed(user: JwtUser, row: { driverMaster?: any; vehicleMaster?: any }, overrideReason?: string) {
    const activeAlerts = this.alerts(row).filter((item) => item !== 'ANPR corrected manually');
    if (activeAlerts.length > 0 && !overrideReason) throw new BadRequestException(activeAlerts.join(', ') + '. Manual override reason required.');
    if (overrideReason && !canOverride(user)) throw new ForbiddenException('Only Admin or Security Head can use manual override');
    return activeAlerts;
  }

  private buildWhere(user: JwtUser, q: any) {
    const where: any = { ...this.movementScope(user) };
    if (q.from || q.to) {
      where.enteredAt = {};
      if (q.from) where.enteredAt.gte = new Date(q.from);
      if (q.to) {
        const end = new Date(q.to);
        end.setHours(23, 59, 59, 999);
        where.enteredAt.lte = end;
      }
    }
    if (q.branchId) where.branchId = q.branchId;
    if (q.entryType) where.entryType = q.entryType;
    if (q.status) where.status = q.status;
    if (q.vehicleNumber) where.vehicleNumber = normalizeVehicle(q.vehicleNumber);
    if (q.driverName) where.driverName = { contains: q.driverName, mode: 'insensitive' };
    if (q.supplierName) where.supplierName = { contains: q.supplierName, mode: 'insensitive' };
    if (q.customerName) where.customerName = { contains: q.customerName, mode: 'insensitive' };
    if (q.materialName) where.materialName = { contains: q.materialName, mode: 'insensitive' };
    if (q.transporterName) where.transporterName = { contains: q.transporterName, mode: 'insensitive' };
    if (q.location) where.plantLocation = { contains: q.location, mode: 'insensitive' };
    if (q.search) where.OR = [{ referenceNo: { contains: q.search, mode: 'insensitive' } }, { vehicleNumber: { contains: normalizeVehicle(q.search), mode: 'insensitive' } }, { driverName: { contains: q.search, mode: 'insensitive' } }, { materialName: { contains: q.search, mode: 'insensitive' } }, { invoiceNumber: { contains: q.search, mode: 'insensitive' } }, { lrNumber: { contains: q.search, mode: 'insensitive' } }];
    if (q.openOnly === 'true' || q.openOnly === true) where.status = { notIn: [MaterialGateStatus.GATE_OUT, MaterialGateStatus.REJECTED] };
    return where;
  }

  async dashboard(user: JwtUser, branchId?: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const scope: any = { ...this.movementScope(user) };
    if (branchId) scope.branchId = branchId;
    const [today, openCount, repeatDrivers] = await Promise.all([
      this.prisma.materialMovement.findMany({ where: { ...scope, enteredAt: { gte: start, lte: end } }, select: { entryType: true, quantity: true, status: true, materialName: true } }),
      this.prisma.materialMovement.count({ where: { ...scope, status: { notIn: [MaterialGateStatus.GATE_OUT, MaterialGateStatus.REJECTED] } } }),
      this.prisma.materialMovement.groupBy({ by: ['driverMobile'], where: { ...scope, enteredAt: { gte: start, lte: end } }, _count: { driverMobile: true } }),
    ]);
    return {
      cards: {
        todaysReceipts: today.filter((item) => item.entryType === MaterialEntryType.RECEIPT).length,
        todaysDispatches: today.filter((item) => item.entryType === MaterialEntryType.DISPATCH).length,
        vehiclesInsidePlant: openCount,
        pendingGateOut: today.filter((item) => !isClosedStatus(item.status)).length,
        blacklistedAlerts: 0,
        driverRepeatVisits: repeatDrivers.filter((item) => item._count.driverMobile > 1).length,
        materialQuantitySummary: today.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
      },
      materialSummary: today.reduce<Record<string, number>>((acc, item) => {
        acc[item.materialName || 'Unknown'] = (acc[item.materialName || 'Unknown'] ?? 0) + (item.quantity ?? 0);
        return acc;
      }, {}),
    };
  }

  async listEntries(user: JwtUser, q: any) {
    const rows = await this.prisma.materialMovement.findMany({ where: this.buildWhere(user, q), orderBy: { enteredAt: 'desc' }, take: Math.min(500, Number(q.limit ?? 200) || 200), include: this.movementInclude() });
    return rows.map((row) => this.mapRow(row));
  }

  async getEntry(user: JwtUser, id: string) {
    const row = await this.prisma.materialMovement.findFirst({ where: { id, ...this.movementScope(user) }, include: this.movementInclude() });
    if (!row) throw new NotFoundException('Material entry not found');
    return this.mapRow(row);
  }

  async lookup(user: JwtUser, q: any) {
    const vehicleNumber = q.vehicleNumber ? normalizeVehicle(q.vehicleNumber) : '';
    const [vehicle, driverByMobile, driverByLicense, openEntry] = await Promise.all([
      vehicleNumber ? this.prisma.vehicleMaster.findFirst({ where: { vehicleNumber, ...this.movementScope(user) } }) : Promise.resolve(null),
      q.mobile ? this.prisma.driverMaster.findFirst({ where: { mobile: q.mobile, ...this.movementScope(user) } }) : Promise.resolve(null),
      q.licenseNumber ? this.prisma.driverMaster.findFirst({ where: { licenseNumber: q.licenseNumber, ...this.movementScope(user) } }) : Promise.resolve(null),
      vehicleNumber ? this.prisma.materialMovement.findFirst({ where: { vehicleNumber, ...this.movementScope(user), status: { notIn: [MaterialGateStatus.GATE_OUT, MaterialGateStatus.REJECTED] } }, orderBy: { enteredAt: 'desc' }, include: { branch: { select: { name: true } } } }) : Promise.resolve(null),
    ]);
    return { vehicle, driver: driverByMobile ?? driverByLicense, openEntry };
  }

  async listDrivers(user: JwtUser, q: any) {
    const rows = await this.prisma.driverMaster.findMany({ where: { ...this.movementScope(user), ...(q.search ? { OR: [{ fullName: { contains: q.search, mode: 'insensitive' } }, { mobile: { contains: q.search, mode: 'insensitive' } }, { licenseNumber: { contains: q.search, mode: 'insensitive' } }, { transporterName: { contains: q.search, mode: 'insensitive' } }] } : {}) }, include: { _count: { select: { movements: true } } }, orderBy: { updatedAt: 'desc' }, take: 200 });
    return Promise.all(rows.map(async (row) => ({ ...row, linkedVehicleNumbers: (await this.prisma.materialMovement.findMany({ where: { driverMasterId: row.id }, select: { vehicleNumber: true }, distinct: ['vehicleNumber'], take: 20 })).map((item) => item.vehicleNumber) })));
  }

  async createDriver(user: JwtUser, data: any) {
    const orgId = isSuperAdmin(user) ? cleanText(data.organizationId, 100) : requireOrg(user);
    if (!orgId) throw new BadRequestException('organizationId is required');
    if (!cleanText(data.fullName) || !cleanText(data.mobile, 20) || !cleanText(data.licenseNumber, 100)) throw new BadRequestException('Name, mobile and license number are required');
    return this.prisma.driverMaster.create({ data: { organizationId: orgId, fullName: cleanText(data.fullName, 255)!, mobile: cleanText(data.mobile, 20)!, licenseNumber: cleanText(data.licenseNumber, 100)!, licenseExpiry: cleanDate(data.licenseExpiry), address: cleanText(data.address, 1000), photoData: parseDataField(data.photoData), idProofData: parseDataField(data.idProofData), policeVerification: !!data.policeVerification, listStatus: data.listStatus === 'BLACKLISTED' ? MasterListStatus.BLACKLISTED : data.listStatus === 'WHITELISTED' ? MasterListStatus.WHITELISTED : MasterListStatus.NORMAL, transporterName: cleanText(data.transporterName, 255), notes: cleanText(data.notes, 1000) } });
  }

  async updateDriver(user: JwtUser, id: string, data: any) {
    const row = await this.prisma.driverMaster.findFirst({ where: { id, ...this.movementScope(user) } });
    if (!row) throw new NotFoundException('Driver not found');
    return this.prisma.driverMaster.update({ where: { id }, data: { fullName: cleanText(data.fullName, 255) ?? row.fullName, mobile: cleanText(data.mobile, 20) ?? row.mobile, licenseNumber: cleanText(data.licenseNumber, 100) ?? row.licenseNumber, licenseExpiry: data.licenseExpiry !== undefined ? cleanDate(data.licenseExpiry) ?? null : row.licenseExpiry, address: cleanText(data.address, 1000) ?? row.address, photoData: parseDataField(data.photoData) ?? row.photoData, idProofData: parseDataField(data.idProofData) ?? row.idProofData, policeVerification: data.policeVerification !== undefined ? !!data.policeVerification : row.policeVerification, listStatus: data.listStatus === 'BLACKLISTED' ? MasterListStatus.BLACKLISTED : data.listStatus === 'WHITELISTED' ? MasterListStatus.WHITELISTED : data.listStatus === 'NORMAL' ? MasterListStatus.NORMAL : row.listStatus, transporterName: cleanText(data.transporterName, 255) ?? row.transporterName, notes: cleanText(data.notes, 1000) ?? row.notes } });
  }

  async listVehicles(user: JwtUser, q: any) {
    return this.prisma.vehicleMaster.findMany({ where: { ...this.movementScope(user), ...(q.search ? { OR: [{ vehicleNumber: { contains: normalizeVehicle(q.search), mode: 'insensitive' } }, { ownerName: { contains: q.search, mode: 'insensitive' } }, { transporterName: { contains: q.search, mode: 'insensitive' } }] } : {}) }, include: { _count: { select: { movements: true } } }, orderBy: { updatedAt: 'desc' }, take: 200 });
  }

  async createVehicle(user: JwtUser, data: any) {
    const orgId = isSuperAdmin(user) ? cleanText(data.organizationId, 100) : requireOrg(user);
    if (!orgId) throw new BadRequestException('organizationId is required');
    const vehicleNumber = normalizeVehicle(data.vehicleNumber);
    if (!vehicleNumber) throw new BadRequestException('Vehicle number is required');
    return this.prisma.vehicleMaster.create({ data: { organizationId: orgId, vehicleNumber, ownerName: cleanText(data.ownerName, 255), transporterName: cleanText(data.transporterName, 255), vehicleType: VehicleMasterType[data.vehicleType as keyof typeof VehicleMasterType] ?? VehicleMasterType.TRUCK, rcDocumentData: parseDataField(data.rcDocumentData), insuranceExpiry: cleanDate(data.insuranceExpiry), pucExpiry: cleanDate(data.pucExpiry), fitnessExpiry: cleanDate(data.fitnessExpiry), listStatus: data.listStatus === 'BLACKLISTED' ? MasterListStatus.BLACKLISTED : data.listStatus === 'WHITELISTED' ? MasterListStatus.WHITELISTED : MasterListStatus.NORMAL, notes: cleanText(data.notes, 1000) } });
  }

  async updateVehicle(user: JwtUser, id: string, data: any) {
    const row = await this.prisma.vehicleMaster.findFirst({ where: { id, ...this.movementScope(user) } });
    if (!row) throw new NotFoundException('Vehicle not found');
    return this.prisma.vehicleMaster.update({ where: { id }, data: { vehicleNumber: data.vehicleNumber ? normalizeVehicle(data.vehicleNumber) : row.vehicleNumber, ownerName: cleanText(data.ownerName, 255) ?? row.ownerName, transporterName: cleanText(data.transporterName, 255) ?? row.transporterName, vehicleType: VehicleMasterType[data.vehicleType as keyof typeof VehicleMasterType] ?? row.vehicleType, rcDocumentData: parseDataField(data.rcDocumentData) ?? row.rcDocumentData, insuranceExpiry: data.insuranceExpiry !== undefined ? cleanDate(data.insuranceExpiry) ?? null : row.insuranceExpiry, pucExpiry: data.pucExpiry !== undefined ? cleanDate(data.pucExpiry) ?? null : row.pucExpiry, fitnessExpiry: data.fitnessExpiry !== undefined ? cleanDate(data.fitnessExpiry) ?? null : row.fitnessExpiry, listStatus: data.listStatus === 'BLACKLISTED' ? MasterListStatus.BLACKLISTED : data.listStatus === 'WHITELISTED' ? MasterListStatus.WHITELISTED : data.listStatus === 'NORMAL' ? MasterListStatus.NORMAL : row.listStatus, notes: cleanText(data.notes, 1000) ?? row.notes } });
  }

  async createEntry(user: JwtUser, data: any) {
    const entryType = MaterialEntryType[data.entryType as keyof typeof MaterialEntryType] ?? MaterialEntryType.RECEIPT;
    const branch = await this.ensureBranch(user, data.branchId);
    const vehicleNumber = normalizeVehicle(data.anprCorrectedNumber || data.vehicleNumber || data.anprDetectedNumber);
    if (!vehicleNumber) throw new BadRequestException('Vehicle number is required');
    if (!cleanText(data.driverName) || !cleanText(data.driverMobile) || !cleanText(data.driverLicenseNumber) || !cleanText(data.materialName) || !cleanText(data.unit)) throw new BadRequestException('Driver details, material name and unit are required');
    const existingOpen = await this.prisma.materialMovement.findFirst({ where: { ...this.movementScope(user), vehicleNumber, status: { notIn: [MaterialGateStatus.GATE_OUT, MaterialGateStatus.REJECTED] } }, select: { id: true, referenceNo: true } });
    if (existingOpen) throw new BadRequestException('Vehicle already has an open entry: ' + existingOpen.referenceNo);

    let driver = await this.autoLinkDriver(user, data);
    let vehicle = await this.autoLinkVehicle(user, data, vehicleNumber);
    if (!driver) driver = await this.createDriver(user, { fullName: data.driverName, mobile: data.driverMobile, licenseNumber: data.driverLicenseNumber, transporterName: data.transporterName, policeVerification: !!data.policeVerification, organizationId: branch.organizationId, photoData: data.driverPhotoData, idProofData: data.driverIdProofData, address: data.driverAddress, licenseExpiry: data.driverLicenseExpiry, listStatus: data.driverListStatus });
    if (!vehicle) vehicle = await this.createVehicle(user, { organizationId: branch.organizationId, vehicleNumber, transporterName: data.transporterName, ownerName: data.ownerName, vehicleType: data.vehicleType, rcDocumentData: data.rcDocumentData, insuranceExpiry: data.insuranceExpiry, pucExpiry: data.pucExpiry, fitnessExpiry: data.fitnessExpiry, listStatus: data.vehicleListStatus });

    const shadow = { driverMaster: driver, vehicleMaster: vehicle };
    const overrideReason = cleanText(data.manualOverrideReason, 1000);
    const alerts = this.ensureOverrideAllowed(user, shadow, overrideReason);
    const status = MaterialGateStatus[data.status as keyof typeof MaterialGateStatus] ?? MaterialGateStatus.PENDING;
    if ((this.statusOptions(entryType) as MaterialGateStatus[]).indexOf(status) === -1) throw new BadRequestException('Invalid workflow status for this entry type');
    const beforePhoto = parseDataField(data.beforePhotoData);
    const afterPhoto = parseDataField(data.afterPhotoData);
    const detectedNumber = cleanText(data.anprDetectedNumber ? normalizeVehicle(data.anprDetectedNumber) : undefined, 50);
    const correctedNumber = cleanText(data.anprCorrectedNumber ? normalizeVehicle(data.anprCorrectedNumber) : vehicleNumber, 50);

    const created = await this.prisma.materialMovement.create({
      data: {
        organizationId: branch.organizationId,
        branchId: branch.id,
        entryType,
        referenceNo: (entryType === MaterialEntryType.RECEIPT ? 'MR-' : 'MD-') + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        status,
        enteredAt: new Date(),
        gateInAt: isGateInStatus(status) ? new Date() : null,
        gateOutAt: status === MaterialGateStatus.GATE_OUT ? new Date() : null,
        vehicleMasterId: vehicle.id,
        driverMasterId: driver.id,
        vehicleNumber,
        anprDetectedNumber: detectedNumber ?? null,
        anprCorrectedNumber: correctedNumber ?? null,
        anprConfidence: data.anprConfidence != null ? parseFloat(String(data.anprConfidence)) : null,
        anprImageData: parseDataField(data.anprImageData),
        driverName: cleanText(data.driverName, 255)!,
        driverMobile: cleanText(data.driverMobile, 20)!,
        driverLicenseNumber: cleanText(data.driverLicenseNumber, 100)!,
        driverPhotoData: parseDataField(data.driverPhotoData),
        transporterName: cleanText(data.transporterName, 255),
        supplierName: cleanText(data.supplierName, 255),
        customerName: cleanText(data.customerName, 255),
        poNumber: cleanText(data.poNumber, 100),
        invoiceNumber: cleanText(data.invoiceNumber, 100),
        deliveryChallanNo: cleanText(data.deliveryChallanNo, 100),
        lrNumber: cleanText(data.lrNumber, 100),
        materialName: cleanText(data.materialName, 255)!,
        materialCategory: cleanText(data.materialCategory, 100),
        quantity: Number(data.quantity ?? 0),
        unit: cleanText(data.unit, 30)!,
        plantLocation: cleanText(data.plantLocation, 255),
        destination: cleanText(data.destination, 255),
        approvedBy: cleanText(data.approvedBy, 255),
        securityRemarks: cleanText(data.securityRemarks, 1000),
        storeRemarks: cleanText(data.storeRemarks, 1000),
        dispatchRemarks: cleanText(data.dispatchRemarks, 1000),
        beforePhotoData: beforePhoto,
        beforePhotoTakenAt: beforePhoto ? new Date() : null,
        beforePhotoTakenBy: beforePhoto ? user.email : null,
        afterPhotoData: afterPhoto,
        afterPhotoTakenAt: afterPhoto ? new Date() : null,
        afterPhotoTakenBy: afterPhoto ? user.email : null,
        manualOverrideReason: overrideReason,
        qrToken: crypto.randomBytes(16).toString('hex'),
        createdById: user.userId,
        createdByName: user.email,
        updatedById: user.userId,
        updatedByName: user.email,
        events: { create: [{ action: 'CREATED', notes: entryType + ' created', actorId: user.userId, actorEmail: user.email, actorRole: user.role }, ...(alerts.length ? [{ action: 'ALERT_ACKNOWLEDGED', notes: alerts.join(', '), actorId: user.userId, actorEmail: user.email, actorRole: user.role }] : []), ...(detectedNumber && correctedNumber && detectedNumber !== correctedNumber ? [{ action: 'ANPR_CORRECTED', fieldName: 'vehicleNumber', oldValue: detectedNumber, newValue: correctedNumber, actorId: user.userId, actorEmail: user.email, actorRole: user.role }] : [])] },
      },
      include: this.movementInclude(),
    });
    return this.mapRow(created);
  }

  async updateEntry(user: JwtUser, id: string, data: any) {
    const current = await this.prisma.materialMovement.findFirst({ where: { id, ...this.movementScope(user) }, include: this.movementInclude() });
    if (!current) throw new NotFoundException('Material entry not found');
    const vehicleNumber = normalizeVehicle(data.anprCorrectedNumber || data.vehicleNumber || current.vehicleNumber);
    const driver = (await this.autoLinkDriver(user, { ...current, ...data })) ?? current.driverMaster;
    const vehicle = (await this.autoLinkVehicle(user, data, vehicleNumber)) ?? current.vehicleMaster;
    const overrideReason = cleanText(data.manualOverrideReason, 1000) ?? current.manualOverrideReason ?? undefined;
    const alerts = this.ensureOverrideAllowed(user, { driverMaster: driver, vehicleMaster: vehicle }, overrideReason);
    const beforePhoto = parseDataField(data.beforePhotoData) ?? current.beforePhotoData;
    const afterPhoto = parseDataField(data.afterPhotoData) ?? current.afterPhotoData;
    const patch: any = { vehicleMasterId: vehicle?.id ?? current.vehicleMasterId, driverMasterId: driver?.id ?? current.driverMasterId, vehicleNumber, anprDetectedNumber: cleanText(data.anprDetectedNumber ? normalizeVehicle(data.anprDetectedNumber) : current.anprDetectedNumber, 50) ?? null, anprCorrectedNumber: cleanText(data.anprCorrectedNumber ? normalizeVehicle(data.anprCorrectedNumber) : current.anprCorrectedNumber || vehicleNumber, 50) ?? null, driverName: cleanText(data.driverName, 255) ?? current.driverName, driverMobile: cleanText(data.driverMobile, 20) ?? current.driverMobile, driverLicenseNumber: cleanText(data.driverLicenseNumber, 100) ?? current.driverLicenseNumber, transporterName: cleanText(data.transporterName, 255) ?? current.transporterName, supplierName: cleanText(data.supplierName, 255) ?? current.supplierName, customerName: cleanText(data.customerName, 255) ?? current.customerName, poNumber: cleanText(data.poNumber, 100) ?? current.poNumber, invoiceNumber: cleanText(data.invoiceNumber, 100) ?? current.invoiceNumber, deliveryChallanNo: cleanText(data.deliveryChallanNo, 100) ?? current.deliveryChallanNo, lrNumber: cleanText(data.lrNumber, 100) ?? current.lrNumber, materialName: cleanText(data.materialName, 255) ?? current.materialName, materialCategory: cleanText(data.materialCategory, 100) ?? current.materialCategory, quantity: data.quantity != null ? Number(data.quantity) : current.quantity, unit: cleanText(data.unit, 30) ?? current.unit, plantLocation: cleanText(data.plantLocation, 255) ?? current.plantLocation, destination: cleanText(data.destination, 255) ?? current.destination, approvedBy: cleanText(data.approvedBy, 255) ?? current.approvedBy, securityRemarks: cleanText(data.securityRemarks, 1000) ?? current.securityRemarks, storeRemarks: cleanText(data.storeRemarks, 1000) ?? current.storeRemarks, dispatchRemarks: cleanText(data.dispatchRemarks, 1000) ?? current.dispatchRemarks, beforePhotoData: beforePhoto, afterPhotoData: afterPhoto, manualOverrideReason: overrideReason ?? null, updatedById: user.userId, updatedByName: user.email };
    if (parseDataField(data.beforePhotoData) && !current.beforePhotoTakenAt) { patch.beforePhotoTakenAt = new Date(); patch.beforePhotoTakenBy = user.email; }
    if (parseDataField(data.afterPhotoData)) { patch.afterPhotoTakenAt = new Date(); patch.afterPhotoTakenBy = user.email; }
    const updated = await this.prisma.materialMovement.update({ where: { id }, data: { ...patch, events: { create: [{ action: 'UPDATED', notes: alerts.join(', ') || 'Entry updated', actorId: user.userId, actorEmail: user.email, actorRole: user.role }] } }, include: this.movementInclude() });
    return this.mapRow(updated);
  }

  async updateStatus(user: JwtUser, id: string, data: any) {
    const current = await this.prisma.materialMovement.findFirst({ where: { id, ...this.movementScope(user) }, include: this.movementInclude() });
    if (!current) throw new NotFoundException('Material entry not found');
    const status = MaterialGateStatus[data.status as keyof typeof MaterialGateStatus];
    if (!status || (this.statusOptions(current.entryType) as MaterialGateStatus[]).indexOf(status) === -1) throw new BadRequestException('Invalid status');
    const overrideReason = cleanText(data.manualOverrideReason, 1000) ?? current.manualOverrideReason ?? undefined;
    this.ensureOverrideAllowed(user, current, overrideReason);
    const afterPhotoData = parseDataField(data.afterPhotoData) ?? current.afterPhotoData;
    if (status === MaterialGateStatus.GATE_OUT && !afterPhotoData) throw new BadRequestException('Final gate out requires a closing truck photo');
    const updated = await this.prisma.materialMovement.update({ where: { id }, data: { status, gateInAt: !current.gateInAt && isGateInStatus(status) ? new Date() : current.gateInAt, gateOutAt: status === MaterialGateStatus.GATE_OUT ? new Date() : current.gateOutAt, afterPhotoData, afterPhotoTakenAt: parseDataField(data.afterPhotoData) ? new Date() : current.afterPhotoTakenAt, afterPhotoTakenBy: parseDataField(data.afterPhotoData) ? user.email : current.afterPhotoTakenBy, securityRemarks: cleanText(data.securityRemarks, 1000) ?? current.securityRemarks, storeRemarks: cleanText(data.storeRemarks, 1000) ?? current.storeRemarks, dispatchRemarks: cleanText(data.dispatchRemarks, 1000) ?? current.dispatchRemarks, manualOverrideReason: overrideReason ?? null, updatedById: user.userId, updatedByName: user.email, events: { create: [{ action: 'STATUS_UPDATED', fieldName: 'status', oldValue: current.status, newValue: status, notes: cleanText(data.notes, 1000), actorId: user.userId, actorEmail: user.email, actorRole: user.role }] } }, include: this.movementInclude() });
    return this.mapRow(updated);
  }

  async report(user: JwtUser, q: any) {
    const rows = await this.prisma.materialMovement.findMany({ where: this.buildWhere(user, q), orderBy: { enteredAt: 'desc' }, take: 1000, include: { branch: { select: { name: true, location: true } }, driverMaster: { select: { listStatus: true, licenseExpiry: true } }, vehicleMaster: { select: { listStatus: true, insuranceExpiry: true, pucExpiry: true, fitnessExpiry: true } } } });
    const mapped = rows.map((row) => { const alerts = this.alerts(row); return { referenceNo: row.referenceNo, entryType: row.entryType, status: row.status, enteredAt: row.enteredAt, gateInAt: row.gateInAt, gateOutAt: row.gateOutAt, vehicleNumber: row.vehicleNumber, driverName: row.driverName, driverMobile: row.driverMobile, supplierName: row.supplierName ?? '—', customerName: row.customerName ?? '—', materialName: row.materialName, quantity: row.quantity, unit: row.unit, transporterName: row.transporterName ?? '—', location: row.plantLocation ?? row.branch?.name ?? '—', branch: row.branch?.name ?? '—', destination: row.destination ?? '—', approvedBy: row.approvedBy ?? '—', alerts: alerts.join('; ') || '—', blacklistedAttempt: alerts.some((item) => item.toLowerCase().includes('blacklisted')) ? 'Yes' : 'No' }; });
    return { totals: { count: mapped.length, receipts: mapped.filter((row) => row.entryType === MaterialEntryType.RECEIPT).length, dispatches: mapped.filter((row) => row.entryType === MaterialEntryType.DISPATCH).length, openEntries: mapped.filter((row) => !isClosedStatus(row.status as MaterialGateStatus)).length, blacklistedAttempts: mapped.filter((row) => row.blacklistedAttempt === 'Yes').length, quantity: mapped.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0) }, rows: mapped };
  }
}


