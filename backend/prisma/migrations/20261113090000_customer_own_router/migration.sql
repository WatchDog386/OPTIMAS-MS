-- Installations with the customer's own router: its details and a live photo of its label
ALTER TYPE "CapturePurpose" ADD VALUE 'ROUTER_LABEL';

ALTER TABLE "Task" ADD COLUMN "ownRouterModel" TEXT;
ALTER TABLE "Task" ADD COLUMN "ownRouterSn" TEXT;
ALTER TABLE "Task" ADD COLUMN "ownRouterMac" TEXT;
ALTER TABLE "Task" ADD COLUMN "ownRouterPhotoId" TEXT;
CREATE UNIQUE INDEX "Task_ownRouterPhotoId_key" ON "Task"("ownRouterPhotoId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownRouterPhotoId_fkey" FOREIGN KEY ("ownRouterPhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SerialUnit" ADD COLUMN "customerOwned" BOOLEAN NOT NULL DEFAULT false;
