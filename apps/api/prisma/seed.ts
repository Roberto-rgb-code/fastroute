import {
  PrismaClient,
  UserRole,
  DriverStatus,
  VehicleStatus,
  RouteStatus,
  EventStatus,
  PriorityStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Super admin (global)
  const superHash = await bcrypt.hash('SuperAdmin123!', 12);
  const superUser = await prisma.user.upsert({
    where: { email: 'super@fastroute.local' },
    update: {},
    create: {
      email: 'super@fastroute.local',
      name: 'Super Admin',
      passwordHash: superHash,
      role: UserRole.SUPER,
    },
  });

  // Demo enterprise
  const enterprise = await prisma.enterprise.upsert({
    where: { slug: 'demo-logistica' },
    update: {},
    create: {
      name: 'Demo Logística',
      slug: 'demo-logistica',
      settings: { timezone: 'America/Mexico_City', signature_active: true, stops_wait_approval: false },
    },
  });

  const adminHash = await bcrypt.hash('Admin123!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@demo-logistica.local' },
    update: {},
    create: {
      email: 'admin@demo-logistica.local',
      name: 'Admin Demo',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      enterpriseId: enterprise.id,
    },
  });

  // Driver user + driver profile
  const driverHash = await bcrypt.hash('Driver123!', 12);
  const driverUser = await prisma.user.upsert({
    where: { email: 'conductor@demo-logistica.local' },
    update: {},
    create: {
      email: 'conductor@demo-logistica.local',
      name: 'Humberto Loyola',
      passwordHash: driverHash,
      role: UserRole.DRIVER,
      enterpriseId: enterprise.id,
    },
  });

  let driver = await prisma.driver.findFirst({ where: { userId: driverUser.id } });
  if (!driver) {
    driver = await prisma.driver.create({
      data: {
        name: 'Humberto Loyola',
        phone: '+56987254879',
        licenseId: 'A2-4451',
        status: DriverStatus.AVAILABLE,
        enterpriseId: enterprise.id,
        userId: driverUser.id,
      },
    });
  }

  let vehicle = await prisma.vehicle.findFirst({ where: { enterpriseId: enterprise.id } });
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        plate: 'CAM-101',
        name: 'Camioneta 1',
        capacity: 20,
        status: VehicleStatus.AVAILABLE,
        enterpriseId: enterprise.id,
      },
    });
  }

  let client = await prisma.client.findFirst({ where: { enterpriseId: enterprise.id } });
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: 'Supercomercio S.A.',
        contactName: 'Vicente Pérez',
        contactPhone: '+56911112222',
        deliverMinutes: 15,
        enterpriseId: enterprise.id,
        checklistItems: {
          create: [
            { label: 'Revisar carga completa', required: true, photo: true, position: 0 },
            { label: 'Verificar documentos', required: true, photo: false, position: 1 },
            { label: 'Inspección vehículo', required: false, photo: false, position: 2 },
          ],
        },
      },
    });
  }

  // Stops around Santiago
  const stopsData = [
    { label: 'Providencia 100', address: 'Av. Providencia 100', lat: -33.4265, lng: -70.6199 },
    { label: 'Las Condes 200', address: 'Av. Apoquindo 200', lat: -33.4089, lng: -70.5673 },
    { label: 'Ñuñoa 300', address: 'Av. Irarrázaval 300', lat: -33.4569, lng: -70.5975 },
    { label: 'Santiago Centro', address: 'Plaza de Armas', lat: -33.4372, lng: -70.6506 },
    { label: 'Vitacura 500', address: 'Av. Vitacura 500', lat: -33.3897, lng: -70.5478 },
  ];

  const existingStops = await prisma.stop.count({ where: { enterpriseId: enterprise.id } });
  let stops = await prisma.stop.findMany({ where: { enterpriseId: enterprise.id } });
  if (existingStops === 0) {
    for (const s of stopsData) {
      await prisma.stop.create({
        data: { ...s, enterpriseId: enterprise.id, clientId: client.id },
      });
    }
    stops = await prisma.stop.findMany({ where: { enterpriseId: enterprise.id } });
  }

  // Demo route with events
  const routeExists = await prisma.route.count({ where: { enterpriseId: enterprise.id } });
  if (routeExists === 0) {
    await prisma.route.create({
      data: {
        name: 'Ruta 1 · Camioneta 1',
        status: RouteStatus.ENROUTE,
        dateStart: new Date(),
        dateStarted: new Date(),
        enterpriseId: enterprise.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        clientId: client.id,
        totalDistance: 24500,
        totalDuration: 5400,
        events: {
          create: stops.map((s, i) => ({
            position: i + 1,
            status: i === 0 ? EventStatus.COMPLETED : EventStatus.PENDING,
            priority: i === 1 ? PriorityStatus.URGENT : PriorityStatus.NORMAL,
            stopId: s.id,
          })),
        },
        checklist: {
          create: [
            { label: 'Revisar carga completa', required: true, photo: true },
            { label: 'Verificar documentos', required: true, photo: false },
          ],
        },
      },
    });

    await prisma.driver.update({ where: { id: driver.id }, data: { status: DriverStatus.ENROUTE } });
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: VehicleStatus.ENROUTE } });
  }

  console.log('Seed OK:', {
    super: superUser.email,
    enterprise: enterprise.slug,
    driver: driverUser.email,
    stops: stops.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
