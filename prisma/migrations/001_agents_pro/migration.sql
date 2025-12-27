-- CreateEnum
CREATE TYPE "KnowledgeBaseType" AS ENUM ('FAQ', 'TEMPLATE', 'POLICY', 'EXAMPLE');

-- CreateTable
CREATE TABLE "UserMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferences" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotMemory" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseItem" (
    "id" TEXT NOT NULL,
    "type" "KnowledgeBaseType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL,
    "language" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT,
    "inputSummary" TEXT NOT NULL,
    "outputs" JSONB NOT NULL,
    "scores" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ABVariant" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "blueprint" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "chosen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ABVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserMemory_userId_key" ON "UserMemory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BotMemory_botId_key" ON "BotMemory"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "ABVariant_botId_variantKey_key" ON "ABVariant"("botId", "variantKey");

-- AddForeignKey
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotMemory" ADD CONSTRAINT "BotMemory_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ABVariant" ADD CONSTRAINT "ABVariant_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
