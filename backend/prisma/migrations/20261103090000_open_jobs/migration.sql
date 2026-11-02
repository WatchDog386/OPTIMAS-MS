-- Jobs can be created now and given to a technician later (status OPEN, no assignee yet)
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'OPEN' BEFORE 'ASSIGNED';
ALTER TABLE "Task" ALTER COLUMN "assigneeId" DROP NOT NULL;
