-- CreateEnum
CREATE TYPE "StockRequestType" AS ENUM ('INSTALL', 'MARK_INSTALLED', 'RETURN', 'RECOVER', 'REPORT_LOST', 'RECEIVE', 'ISSUE', 'ADJUST');

-- CreateEnum
CREATE TYPE "StockRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'STOCK_APPROVAL';

-- CreateTable
CREATE TABLE "StockRequest" (
    "id" TEXT NOT NULL,
    "type" "StockRequestType" NOT NULL,
    "status" "StockRequestStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "serialUnitId" TEXT,
    "taskId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockRequest_status_createdAt_idx" ON "StockRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StockRequest_serialUnitId_status_idx" ON "StockRequest"("serialUnitId", "status");

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

