-- The office confirms a customer's own router before it goes on record
ALTER TYPE "StockRequestType" ADD VALUE 'CUSTOMER_ROUTER';
ALTER TABLE "Task" ADD COLUMN "ownRouterVerdict" TEXT;
UPDATE "Task" SET "ownRouterVerdict" = 'APPROVED' WHERE "ownRouterSn" IS NOT NULL;
