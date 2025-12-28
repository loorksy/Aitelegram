# ===================================
# AI Agent Factory - Frontend Dockerfile
# Node 20 Debian for Rollup compatibility
# ===================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Build argument for API URL
ARG VITE_API_URL=https://api.lork.cloud/api
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies with optional deps for native modules
RUN npm install --include=optional

# Explicitly install Rollup native binary for Linux x64
RUN npm install --no-save @rollup/rollup-linux-x64-gnu

# Copy source code
COPY . .

# Build for production
RUN npm run build

# ===================================
# Production with nginx
# ===================================
FROM nginx:stable

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (mapped to 3011 on host)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
