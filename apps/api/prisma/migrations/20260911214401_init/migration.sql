-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER', 'ADMIN', 'MANAGER', 'LOGISTICS', 'DRIVER', 'EXTERNAL');

-- CreateTable
CREATE TABLE "enterprise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "enterpriseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_slug_key" ON "enterprise"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_enterpriseId_idx" ON "user"("enterpriseId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
