# smart-generator-botfactory

Advanced Telegram Bot Factory API built with Node.js, TypeScript, Express, Prisma, and PostgreSQL.

- Default PORT: `3010`
- Domain: `https://api.lork.cloud`

## Features

- Express + Helmet + CORS + compression
- Pino logger (no winston)
- Zod-based environment validation
- Prisma ORM with PostgreSQL
- Health check endpoint: `GET /health`
- Master bot webhook: `POST /master/webhook`
- Media upload: `POST /media/upload`
- Analytics export: `GET /analytics/export?botId=...`
- External links: `POST /links`, `GET /links`, `PATCH /links/:id`, `DELETE /links/:id`

## Local development

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run Prisma generate:
   ```bash
   npm run prisma:generate
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

Health check:
```bash
curl http://localhost:3010/health
```

Master bot webhook (Telegram):
```bash
curl -X POST http://localhost:3010/master/webhook -H "Content-Type: application/json" -d '{}'
```

Set master webhook:
```bash
curl -X POST "https://api.telegram.org/bot<MASTER_BOT_TOKEN>/setWebhook" \\
  -H "Content-Type: application/json" \\
  -d '{\"url\":\"https://api.lork.cloud/master/webhook\",\"secret_token\":\"<WEBHOOK_SECRET>\"}'
```

Check webhook info:
```bash
curl "https://api.telegram.org/bot<MASTER_BOT_TOKEN>/getWebhookInfo"
```

Media upload:
```bash
curl -X POST http://localhost:3010/media/upload \\
  -F botId=YOUR_BOT_ID \\
  -F uploadedBy=owner \\
  -F file=@/path/to/file.jpg
```

External links:
```bash
curl -X POST http://localhost:3010/links \\
  -H "Content-Type: application/json" \\
  -d '{\"botId\":\"BOT_ID\",\"nodeId\":\"root\",\"type\":\"OPEN_URL\",\"label\":\"موقعي\",\"url\":\"https://example.com\"}'
```

## Docker (VPS)

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```
2. Start services:
   ```bash
   docker compose up -d --build
   ```
3. Check the health endpoint:
   ```bash
   curl http://localhost:3010/health
   ```

## Prisma bootstrap

On container start, the entrypoint runs:

1. `npx prisma migrate deploy` if migrations exist.
2. Otherwise `npx prisma db push`.
3. `npx prisma generate`.

## Webhook setup

Set master webhook with secret token:
```bash
curl -X POST "https://api.telegram.org/bot<MASTER_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://api.lork.cloud/master/webhook","secret_token":"<WEBHOOK_SECRET>"}'
```

Test webhook secret:
```bash
curl -i -X POST https://api.lork.cloud/master/webhook \
  -H "x-telegram-bot-api-secret-token: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Environment variables

- `MASTER_BOT_TOKEN`: Telegram token for the master bot.
- `OPENAI_API_KEY`: OpenAI API key for generating blueprints.
- `ENCRYPTION_KEY`: 32-byte base64 key for AES-256-GCM.
- `MEDIA_MAX_FILE_MB`: Maximum file size per upload.
- `STORAGE_MAX_SIZE_MB`: Total storage cap per bot.
- `MEDIA_CLEANUP_DAYS`: Cleanup window for unused media.
- `REDIS_URL`: Redis connection string for background jobs.
- `BASE_URL`: Base domain used for webhook registration.
- `WEBHOOK_SECRET`: Secret token to validate Telegram webhooks.
- `RATE_LIMIT_PER_MIN`: Request limit per user per minute.

## Bot creation flow (summary)

1. User sends `/create` to the master bot.
2. Bot prompts for a description and generates a menu-first blueprint.
3. Draft bot is created with Flow v1 (status DRAFT).
4. User can preview and edit draft menus/texts in Preview Mode.
5. On publish confirmation, BotFather token is collected if missing.
6. Webhook is set to `https://api.lork.cloud/tg/{botId}/webhook`.

## Agents pipeline (Pro)

The server runs a multi-agent pipeline:

1. Planner → plan JSON
2. RAG → internal knowledge retrieval
3. Validator → repair if needed
4. A/B variants → score and pick winner
5. Evaluator → quality score
6. Preview → summary + A/B actions
7. Publish gate → readiness checks before publish

Generate a key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Prisma models

- User
- Bot
- Flow
- Session
- Log
