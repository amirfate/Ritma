# Ritma

Ritma monorepo: an Android app (Kotlin, Jetpack Compose, Material 3) and a
NestJS backend (modular monolith), built with pnpm workspaces and TurboRepo.

## Layout

```
apps/android         Android app — Kotlin, Compose, Material 3, Hilt, MVVM
apps/backend         NestJS backend — modular monolith
packages/api-contracts   Shared HTTP API contracts
packages/design-system   Design tokens mirrored by the Android theme
packages/shared          Platform-neutral TypeScript utilities
packages/configs         Shared ESLint / Prettier / TypeScript presets
docker/              Dockerfiles per service
docs/                Architecture and onboarding documentation
scripts/             Developer helper scripts
```

## Quick start

```bash
./scripts/setup.sh                   # toolchain check + pnpm install + hooks
pnpm build                           # build the Node workspace
pnpm dev:backend                     # backend in watch mode on :3000
curl http://localhost:3000/health    # -> {"status":"ok"}
```

Android:

```bash
cd apps/android && ./gradlew build
```

Full local stack (postgres, redis, backend):

```bash
docker compose up -d
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
