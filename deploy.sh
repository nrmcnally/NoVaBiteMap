#!/usr/bin/env bash
# One-command deploy/update for the single-VM production host.
# Pulls the latest code, rebuilds only what changed, and restarts. The Postgres
# volume (accounts, favorites) and Caddy cert volume persist across this.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "==> Pulling latest code..."
git pull --ff-only

echo "==> Building + restarting containers..."
$COMPOSE up -d --build

echo "==> Pruning dangling images..."
docker image prune -f >/dev/null

echo "==> Status:"
$COMPOSE ps

echo "==> Done. If this is a fresh deploy, watch the API come healthy with:"
echo "    $COMPOSE logs -f api caddy"
