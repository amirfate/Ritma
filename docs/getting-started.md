# Getting Started

## Prerequisites

| Tool           | Version         | Notes                                        |
| -------------- | --------------- | -------------------------------------------- |
| Node.js        | 22.x            | See `.nvmrc`; `nvm use` picks it up          |
| pnpm           | 10.x            | `corepack enable` installs it                |
| JDK            | 21              | Required for the Android build               |
| Android Studio | latest stable   | Recommended for Android development          |
| Docker         | with Compose v2 | For the local postgres/redis/minio/api stack |

## Setup

```bash
git clone <repository-url> ritma
cd ritma
./scripts/setup.sh
```

`setup.sh` verifies the toolchain, runs `pnpm install`, and installs the git
hooks (Husky) that run lint-staged and commitlint.

## Everyday commands

All Node workspace tasks run through TurboRepo from the repository root:

```bash
pnpm build        # build every package (topological order, cached)
pnpm lint         # ESLint across the workspace
pnpm typecheck    # tsc --noEmit across the workspace
pnpm test         # unit tests across the workspace
pnpm format       # Prettier check (format:fix to write)
./scripts/verify.sh   # everything CI runs, in order
```

## API

```bash
pnpm dev:api                         # watch mode on http://localhost:3000
curl http://localhost:3000/health    # -> {"status":"ok"}
```

End-to-end tests:

```bash
pnpm --filter @ritma/api test:e2e
```

## Dashboard

```bash
pnpm --filter @ritma/dashboard dev   # dev server on http://localhost:5173
```

## Android

Open `apps/android` in Android Studio, or build from the command line:

```bash
cd apps/android
./gradlew assembleDebug      # debug APK
./gradlew testDebugUnitTest  # unit tests
./gradlew build              # full build: both variants + lint + tests
```

The Android SDK location is resolved from `ANDROID_HOME` or
`apps/android/local.properties` (created automatically by Android Studio).

## Docker

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
                                      # postgres + redis + minio + api + nginx
curl http://localhost/health         # -> {"status":"ok"}  (via nginx, port 80)
curl http://localhost:3000/health    # -> {"status":"ok"}  (direct to the API)
docker compose -f infrastructure/docker/docker-compose.yml down
                                      # stop (add -v to drop volumes)
```

To run only the infrastructure while developing the API on the host:

```bash
./scripts/dev-infra.sh
```

## Commit conventions

Commits follow [Conventional Commits](https://www.conventionalcommits.org)
and are enforced by commitlint via a git hook:

```
<type>(<scope>): <subject>

feat(api): add health endpoint
fix(android): correct dark theme surface color
chore(repo): bump turbo to 2.6
```

Allowed scopes: `android`, `api`, `dashboard`, `shared`, `api-contracts`,
`design-system`, `tooling`, `config`, `logger`, `database`, `infra`, `ci`,
`docs`, `scripts`, `repo`, `deps`.
