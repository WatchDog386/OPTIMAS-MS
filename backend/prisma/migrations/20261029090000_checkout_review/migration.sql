-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CHECKOUT_REJECTED';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "checkOutNote" TEXT,
ADD COLUMN     "checkOutReview" "ReviewStatus",
ADD COLUMN     "checkOutReviewedAt" TIMESTAMP(3),
ADD COLUMN     "checkOutReviewedById" TEXT;

-- Check-outs recorded before this change still need a supervisor's look
UPDATE "Attendance" SET "checkOutReview" = 'PENDING' WHERE "checkOutAt" IS NOT NULL;
