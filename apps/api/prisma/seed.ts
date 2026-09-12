import {
  PrismaClient,
  UserRole,
  DriverStatus,
  VehicleStatus,
  RouteStatus,
  EventStatus,
  PriorityStatus,
  DeliverStatus,
  ExpenseStatus,
  IncidentReason,
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
      settings: {
        timezone: 'America/Mexico_City',
        signature_active: false,
        stops_wait_approval: false,
        stops_order_restriction: false,
        sms_active: true,
        whatsapp_notifications: true,
        active_membership: true,
        max_users_per_ent: 0,
        stop_tag: [
          { name: 'Prioritario', color: '#ef4444' },
          { name: 'Cobro', color: '#f59e0b' },
          { name: 'Frágil', color: '#8b5cf6' },
        ],
      },
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

  // Extra fleet for history
  const extraDrivers = [
    { name: 'Carolina Reyes', phone: '+56911223344', licenseId: 'B1-2201' },
    { name: 'Mateo Fuentes', phone: '+56955667788', licenseId: 'A3-9012' },
  ];
  const extraVehicles = [
    { plate: 'CAM-102', name: 'Camioneta 2', capacity: 18 },
    { plate: 'FUR-201', name: 'Furgón 1', capacity: 35 },
  ];
  for (const d of extraDrivers) {
    const exists = await prisma.driver.findFirst({ where: { enterpriseId: enterprise.id, name: d.name } });
    if (!exists) await prisma.driver.create({ data: { ...d, status: DriverStatus.AVAILABLE, enterpriseId: enterprise.id } });
  }
  for (const v of extraVehicles) {
    const exists = await prisma.vehicle.findFirst({ where: { enterpriseId: enterprise.id, plate: v.plate } });
    if (!exists) await prisma.vehicle.create({ data: { ...v, status: VehicleStatus.AVAILABLE, enterpriseId: enterprise.id } });
  }
  const allDrivers = await prisma.driver.findMany({ where: { enterpriseId: enterprise.id }, orderBy: { name: 'asc' } });
  const allVehicles = await prisma.vehicle.findMany({ where: { enterpriseId: enterprise.id }, orderBy: { plate: 'asc' } });

  // 14 days of demo history (deterministic pseudo-random) so charts/heatmaps have data
  const historyCount = await prisma.route.count({ where: { enterpriseId: enterprise.id, status: { in: [RouteStatus.COMPLETED, RouteStatus.FINISHED, RouteStatus.CANCELLED] } } });
  if (historyCount < 10) {
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const deliverOpts: DeliverStatus[] = [
      DeliverStatus.DELIVERED, DeliverStatus.DELIVERED, DeliverStatus.DELIVERED, DeliverStatus.DELIVERED,
      DeliverStatus.PARTIAL, DeliverStatus.NOTDELIVERED,
    ];
    const incidentReasons: IncidentReason[] = [
      IncidentReason.TRAFFIC, IncidentReason.GAS, IncidentReason.PARKING, IncidentReason.RESTAURANT, IncidentReason.WC,
    ];
    for (let dayAgo = 14; dayAgo >= 1; dayAgo--) {
      const day = new Date(); day.setUTCHours(6, 0, 0, 0); day.setUTCDate(day.getUTCDate() - dayAgo); // 00:00 UTC-6
      const weekday = ((day.getUTCDay() + 6) % 7); // Mon=0
      const routesToday = weekday >= 5 ? 1 : 2 + Math.floor(rnd() * 2);
      for (let r = 0; r < routesToday; r++) {
        const drv = allDrivers[(r + dayAgo) % allDrivers.length];
        const veh = allVehicles[(r + dayAgo) % allVehicles.length];
        const startHour = 7 + r * 3 + Math.floor(rnd() * 2);
        const start = new Date(day.getTime() + startHour * 3600e3 + Math.floor(rnd() * 40) * 60e3);
        const cancelled = rnd() < 0.08;
        const routeStops = [...stops].sort(() => rnd() - 0.5).slice(0, 3 + Math.floor(rnd() * 3));
        const kmInitial = 40000 + Math.floor(rnd() * 9000);
        const kmTrip = 25 + Math.floor(rnd() * 70);
        let cursor = start.getTime();
        const created = await prisma.route.create({
          data: {
            name: `${drv.name.split(' ')[0]} · ${veh.name}`,
            status: cancelled ? RouteStatus.CANCELLED : RouteStatus.COMPLETED,
            dateStart: start,
            dateStarted: cancelled ? null : start,
            dateEnd: cancelled ? start : new Date(start.getTime() + (2 + rnd() * 3) * 3600e3),
            cancelReason: cancelled ? 'Cliente reprogramó la entrega' : null,
            enterpriseId: enterprise.id,
            driverId: drv.id,
            vehicleId: veh.id,
            clientId: client.id,
            totalDistance: kmTrip * 1000,
            totalDuration: kmTrip * 150,
            kmInitial: cancelled ? null : kmInitial,
            gasInitial: cancelled ? null : 20 + Math.floor(rnd() * 60),
            kmFinal: cancelled ? null : kmInitial + kmTrip,
            gasFinal: cancelled ? null : 10 + Math.floor(rnd() * 40),
            events: {
              create: routeStops.map((s, i) => {
                cursor += (20 + Math.floor(rnd() * 35)) * 60e3;
                const deliver: DeliverStatus = cancelled ? DeliverStatus.PENDING : deliverOpts[Math.floor(rnd() * deliverOpts.length)];
                return {
                  position: i + 1,
                  status: cancelled ? EventStatus.PENDING : EventStatus.COMPLETED,
                  deliverStatus: deliver,
                  approved: !cancelled,
                  completedAt: cancelled ? null : new Date(cursor),
                  evLat: cancelled ? null : s.lat + (rnd() - 0.5) * 0.002,
                  evLng: cancelled ? null : s.lng + (rnd() - 0.5) * 0.002,
                  stopId: s.id,
                  evidences: cancelled ? undefined : { create: [{ url: `https://picsum.photos/seed/fr${dayAgo}${r}${i}/600/400`, approved: true }] },
                };
              }),
            },
            checklist: cancelled ? undefined : {
              create: [
                { label: 'Revisar carga completa', required: true, photo: true, done: true, photoUrl: `https://picsum.photos/seed/ck${dayAgo}${r}/600/400` },
                { label: 'Verificar documentos', required: true, photo: false, done: true },
              ],
            },
            expenses: cancelled || rnd() < 0.5 ? undefined : {
              create: [{ concept: rnd() < 0.7 ? 'Gasolina' : 'Estacionamiento', paymentType: rnd() < 0.6 ? 'Efectivo' : 'Tarjeta', amount: 200 + Math.floor(rnd() * 900), imageUrl: `https://picsum.photos/seed/exp${dayAgo}${r}/600/400`, status: rnd() < 0.7 ? ExpenseStatus.DONE : ExpenseStatus.PENDING }],
            },
            incidents: cancelled || rnd() < 0.7 ? undefined : {
              create: [{ reason: incidentReasons[Math.floor(rnd() * incidentReasons.length)], comment: 'Reportado desde la app', photos: [], lat: routeStops[0].lat, lng: routeStops[0].lng }],
            },
          },
        });
        void created;
      }
    }
  }

  // Demo route of the day (in progress) if none is open
  const openRoutes = await prisma.route.count({ where: { enterpriseId: enterprise.id, status: { in: [RouteStatus.PENDING, RouteStatus.CHECKLIST, RouteStatus.CHECKLIST_PENDING, RouteStatus.ENROUTE, RouteStatus.PAUSED] } } });
  const driverFree = (await prisma.driver.findUnique({ where: { id: driver.id } }))?.status === DriverStatus.AVAILABLE;
  const vehicleFree = (await prisma.vehicle.findUnique({ where: { id: vehicle.id } }))?.status === VehicleStatus.AVAILABLE;
  if (openRoutes === 0 && driverFree && vehicleFree) {
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
        kmInitial: 45210,
        gasInitial: 38,
        events: {
          create: stops.map((s, i) => ({
            position: i + 1,
            status: i === 0 ? EventStatus.COMPLETED : EventStatus.PENDING,
            deliverStatus: i === 0 ? DeliverStatus.DELIVERED : DeliverStatus.PENDING,
            approved: i === 0,
            completedAt: i === 0 ? new Date() : null,
            priority: i === 1 ? PriorityStatus.URGENT : PriorityStatus.NORMAL,
            stopId: s.id,
            evidences: i === 0 ? { create: [{ url: 'https://picsum.photos/seed/fastroute1/600/400', approved: true }] } : undefined,
          })),
        },
        checklist: {
          create: [
            { label: 'Revisar carga completa', required: true, photo: true, done: true, photoUrl: 'https://picsum.photos/seed/check1/600/400' },
            { label: 'Verificar documentos', required: true, photo: false, done: true },
          ],
        },
      },
    });

    await prisma.driver.update({ where: { id: driver.id }, data: { status: DriverStatus.ENROUTE } });
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: VehicleStatus.ENROUTE } });

    // A second route of the day, still pending, for another operator
    const drv2 = allDrivers.find((d) => d.id !== driver.id && d.status === DriverStatus.AVAILABLE);
    const veh2 = allVehicles.find((v) => v.id !== vehicle.id && v.status === VehicleStatus.AVAILABLE);
    if (drv2 && veh2) {
      const later = new Date(); later.setHours(later.getHours() + 2);
      await prisma.route.create({
        data: {
          name: `${drv2.name.split(' ')[0]} · ${veh2.name}`,
          status: RouteStatus.PENDING,
          dateStart: later,
          enterpriseId: enterprise.id,
          driverId: drv2.id,
          vehicleId: veh2.id,
          clientId: client.id,
          totalDistance: 18200,
          totalDuration: 3900,
          events: { create: stops.slice(0, 3).map((s, i) => ({ position: i + 1, stopId: s.id })) },
          checklist: { create: [{ label: 'Revisar carga completa', required: true, photo: true }, { label: 'Verificar documentos', required: true, photo: false }] },
        },
      });
      await prisma.driver.update({ where: { id: drv2.id }, data: { status: DriverStatus.ENROUTE } });
      await prisma.vehicle.update({ where: { id: veh2.id }, data: { status: VehicleStatus.ENROUTE } });
    }
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
