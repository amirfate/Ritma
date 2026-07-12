#!/usr/bin/env bash
#
# Starts local infrastructure (postgres, redis) without the backend
# container, for running the backend on the host with `pnpm dev:backend`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

docker compose up -d postgres redis
docker compose ps postgres redis
