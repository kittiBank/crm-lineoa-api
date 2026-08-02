#!/bin/sh
set -e

# Run DB migrations only when explicitly enabled (api service).
# Worker should leave RUN_MIGRATIONS unset/false to avoid races.
if [ "${RUN_MIGRATIONS}" = "true" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  npx prisma migrate deploy
  echo "[entrypoint] Migrations complete."
fi

exec "$@"
