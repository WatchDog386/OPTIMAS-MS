-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "customerFeedback" TEXT,
ADD COLUMN     "customerRating" INTEGER,
ADD COLUMN     "ratedAt" TIMESTAMP(3);

