import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

const requiredString = (message: string, fallback: string) =>
  isTest ? z.string().default(fallback) : z.string().min(1, message);

const baseUrlSchema = isTest
  ? z.string().url().catch('https://api.lork.cloud')
  : z.string().url().default('https://api.lork.cloud');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3010),
  DATABASE_URL: requiredString('DATABASE_URL is required', 'postgres://test'),
  MASTER_BOT_TOKEN: requiredString('MASTER_BOT_TOKEN is required', 'test-token'),
  OPENAI_API_KEY: requiredString('OPENAI_API_KEY is required', 'test-key'),
  ENCRYPTION_KEY: requiredString('ENCRYPTION_KEY is required', Buffer.from('a'.repeat(32)).toString('base64')),
  MEDIA_MAX_FILE_MB: z.coerce.number().default(10),
  STORAGE_MAX_SIZE_MB: z.coerce.number().default(200),
  MEDIA_CLEANUP_DAYS: z.coerce.number().default(30),
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
  BASE_URL: baseUrlSchema,
  WEBHOOK_SECRET: z.string().optional(),
  RATE_LIMIT_PER_MIN: z.coerce.number().default(30)
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  MASTER_BOT_TOKEN: process.env.MASTER_BOT_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  MEDIA_MAX_FILE_MB: process.env.MEDIA_MAX_FILE_MB,
  STORAGE_MAX_SIZE_MB: process.env.STORAGE_MAX_SIZE_MB,
  MEDIA_CLEANUP_DAYS: process.env.MEDIA_CLEANUP_DAYS,
  REDIS_URL: process.env.REDIS_URL,
  BASE_URL: process.env.BASE_URL,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  RATE_LIMIT_PER_MIN: process.env.RATE_LIMIT_PER_MIN
});
