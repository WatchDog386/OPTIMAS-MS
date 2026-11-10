-- Task report details and the end-of-day report
ALTER TYPE "NotificationType" ADD VALUE 'DAY_REPORT';

ALTER TABLE "Task" ADD COLUMN "signal" TEXT;
ALTER TABLE "Task" ADD COLUMN "houseNo" TEXT;
ALTER TABLE "Task" ADD COLUMN "dropCableM" DOUBLE PRECISION;
ALTER TABLE "Task" ADD COLUMN "fatPreinstalled" BOOLEAN;

CREATE TABLE "DayReport" (
    "id" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "submittedById" TEXT NOT NULL,
    "teamId" TEXT,
    "text" TEXT NOT NULL,
    "taskIds" TEXT[],
    "tasksDone" INTEGER NOT NULL,
    "collected" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DayReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DayReport_submittedById_workDate_key" ON "DayReport"("submittedById", "workDate");
CREATE INDEX "DayReport_workDate_idx" ON "DayReport"("workDate");
ALTER TABLE "DayReport" ADD CONSTRAINT "DayReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DayReport" ADD CONSTRAINT "DayReport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
