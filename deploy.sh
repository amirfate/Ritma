#!/usr/bin/env bash
# Ritma monorepo deploy script — install & update
# Usage:
#   ./deploy.sh              update + build + migrate + restart
#   ./deploy.sh --init       first install (same + seed demo data)
#   REPO_DIR=/path ./deploy.sh    custom repo location
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/apps/ritma-mono}"
API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"
MODE="${1:-update}"

log()  { echo -e "\033[1;33m[ritma]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ritma]\033[0m $*"; }
warn() { echo -e "\033[1;31m[ritma]\033[0m $*"; }
die()  { warn "ERROR: $*" >&2; exit 1; }

# pnpm may live outside default PATH
export PATH="$HOME/.npm-global/bin:$HOME/.local/bin:$PATH"

command -v node >/dev/null 2>&1 || die "node not found - install Node 22 first (see ritma-DEPLOY.md)"
command -v pnpm >/dev/null 2>&1 || { command -v corepack >/dev/null 2>&1 && corepack enable pnpm || true; }
command -v pnpm >/dev/null 2>&1 || die "pnpm not found - run: sudo corepack enable && corepack prepare pnpm@10.33.0 --activate"

[ -d "$REPO_DIR" ] || die "repo dir not found: $REPO_DIR (put the code there first, or set REPO_DIR=...)"
cd "$REPO_DIR"

BACKEND_DIR="$REPO_DIR/apps/backend"
WEB_DIR="$REPO_DIR/apps/web"

# 1) update source
if [ -d .git ]; then
  OLD_HEAD="$(git rev-parse HEAD)"
  if git fetch origin main 2>/dev/null; then
    git reset --hard origin/main
    NEW_HEAD="$(git rev-parse HEAD)"
    if [ "$OLD_HEAD" = "$NEW_HEAD" ]; then
      log "code already up to date ($NEW_HEAD)"
    else
      ok "code updated: $OLD_HEAD -> $NEW_HEAD"
    fi
  else
    warn "git fetch failed (no network or token) - using local code as-is"
  fi
else
  log "not a git repo - assuming you placed the source zip manually"
fi

# 2) env files: never overwrite, create from example if missing
if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  warn "created $BACKEND_DIR/.env from example - EDIT it now (DATABASE_URL, JWT_SECRET, STREAM_SECRET)!"
else
  ok "backend .env kept (not touched)"
fi
if [ ! -f "$WEB_DIR/.env.local" ]; then
  echo "API_URL=http://127.0.0.1:$API_PORT" > "$WEB_DIR/.env.local"
  log "created $WEB_DIR/.env.local (API_URL=127.0.0.1:$API_PORT)"
fi

# 3) install + generate + build
log "pnpm install..."
pnpm install --frozen-lockfile || pnpm install
log "prisma generate (build fails without it on a fresh clone)..."
(cd "$BACKEND_DIR" && pnpm exec prisma generate)
log "build (turbo)..."
pnpm build

# 4) database migrations
cd "$BACKEND_DIR"
if [ -z "$(ls prisma/migrations 2>/dev/null || true)" ]; then
  warn "no migrations in repo yet - FIRST TIME ONLY, create the schema manually:"
  warn "  cd $BACKEND_DIR && pnpm exec prisma migrate dev --name init"
  warn "  then re-run: ./deploy.sh"
else
  log "applying migrations (prisma migrate deploy)..."
  pnpm exec prisma migrate deploy
fi

# 5) seed (init mode only)
if [ "$MODE" = "--init" ]; then
  log "seeding demo data (admin account, demo invites)..."
  pnpm db:seed || warn "seed failed - check DATABASE_URL in $BACKEND_DIR/.env"
fi
cd "$REPO_DIR"

# 6) restart services
if systemctl list-unit-files 2>/dev/null | grep -q '^ritma-api'; then
  log "restarting systemd services..."
  sudo systemctl restart ritma-api ritma-web
else
  warn "systemd units not found - restart the two processes manually:"
  warn "  backend: cd $BACKEND_DIR && node dist/main.js   (port $API_PORT)"
  warn "  web:     cd $WEB_DIR && npx next start -p $WEB_PORT"
fi

# 7) health check
sleep 2
check_port() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1; }
if check_port "$API_PORT"; then ok "backend is up on port $API_PORT"; else warn "backend NOT listening on $API_PORT - check: journalctl -u ritma-api -n 50"; fi
if check_port "$WEB_PORT"; then ok "web is up on port $WEB_PORT"; else warn "web NOT listening on $WEB_PORT - check: journalctl -u ritma-web -n 50"; fi

echo
ok "deploy finished."
echo "  rollback:  cd $REPO_DIR && git reset --hard $OLD_HEAD 2>/dev/null && pnpm install && pnpm build && sudo systemctl restart ritma-api ritma-web"
echo "  admin:     amir@ritma.app / Passw0rd!123   (seed demo invites: RITMA-DEMO001..003)"
