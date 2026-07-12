# Ritma Architecture

## Overview

Ritma is an Android-only product (MVP) backed by a NestJS API. The codebase
is a **monorepo** managed with **pnpm workspaces** and **TurboRepo**. The
backend is a **modular monolith**: one deployable NestJS application composed
of well-separated feature modules.

## Repository layout

```
.
├── apps/
│   ├── android/          # Android app (Kotlin, Jetpack Compose, Material 3)
│   └── backend/          # NestJS application (modular monolith)
├── packages/
│   ├── api-contracts/    # HTTP API contracts shared by backend and clients
│   ├── design-system/    # Design tokens (colors, spacing, radius, type scale)
│   ├── shared/           # Platform-neutral TypeScript utilities
│   └── configs/          # Shared ESLint / Prettier / TypeScript presets
├── docker/               # Dockerfiles (one directory per service)
├── docs/                 # Project documentation
├── scripts/              # Developer and CI helper scripts
├── .github/              # CI workflows, Dependabot, code owners
└── docker-compose.yml    # Local stack: postgres, redis, backend
```

## Android app

| Concern              | Choice                       |
| -------------------- | ---------------------------- |
| Language             | Kotlin                       |
| UI                   | Jetpack Compose + Material 3 |
| Architecture         | MVVM (ViewModel + StateFlow) |
| Dependency injection | Hilt                         |
| Navigation           | Navigation Compose           |
| Networking           | Retrofit + OkHttp (planned)  |
| Local persistence    | Room + DataStore (planned)   |
| Media playback       | Media3 ExoPlayer (planned)   |
| Dependency versions  | Gradle Version Catalog       |

Structure inside `apps/android/app`:

- `feature/<name>/` — one package per feature, each with a `Screen`
  (stateless composable), a `Route` (stateful entry point), and a
  `ViewModel`.
- `navigation/` — app-level navigation graph and destinations.
- `ui/theme/` — Material 3 theme; colors and type scale mirror
  `packages/design-system`.

Planned dependencies (Retrofit, Room, DataStore, Media3) are pinned in the
version catalog but not yet wired into the app; they are added when their
feature lands.

## Backend

The backend is a single NestJS application. Each domain lives in its own
Nest module under `src/<module>/`; modules communicate through explicit
providers, never by importing another module's internals.

Current modules:

- `health` — liveness endpoint (`GET /health` → `{"status":"ok"}`),
  used by the Docker healthcheck and by orchestrators.

Planned platform services (present in local infrastructure, not yet used by
the application): PostgreSQL via Prisma, Redis via BullMQ for background
jobs.

## Shared packages

- **`@ritma/api-contracts`** — the single source of truth for HTTP routes
  and request/response types. The backend implements these contracts; the
  Android client mirrors them (Kotlin DTOs are kept in sync by code review
  until contract codegen is introduced).
- **`@ritma/design-system`** — design tokens consumed by tooling and
  mirrored by the Android theme (`ui/theme/Color.kt`, `Type.kt`).
- **`@ritma/shared`** — small, platform-neutral utilities.
- **`@ritma/configs`** — ESLint, Prettier, and TypeScript presets consumed
  by every TypeScript package.

Dependency rule: `apps/*` may depend on `packages/*`; packages may depend on
other packages; nothing depends on an app.

## Locked Versions

The toolchain is locked to the following versions. CI, the git hooks, and
the local scripts all assume them; bumps land as dedicated `chore(deps)`
changes.

- Node.js: 22 (`.nvmrc`, `engines` in the root `package.json`)
- pnpm: 10 (`packageManager` in the root `package.json`)
- Java: 21 (CI Android job; Kotlin/Java bytecode still targets 17)
- Gradle: 8.14.3 (`apps/android/gradle/wrapper/gradle-wrapper.properties`)
- Kotlin: 2.2.20 (`apps/android/gradle/libs.versions.toml`)

## Build and CI

- **TurboRepo** orchestrates `build`, `lint`, `typecheck`, and `test`
  across the workspace with caching and correct topological ordering.
- **GitHub Actions** runs two jobs on every pull request: the Node workspace
  (install → format → lint → typecheck → build → test) and the Android app
  (`./gradlew build`, which assembles both variants and runs Android Lint and
  unit tests).
- **Docker Compose** provides the local stack: `postgres`, `redis`, and the
  containerized `backend` built from `docker/backend/Dockerfile`.
