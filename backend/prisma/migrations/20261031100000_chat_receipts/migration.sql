-- AlterEnum
ALTER TYPE "ConversationKind" ADD VALUE 'TEAM';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN     "lastDeliveredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "replyToId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_teamId_key" ON "Conversation"("teamId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

