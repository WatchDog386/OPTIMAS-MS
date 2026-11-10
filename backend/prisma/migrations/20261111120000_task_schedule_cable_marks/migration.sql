-- Tasks for a later day, and the drop cable's length marks
ALTER TABLE "Task" ADD COLUMN "scheduledFor" DATE;
ALTER TABLE "Task" ADD COLUMN "releasedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "dropStartM" DOUBLE PRECISION;
ALTER TABLE "Task" ADD COLUMN "dropEndM" DOUBLE PRECISION;
CREATE INDEX "Task_scheduledFor_idx" ON "Task"("scheduledFor");
