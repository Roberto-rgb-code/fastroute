-- CreateEnum
CREATE TYPE "StopType" AS ENUM ('VISIT', 'GAS', 'PARKING', 'CEDIS', 'MAIN', 'WORKSHOP');

-- CreateEnum
CREATE TYPE "IncidentReason" AS ENUM ('CAR_ACCIDENT', 'HOSPITAL', 'WC', 'RESTAURANT', 'PARKING', 'TRAFFIC', 'GAS', 'ROBBERY', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'DONE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DriverStatus" ADD VALUE 'CHECKLIST';
ALTER TYPE "DriverStatus" ADD VALUE 'CHECKLIST_PENDING';
ALTER TYPE "DriverStatus" ADD VALUE 'UNAVAILABLE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VehicleStatus" ADD VALUE 'CHECKLIST';
ALTER TYPE "VehicleStatus" ADD VALUE 'CHECKLIST_PENDING';
ALTER TYPE "VehicleStatus" ADD VALUE 'UNAVAILABLE';

-- AlterTable
ALTER TABLE "driver" ADD COLUMN     "idDocExpiry" TIMESTAMP(3),
ADD COLUMN     "licenseExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "route" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "finalImg" TEXT,
ADD COLUMN     "finalLat" DOUBLE PRECISION,
ADD COLUMN     "finalLng" DOUBLE PRECISION,
ADD COLUMN     "gasFinal" DOUBLE PRECISION,
ADD COLUMN     "gasInitial" DOUBLE PRECISION,
ADD COLUMN     "kmFinal" DOUBLE PRECISION,
ADD COLUMN     "kmInitial" DOUBLE PRECISION,
ADD COLUMN     "startLat" DOUBLE PRECISION,
ADD COLUMN     "startLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "route_template" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "stop" ADD COLUMN     "commentDriver" TEXT,
ADD COLUMN     "commentInternal" TEXT,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneNotification" TEXT,
ADD COLUMN     "schedule" TEXT,
ADD COLUMN     "tag" TEXT,
ADD COLUMN     "tagColor" TEXT,
ADD COLUMN     "type" "StopType" NOT NULL DEFAULT 'VISIT';

-- CreateTable
CREATE TABLE "template_stop" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,

    CONSTRAINT "template_stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "imageUrl" TEXT NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "routeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident" (
    "id" TEXT NOT NULL,
    "reason" "IncidentReason" NOT NULL,
    "comment" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "routeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_stop_templateId_idx" ON "template_stop"("templateId");

-- CreateIndex
CREATE INDEX "expense_routeId_idx" ON "expense"("routeId");

-- CreateIndex
CREATE INDEX "incident_routeId_idx" ON "incident"("routeId");

-- CreateIndex
CREATE INDEX "route_vehicleId_idx" ON "route"("vehicleId");

-- AddForeignKey
ALTER TABLE "route_template" ADD CONSTRAINT "route_template_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_stop" ADD CONSTRAINT "template_stop_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "route_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_stop" ADD CONSTRAINT "template_stop_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
