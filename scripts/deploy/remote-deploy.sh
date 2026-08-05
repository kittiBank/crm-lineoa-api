#!/usr/bin/env bash
# Runs on EC2 after rsync + .env upload.
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
IMAGE_TAG="${IMAGE_TAG:-unknown}"

cd "$APP_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing $COMPOSE_FILE in $APP_DIR" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "Missing .env in $APP_DIR" >&2
  exit 1
fi

echo "==> Deploying ${IMAGE_TAG} to $(hostname)"
echo "==> App directory: ${APP_DIR}"

echo "==> Building api + worker images..."
docker compose -f "$COMPOSE_FILE" build api worker

echo "==> Starting stack..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "==> Waiting for API health..."
healthy=0
for attempt in $(seq 1 36); do
  if docker compose -f "$COMPOSE_FILE" ps api 2>/dev/null | grep -q '(healthy)'; then
    healthy=1
    break
  fi
  sleep 5
done

if [ "$healthy" -ne 1 ]; then
  echo "API did not become healthy in time." >&2
  docker compose -f "$COMPOSE_FILE" ps
  docker compose -f "$COMPOSE_FILE" logs --tail=80 api worker
  exit 1
fi

echo "==> Pruning dangling images..."
docker image prune -f >/dev/null 2>&1 || true

echo "==> Deploy successful: ${IMAGE_TAG}"
docker compose -f "$COMPOSE_FILE" ps
