-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "AgentRun"
DROP COLUMN "runId",
DROP COLUMN "inputSummary",
DROP COLUMN "outputs",
DROP COLUMN "scores",
ADD COLUMN "intent" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "inputText" TEXT NOT NULL DEFAULT '',
ADD COLUMN "planJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN "blueprintJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN "validatorErrors" JSONB,
ADD COLUMN "status" "AgentRunStatus" NOT NULL DEFAULT 'FAILED',
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "latencyMs" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AgentRun_userId_createdAt_idx" ON "AgentRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_botId_createdAt_idx" ON "AgentRun"("botId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
