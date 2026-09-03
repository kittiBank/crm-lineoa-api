#!/usr/bin/env bash
# Runs on the GCP VM after rsync + .env upload.
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
export IMAGE_TAG

echo "==> Disk before cleanup:"
df -h / || true
docker system df || true

# Stop api/worker so their old images can be pruned (brief downtime).
# Leaving them running is what filled the disk on the last ENOSPC build.
echo "==> Stopping api + worker to reclaim image layers..."
docker compose -f "$COMPOSE_FILE" stop api worker >/dev/null 2>&1 || true

echo "==> Freeing unused Docker data..."
docker container prune -f >/dev/null 2>&1 || true
docker image prune -af >/dev/null 2>&1 || true
docker builder prune -af >/dev/null 2>&1 || true

echo "==> Disk after cleanup:"
df -h / || true

echo "==> Building image (shared by api + worker)..."
docker compose -f "$COMPOSE_FILE" build api

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
