# Environment Variables Documentation

## Required Variables

These environment variables **MUST** be set for the application to start:

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | `sk-proj-...` |
| `ENCRYPTION_KEY` | 32-byte base64 encoded key for encrypting sensitive data | Generate with: `openssl rand -base64 32` |
| `JWT_SECRET` | Secret key for JWT token signing | Generate with: `openssl rand -base64 32` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |

## Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `POSTGRES_PASSWORD` | PostgreSQL password (for docker-compose) | `postgres` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |

## URL Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Backend API base URL | `https://api.lork.cloud` |
| `VITE_API_URL` | Frontend API URL (build-time) | `https://api.lork.cloud/api` |

## Telegram Stars Payments (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `MASTER_BOT_TOKEN` | Telegram Bot Token from @BotFather | Empty (payments disabled) |
| `WEBHOOK_SECRET` | Secret for validating Telegram webhooks | Empty |
| `PAYMENT_MODE` | Payment mode: `REAL` or `MOCK` | `REAL` |
| `STARS_TO_CREDITS_RATE` | Conversion rate (1 Star = X Credits) | `10` |

## Application Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Backend server port | `3010` |
| `ADMIN_HANDLE` | Admin Telegram handle | `@aswadtr` |
| `PIPELINE_CREDIT_COST` | Credits per AI pipeline run | `10` |
| `RATE_LIMIT_PER_MIN` | API rate limit per minute | `30` |

## Generating Secrets

### Encryption Key
```bash
openssl rand -base64 32
```

### JWT Secret
```bash
openssl rand -base64 32
```

### Example .env File

```env
# Required
OPENAI_API_KEY=sk-proj-your-key-here
ENCRYPTION_KEY=generated-32-byte-base64-key
JWT_SECRET=generated-jwt-secret
DATABASE_URL=postgresql://postgres:postgres@db:5432/agent_factory

# URLs (change for your domain)
BASE_URL=https://api.lork.cloud
VITE_API_URL=https://api.lork.cloud/api

# Optional - Telegram Payments
MASTER_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
PAYMENT_MODE=REAL
```

## Docker Compose Usage

When using docker-compose, variables can be set in a `.env` file in the project root:

```bash
# Copy example
cp .env.example .env

# Edit with your values
nano .env

# Start services
docker compose up -d
```

## Security Notes

1. **Never commit `.env` files** to version control
2. **Use strong, unique secrets** for `JWT_SECRET` and `ENCRYPTION_KEY`
3. **Rotate secrets** periodically in production
4. **Use environment-specific values** for `BASE_URL` and `VITE_API_URL`
