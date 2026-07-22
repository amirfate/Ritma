#!/usr/bin/env bash
#
# One-time developer setup for the Ritma workspace.
# Verifies the toolchain, installs dependencies, and enables git hooks.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Checking toolchain"

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js is not installed. Install Node.js 22 (see .nvmrc)." >&2
  exit 1
fi

NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -ne 22 ]; then
  echo "error: Node.js 22 is required, found $(node --version)." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm is not installed. Enable it with: corepack enable" >&2
  exit 1
fi

echo "    node $(node --version), pnpm $(pnpm --version)"

echo "==> Installing dependencies"
pnpm install

echo "==> Done"
echo ""
echo "Next steps:"
echo "  pnpm build                                    # build all workspace packages"
echo "  pnpm dev:api                                  # run the API in watch mode"
echo "  docker compose -f infrastructure/docker/docker-compose.yml up -d"
echo "                                                 # start postgres, redis, minio, api, nginx"
echo "  cd apps/android && ./gradlew build             # build the Android app"
