#!/usr/bin/env bash
# Runs on the GCP VM after CI has pushed the image to GHCR and uploaded compose + .env.
# Pulls the pre-built image — do not docker build on this host.
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

API_IMAGE="$(grep -E '^API_IMAGE=' .env | tail -n1 | cut -d= -f2- || true)"
if [ -z "${API_IMAGE}" ]; then
  echo "Missing API_IMAGE in .env" >&2
  exit 1
fi

echo "==> Deploying ${API_IMAGE} (tag ${IMAGE_TAG}) to $(hostname)"
echo "==> App directory: ${APP_DIR}"
export IMAGE_TAG

echo "==> Disk before pull:"
df -h / || true
docker system df || true

# Drop leftover local build cache from the old on-VM docker build path.
# Keep running containers and their images so api/worker stay up during pull.
echo "==> Freeing unused Docker builder cache and dangling images..."
docker builder prune -af >/dev/null 2>&1 || true
docker container prune -f >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true

echo "==> Disk after cleanup:"
df -h / || true

echo "==> Pulling application image..."
docker compose -f "$COMPOSE_FILE" pull api worker

echo "==> Recreating stack (no build)..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans --no-build

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

echo "==> Removing images no longer used by running containers..."
docker image prune -af >/dev/null 2>&1 || true

echo "==> Deploy successful: ${API_IMAGE}"
docker compose -f "$COMPOSE_FILE" ps
