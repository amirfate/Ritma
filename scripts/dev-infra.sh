#!/usr/bin/env bash
#
# Starts local infrastructure (postgres, redis, minio) without the API
# container, for running the API on the host with `pnpm dev:api`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infrastructure/docker/docker-compose.yml"

docker compose -f "$COMPOSE_FILE" up -d postgres redis minio
docker compose -f "$COMPOSE_FILE" ps postgres redis minio
