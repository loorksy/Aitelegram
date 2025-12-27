-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('DRAFT', 'PREVIEW', 'OFFLINE', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SessionState" AS ENUM ('IDLE', 'AWAITING_DESCRIPTION', 'AWAITING_TOKEN', 'AWAITING_REVIEW', 'USER_FLOW', 'OWNER_EDIT_WELCOME', 'OWNER_EDIT_MENU', 'OWNER_EDIT_BUTTON_SELECT', 'OWNER_EDIT_BUTTON_LABEL', 'OWNER_EDIT_BUTTON_ACTION', 'PREVIEW_MODE', 'CONFIRM_PUBLISH', 'OWNER_BROADCAST_NOW', 'OWNER_SCHEDULE_BROADCAST');

-- CreateEnum
CREATE TYPE "FlowStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ModerationMode" AS ENUM ('MANUAL', 'AI_ASSISTED', 'AUTO');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('START', 'BUTTON_CLICK', 'MENU_VIEW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "BotStatus" NOT NULL DEFAULT 'DRAFT',
    "welcomeText" TEXT DEFAULT 'مرحبا! اختر من القائمة.',
    "menuLabels" JSONB,
    "draftWelcomeText" TEXT,
    "draftMenuLabels" JSONB,
    "tokenCipherText" TEXT,
    "tokenIv" TEXT,
    "tokenTag" TEXT,
    "telegramUser" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "blueprint" JSONB NOT NULL,
    "status" "FlowStatus" NOT NULL DEFAULT 'DRAFT',
    "botId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT,
    "chatId" TEXT,
    "state" "SessionState" NOT NULL DEFAULT 'IDLE',
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeMB" DOUBLE PRECISION NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "nodeIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalLink" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "webAppUrl" TEXT,
    "loginUrl" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "target" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotGroup" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "title" TEXT,
    "moderationMode" "ModerationMode" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "warns" INTEGER NOT NULL DEFAULT 0,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInteraction" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotAnalytics" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "menuViews" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "Bot_ownerId_idx" ON "Bot"("ownerId");

-- CreateIndex
CREATE INDEX "Bot_status_idx" ON "Bot"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_botId_chatId_key" ON "Session"("botId", "chatId");

-- CreateIndex
CREATE INDEX "Log_botId_createdAt_idx" ON "Log"("botId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BotGroup_botId_chatId_key" ON "BotGroup"("botId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_telegramId_key" ON "GroupMember"("groupId", "telegramId");

-- CreateIndex
CREATE INDEX "UserInteraction_botId_createdAt_idx" ON "UserInteraction"("botId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BotAnalytics_botId_date_key" ON "BotAnalytics"("botId", "date");

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalLink" ADD CONSTRAINT "ExternalLink_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotGroup" ADD CONSTRAINT "BotGroup_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BotGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInteraction" ADD CONSTRAINT "UserInteraction_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotAnalytics" ADD CONSTRAINT "BotAnalytics_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

