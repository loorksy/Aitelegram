#!/bin/sh
set -e

MIGRATIONS_DIR="/app/prisma/migrations"

if [ -d "$MIGRATIONS_DIR" ] && [ "$(ls -A "$MIGRATIONS_DIR" 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push
fi

npx prisma generate

exec node dist/server.js
