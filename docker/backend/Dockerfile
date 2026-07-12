# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: install workspace dependencies, build the backend and its
# workspace packages, then produce a pruned production deployment.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

ENV HUSKY=0
RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@ritma/backend..." run build
RUN pnpm --filter "@ritma/backend" --prod deploy --legacy /out

# ---------------------------------------------------------------------------
# Runtime stage: minimal image with production dependencies only.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /out /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "dist/main.js"]
