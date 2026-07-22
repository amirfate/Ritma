# Ritma

Ritma monorepo: an Android app (Kotlin, Jetpack Compose, Material 3), a
NestJS API (modular monolith), and an Artist/Administrator web dashboard,
built with pnpm workspaces and TurboRepo.

## Layout

```
apps/android         Android app — Kotlin, Compose, Material 3, Hilt, MVVM
apps/api             NestJS API — modular monolith
apps/dashboard       Artist/Administrator web dashboard — Next.js
packages/api-contracts   Shared HTTP API contracts
packages/config          Validated runtime environment configuration
packages/database        Prisma schema, migrations, and generated client
packages/design-system    Design tokens mirrored by the Android theme
packages/logger           Pino logging setup with secret redaction
packages/shared           Platform-neutral TypeScript utilities
packages/tooling          Shared ESLint / Prettier / TypeScript presets
infrastructure/docker     Dockerfiles and Docker Compose
infrastructure/nginx      Reverse proxy configuration
docs/                Architecture and onboarding documentation
scripts/             Developer helper scripts
```

## Quick start

```bash
./scripts/setup.sh                   # toolchain check + pnpm install + hooks
pnpm build                           # build the Node workspace
pnpm dev:api                         # API in watch mode on :3000
curl http://localhost:3000/health    # -> {"status":"ok"}
```

Android:

```bash
cd apps/android && ./gradlew build
```

Full local stack (postgres, redis, minio, api, nginx):

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

## Documentation

- [Getting started](docs/getting-started.md)
- [Architecture](docs/architecture.md)

## Quality gates

CI runs on every pull request: Prettier, ESLint, TypeScript type checks,
workspace build, and unit tests for the Node side; `./gradlew build`
(assemble, Android Lint, unit tests) for the Android app. Locally,
`./scripts/verify.sh` runs the same Node checks, and Husky hooks enforce
formatting and Conventional Commits on every commit.
