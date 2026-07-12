# Getting Started

## Prerequisites

| Tool           | Version         | Notes                                |
| -------------- | --------------- | ------------------------------------ |
| Node.js        | 22.x            | See `.nvmrc`; `nvm use` picks it up  |
| pnpm           | 10.x            | `corepack enable` installs it        |
| JDK            | 21              | Required for the Android build       |
| Android Studio | latest stable   | Recommended for Android development  |
| Docker         | with Compose v2 | For the local postgres/redis/backend |

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

## Backend

```bash
pnpm dev:backend                     # watch mode on http://localhost:3000
curl http://localhost:3000/health    # -> {"status":"ok"}
```

End-to-end tests:

```bash
pnpm --filter @ritma/backend test:e2e
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
docker compose up -d                 # postgres + redis + backend
curl http://localhost:3000/health    # -> {"status":"ok"}
docker compose down                  # stop (add -v to drop volumes)
```

To run only the infrastructure while developing the backend on the host:

```bash
./scripts/dev-infra.sh
```

## Commit conventions

Commits follow [Conventional Commits](https://www.conventionalcommits.org)
and are enforced by commitlint via a git hook:

```
<type>(<scope>): <subject>

feat(backend): add health endpoint
fix(android): correct dark theme surface color
chore(repo): bump turbo to 2.6
```

Allowed scopes: `android`, `backend`, `shared`, `api-contracts`,
`design-system`, `configs`, `docker`, `ci`, `docs`, `scripts`, `repo`,
`deps`.
