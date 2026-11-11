-- Following assigned tasks through: given, opened, reminders, office alerts, handed back
ALTER TABLE "Task" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "seenAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN "escalated" TEXT;
ALTER TABLE "Task" ADD COLUMN "returnNote" TEXT;
-- Tasks already given out count as given when they were last changed
UPDATE "Task" SET "assignedAt" = "updatedAt" WHERE "assigneeId" IS NOT NULL;
