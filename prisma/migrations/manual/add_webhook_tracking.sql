-- Add webhook tracking fields to Bot table
-- Migration: add_webhook_tracking

-- Add new columns to Bot table
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "telegramBotId" TEXT;
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "webhookUrl" TEXT;
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT;
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "webhookStatus" TEXT;
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "webhookError" TEXT;
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "webhookCheckedAt" TIMESTAMP(3);

-- Add index on webhookStatus for faster queries
CREATE INDEX IF NOT EXISTS "Bot_webhookStatus_idx" ON "Bot"("webhookStatus");

-- Add WEBHOOK_OK and WEBHOOK_FAILED to BotStatus enum if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'WEBHOOK_OK' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BotStatus')) THEN
    ALTER TYPE "BotStatus" ADD VALUE 'WEBHOOK_OK';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'WEBHOOK_FAILED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BotStatus')) THEN
    ALTER TYPE "BotStatus" ADD VALUE 'WEBHOOK_FAILED';
  END IF;
END $$;
