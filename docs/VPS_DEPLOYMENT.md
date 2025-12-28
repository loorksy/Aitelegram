# AI Agent Factory - VPS Deployment Guide

## Prerequisites

- Ubuntu 22.04+ or Debian 12+
- Docker & Docker Compose installed
- Domain names configured:
  - `api.lork.cloud` → Points to your VPS IP
  - `app.lork.cloud` → Points to your VPS IP
- SSL certificates (Let's Encrypt recommended)

## Quick Start

### 1. Clone and Configure

```bash
# Clone repository
git clone <repository-url> /opt/ai-agent-factory
cd /opt/ai-agent-factory

# Copy and edit environment file
cp .env.example .env
nano .env
```

### 2. Configure Environment Variables

Edit `/opt/ai-agent-factory/.env`:

```bash
# Environment Configuration
NODE_ENV=production
PORT=3010

# Database
DATABASE_URL=postgresql://postgres:your_secure_password@db:5432/smart_generator

# Telegram Master Bot
MASTER_BOT_TOKEN=<your-telegram-bot-token>

# OpenAI API
OPENAI_API_KEY=<your-openai-api-key>

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=<your-jwt-secret>

# Base URL for webhooks
BASE_URL=https://api.lork.cloud

# Payment Configuration
PAYMENT_MODE=REAL
STARS_TO_CREDITS_RATE=10

# Admin Handle
ADMIN_HANDLE=@aswadtr

# Pipeline Configuration
PIPELINE_CREDIT_COST=10

# CORS
ALLOWED_ORIGINS=https://app.lork.cloud
```

### 3. Configure Frontend Environment

Edit `/opt/ai-agent-factory/frontend/.env`:

```bash
VITE_API_URL=https://api.lork.cloud/api
```

### 4. Build and Start Services

```bash
# Build images
docker compose build

# Start services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f backend
```

### 5. Run Database Migrations

```bash
docker compose exec backend npx prisma migrate deploy
```

### 6. Set Up Nginx Reverse Proxy

Create `/etc/nginx/sites-available/ai-agent-factory`:

```nginx
# API Backend
server {
    listen 443 ssl http2;
    server_name api.lork.cloud;

    ssl_certificate /etc/letsencrypt/live/api.lork.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.lork.cloud/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}

# Frontend Dashboard
server {
    listen 443 ssl http2;
    server_name app.lork.cloud;

    ssl_certificate /etc/letsencrypt/live/app.lork.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.lork.cloud/privkey.pem;

    root /opt/ai-agent-factory/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name api.lork.cloud app.lork.cloud;
    return 301 https://$server_name$request_uri;
}
```

Enable and reload:
```bash
ln -s /etc/nginx/sites-available/ai-agent-factory /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 7. Set Up Telegram Webhook

```bash
# Set webhook URL
curl -X POST "https://api.telegram.org/bot<MASTER_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://api.lork.cloud/master/webhook"}'

# Verify
curl "https://api.telegram.org/bot<MASTER_BOT_TOKEN>/getWebhookInfo"
```

### 8. Create Initial Admin User

```bash
docker compose exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { telegramId: 'YOUR_TELEGRAM_ID' },
    update: {},
    create: {
      telegramId: 'YOUR_TELEGRAM_ID',
      name: 'Admin',
      username: 'admin',
      role: 'OWNER',
      status: 'APPROVED',
      credits: 10000,
      dailyCreditsLimit: 1000
    }
  });
  console.log('Admin created:', owner.id);
}

main().catch(console.error).finally(() => prisma.\$disconnect());
"
```

## Verification Checklist

```bash
# 1. Check API health
curl https://api.lork.cloud/health
# Expected: {"ok":true}

# 2. Check API endpoint
curl https://api.lork.cloud/api/payments/config
# Expected: {"mode":"REAL",...}

# 3. Check frontend
curl -I https://app.lork.cloud
# Expected: HTTP/2 200

# 4. Check LLM connection
curl https://api.lork.cloud/debug/llm
# Expected: {"ok":true,"model":"gpt-4o-mini",...}
```

## Maintenance

### Backup Database

```bash
docker compose exec db pg_dump -U postgres smart_generator > backup_$(date +%Y%m%d).sql
```

### Update Application

```bash
cd /opt/ai-agent-factory
git pull
docker compose build
docker compose up -d
docker compose exec backend npx prisma migrate deploy
```

### View Logs

```bash
# All logs
docker compose logs -f

# Backend only
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL container
docker compose exec db psql -U postgres -c "SELECT 1"

# Check migrations
docker compose exec backend npx prisma migrate status
```

### API Not Responding

```bash
# Check container status
docker compose ps

# Restart backend
docker compose restart backend

# Check for port conflicts
netstat -tlpn | grep 3010
```

### Frontend Build Issues

```bash
# Rebuild frontend
cd frontend
yarn install
yarn build
```

## Security Notes

1. **Firewall**: Only expose ports 80, 443
2. **SSL**: Use Let's Encrypt with auto-renewal
3. **Secrets**: Never commit `.env` files
4. **Database**: Use strong passwords
5. **Updates**: Keep Docker and dependencies updated

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │            Nginx Reverse Proxy       │
                    │   (SSL termination, routing)        │
                    └─────────────────────────────────────┘
                              │                │
              ┌───────────────┘                └───────────────┐
              │                                                │
              ▼                                                ▼
    ┌─────────────────┐                          ┌─────────────────┐
    │  api.lork.cloud │                          │  app.lork.cloud │
    │   (Backend)     │                          │   (Frontend)    │
    │   Port 3010     │                          │   Static Files  │
    └─────────────────┘                          └─────────────────┘
              │
              │
              ▼
    ┌─────────────────┐
    │   PostgreSQL    │
    │   Port 5432     │
    └─────────────────┘
```

## Support

- Admin Contact: @aswadtr
- Documentation: /docs/
- API Reference: /docs/PHASE2_API.md
- Payment Guide: /docs/TELEGRAM_STARS_RUNBOOK.md
