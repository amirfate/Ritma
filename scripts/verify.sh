#!/usr/bin/env bash
#
# Runs the same checks as CI for the Node.js workspace:
# formatting, lint, type check, build, and tests.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Format check"
pnpm run format

echo "==> Lint"
pnpm run lint

echo "==> Type check"
pnpm run typecheck

echo "==> Build"
pnpm run build

echo "==> Test"
pnpm run test

echo "==> All checks passed"
