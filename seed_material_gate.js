const { PrismaClient, MaterialEntryType, MaterialGateStatus, MasterListStatus, VehicleMasterType } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  const branch = await prisma.branch.findFirst({
    include: { organization: true },
  });

  if (!branch) {
    throw new Error('No branch found. Seed the base organization and branch first.');
  }

  const organizationId = branch.organizationId;

  const driver = await prisma.driverMaster.upsert({
    where: {
      organizationId_licenseNumber: {
        organizationId,
        licenseNumber: 'DL-DEM-4455',
      },
    },
    update: {
      fullName: 'Ramesh Yadav',
      mobile: '9876543210',
      transporterName: 'Gem Fleet Logistics',
      policeVerification: true,
      listStatus: MasterListStatus.NORMAL,
    },
    create: {
      organizationId,
      fullName: 'Ramesh Yadav',
      mobile: '9876543210',
      licenseNumber: 'DL-DEM-4455',
      transporterName: 'Gem Fleet Logistics',
      policeVerification: true,
      listStatus: MasterListStatus.NORMAL,
    },
  });

  const vehicle = await prisma.vehicleMaster.upsert({
    where: {
      organizationId_vehicleNumber: {
        organizationId,
        vehicleNumber: 'GJ01AB1234',
      },
    },
    update: {
      transporterName: 'Gem Fleet Logistics',
      vehicleType: VehicleMasterType.TRUCK,
      listStatus: MasterListStatus.NORMAL,
    },
    create: {
      organizationId,
      vehicleNumber: 'GJ01AB1234',
      transporterName: 'Gem Fleet Logistics',
      vehicleType: VehicleMasterType.TRUCK,
      listStatus: MasterListStatus.NORMAL,
    },
  });

  const existing = await prisma.materialMovement.findFirst({
    where: {
      organizationId,
      referenceNo: 'MR-DEMO-0001',
    },
  });

  if (!existing) {
    await prisma.materialMovement.create({
      data: {
        organizationId,
        branchId: branch.id,
        entryType: MaterialEntryType.RECEIPT,
        referenceNo: 'MR-DEMO-0001',
        status: MaterialGateStatus.SECURITY_IN,
        enteredAt: new Date(),
        gateInAt: new Date(),
        vehicleMasterId: vehicle.id,
        driverMasterId: driver.id,
        vehicleNumber: vehicle.vehicleNumber,
        anprDetectedNumber: vehicle.vehicleNumber,
        anprCorrectedNumber: vehicle.vehicleNumber,
        anprConfidence: 0.91,
        driverName: driver.fullName,
        driverMobile: driver.mobile,
        driverLicenseNumber: driver.licenseNumber,
        transporterName: vehicle.transporterName,
        supplierName: 'Gem Packaging Supplier',
        poNumber: 'PO-2488',
        invoiceNumber: 'INV-2488',
        lrNumber: 'LR-2488',
        materialName: 'Packaging Film Rolls',
        quantity: 1200,
        unit: 'Kg',
        plantLocation: branch.name,
        qrToken: crypto.randomBytes(16).toString('hex'),
        createdById: 'seed',
        createdByName: 'seed',
        updatedById: 'seed',
        updatedByName: 'seed',
        events: {
          create: [
            {
              action: 'CREATED',
              notes: 'Demo material receipt seeded',
              actorId: 'seed',
              actorEmail: 'seed@local',
              actorRole: 'SUPER_ADMIN',
            },
          ],
        },
      },
    });
  }

  console.log('Material gate demo seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
