# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: install workspace dependencies, build the API and its
# workspace packages, then produce a pruned production deployment.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

ENV HUSKY=0
RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@ritma/api..." run build
RUN pnpm --filter "@ritma/api" --prod deploy --legacy /out

# `pnpm deploy` re-resolves /out's node_modules independently from the
# workspace root, so the Prisma client generated during the build above
# (which lives under the workspace's own node_modules) is not carried
# over. Regenerate it in place using the `prisma` CLI, which is kept as a
# runtime dependency of @ritma/database specifically so it survives the
# `--prod` prune and is available here.
RUN cd /out && \
    "$(readlink -f node_modules/@ritma/database/node_modules/.bin/prisma)" \
      generate --schema=node_modules/@ritma/database/prisma/schema.prisma

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
