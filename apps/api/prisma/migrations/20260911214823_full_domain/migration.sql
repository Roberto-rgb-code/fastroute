-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE', 'ENROUTE', 'WORKSHOP', 'NODOCS', 'PAUSED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ENROUTE', 'WORKSHOP', 'PAUSED');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('PENDING', 'CHECKLIST', 'CHECKLIST_PENDING', 'ENROUTE', 'PAUSED', 'COMPLETED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'ROUTE', 'ISSUE', 'SERVICE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DeliverStatus" AS ENUM ('PENDING', 'DELIVERED', 'PARTIAL', 'NOTDELIVERED');

-- CreateEnum
CREATE TYPE "PriorityStatus" AS ENUM ('URGENT', 'NORMAL', 'NOTURGENT');

-- CreateTable
CREATE TABLE "driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "licenseId" TEXT,
    "photoUrl" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE',
    "enterpriseId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "name" TEXT,
    "capacity" INTEGER,
    "insurance" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "enterpriseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "pickupMinutes" INTEGER NOT NULL DEFAULT 0,
    "deliverMinutes" INTEGER NOT NULL DEFAULT 10,
    "enterpriseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stop" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "enterpriseId" TEXT NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_item" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "photo" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "polyline" TEXT,
    "totalDistance" DOUBLE PRECISION,
    "totalDuration" INTEGER,
    "enterpriseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'PENDING',
    "dateStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateStarted" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "polyline" TEXT,
    "totalDistance" DOUBLE PRECISION,
    "totalDuration" INTEGER,
    "enterpriseId" TEXT NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "clientId" TEXT,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "deliverStatus" "DeliverStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "PriorityStatus" NOT NULL DEFAULT 'NORMAL',
    "eta" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "evLat" DOUBLE PRECISION,
    "evLng" DOUBLE PRECISION,
    "comment" TEXT,
    "signatureUrl" TEXT,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'photo',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_event" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "photo" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "routeId" TEXT NOT NULL,

    CONSTRAINT "checklist_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_userId_key" ON "driver"("userId");

-- CreateIndex
CREATE INDEX "driver_enterpriseId_idx" ON "driver"("enterpriseId");

-- CreateIndex
CREATE INDEX "vehicle_enterpriseId_idx" ON "vehicle"("enterpriseId");

-- CreateIndex
CREATE INDEX "client_enterpriseId_idx" ON "client"("enterpriseId");

-- CreateIndex
CREATE INDEX "stop_enterpriseId_idx" ON "stop"("enterpriseId");

-- CreateIndex
CREATE INDEX "stop_clientId_idx" ON "stop"("clientId");

-- CreateIndex
CREATE INDEX "checklist_item_clientId_idx" ON "checklist_item"("clientId");

-- CreateIndex
CREATE INDEX "route_template_enterpriseId_idx" ON "route_template"("enterpriseId");

-- CreateIndex
CREATE INDEX "route_enterpriseId_idx" ON "route"("enterpriseId");

-- CreateIndex
CREATE INDEX "route_driverId_idx" ON "route"("driverId");

-- CreateIndex
CREATE INDEX "event_routeId_idx" ON "event"("routeId");

-- CreateIndex
CREATE INDEX "evidence_eventId_idx" ON "evidence"("eventId");

-- CreateIndex
CREATE INDEX "checklist_event_routeId_idx" ON "checklist_event"("routeId");

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop" ADD CONSTRAINT "stop_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop" ADD CONSTRAINT "stop_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_template" ADD CONSTRAINT "route_template_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route" ADD CONSTRAINT "route_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route" ADD CONSTRAINT "route_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route" ADD CONSTRAINT "route_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route" ADD CONSTRAINT "route_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route" ADD CONSTRAINT "route_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "route_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_event" ADD CONSTRAINT "checklist_event_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
