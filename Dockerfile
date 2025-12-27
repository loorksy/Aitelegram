# syntax=docker/dockerfile:1
FROM node:18-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install && npx prisma generate

FROM node:18-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm run build

FROM node:18-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3010
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh \
  && chown -R node:node /app
EXPOSE 3010
USER node
CMD ["/app/docker-entrypoint.sh"]
