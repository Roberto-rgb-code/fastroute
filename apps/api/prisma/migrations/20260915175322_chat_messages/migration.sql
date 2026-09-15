-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('ADMIN', 'DRIVER');

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "enterpriseId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "userId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_routeId_idx" ON "message"("routeId");

-- CreateIndex
CREATE INDEX "message_enterpriseId_idx" ON "message"("enterpriseId");

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
