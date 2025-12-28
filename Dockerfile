# ===================================
# AI Agent Factory - Backend Dockerfile
# Node 20 Debian for better compatibility
# ===================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ===================================
# Production image
# ===================================
FROM node:20-bookworm-slim

WORKDIR /app

# Install OpenSSL and curl for Prisma and healthcheck
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Set production environment
ENV NODE_ENV=production
ENV PORT=3010

EXPOSE 3010

# Run database migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
