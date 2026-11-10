-- A device installed without a job: where, the technician's comments and their GPS position
ALTER TABLE "SerialUnit" ADD COLUMN "installLocation" TEXT;
ALTER TABLE "SerialUnit" ADD COLUMN "installNote" TEXT;
ALTER TABLE "SerialUnit" ADD COLUMN "installLat" DOUBLE PRECISION;
ALTER TABLE "SerialUnit" ADD COLUMN "installLng" DOUBLE PRECISION;
