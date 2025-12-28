# AI Agent Factory

Advanced Telegram Bot Factory with AI-powered bot generation.

## Quick Start with Docker

### Prerequisites
- Docker & Docker Compose installed
- OpenAI API key

### 1. Clone and Configure

```bash
git clone <repository-url>
cd ai-agent-factory

# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

### 2. Required Environment Variables

```env
OPENAI_API_KEY=sk-your-key-here
ENCRYPTION_KEY=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
```

### 3. Build and Start

```bash
# Build all services
docker compose build

# Start in detached mode
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### 4. Verify Deployment

```bash
# Backend health
curl http://localhost:3010/health

# Frontend
curl http://localhost:3011
```

## Production Domains

| Service | Port | Domain |
|---------|------|--------|
| Backend API | 3010 | https://api.lork.cloud |
| Frontend Dashboard | 3011 | https://app.lork.cloud |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Reverse Proxy (Nginx)                     │
│              SSL Termination & Load Balancing                │
└─────────────────────────────────────────────────────────────┘
                    │                        │
         ┌──────────┘                        └──────────┐
         │                                              │
         ▼                                              ▼
┌─────────────────┐                        ┌─────────────────┐
│   Backend API   │                        │    Frontend     │
│   (Node.js)     │                        │    (React)      │
│   Port: 3010    │                        │   Port: 3011    │
└─────────────────┘                        └─────────────────┘
         │
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│  DB   │ │ Redis │
│ 5432  │ │ 6379  │
└───────┘ └───────┘
```

## Features

- 🤖 AI-powered bot generation using OpenAI
- 🔐 JWT authentication with RBAC (Owner/Admin/User)
- 💳 Telegram Stars payment integration
- 📊 Admin dashboard for user management
- 📈 Credit system with daily limits
- 🔒 Secure by design with Helmet, rate limiting

## Documentation

- [Environment Variables](docs/ENV_VARIABLES.md)
- [VPS Deployment Guide](docs/VPS_DEPLOYMENT.md)
- [Telegram Stars Runbook](docs/TELEGRAM_STARS_RUNBOOK.md)
- [API Documentation](docs/PHASE2_API.md)

## Development

### Local Setup (without Docker)

```bash
# Backend
cd /app
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Frontend
cd /app/frontend
npm install
npm run dev
```

### Testing

```bash
# Backend tests
npm test

# API health check
curl http://localhost:3010/health
curl http://localhost:3010/api/health
```

## License

MIT
