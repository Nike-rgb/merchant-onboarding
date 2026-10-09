#!/bin/sh
set -e

echo "[entrypoint] Waiting for dependencies, then running DB migrations..."
node ./node_modules/typeorm/cli.js migration:run -d dist/data-source.js

echo "[entrypoint] Seeding baseline users (idempotent)..."
node dist/database/seed.js

echo "[entrypoint] Starting API..."
exec node dist/main.js
