# Ritma Architecture

## Overview

Ritma is an Android-only listener product (MVP) backed by a NestJS API, with
a separate Artist/Administrator web dashboard. The codebase is a
**monorepo** managed with **pnpm workspaces** and **TurboRepo**. The API is
a **modular monolith**: one deployable NestJS application composed of
well-separated feature modules. Kubernetes, microservices, and OpenSearch
are explicitly out of scope.

The end-to-end request path is:

```
Android App → Nginx → NestJS API → PostgreSQL
                                  → Redis
                                  → MinIO
```

## Repository layout

```
.
├── apps/
│   ├── android/          # Android app (Kotlin, Jetpack Compose, Material 3)
│   ├── api/               # NestJS application (modular monolith)
│   └── dashboard/         # Artist/Administrator web dashboard (Next.js)
├── packages/
│   ├── api-contracts/    # HTTP API contracts shared by the API and its clients
│   ├── config/            # Validated runtime environment configuration
│   ├── database/          # Prisma schema, migrations, generated client
│   ├── design-system/    # Design tokens (colors, spacing, radius, type scale)
│   ├── logger/             # Pino logging setup, secret redaction
│   ├── shared/           # Platform-neutral TypeScript utilities
│   └── tooling/           # Shared ESLint / Prettier / TypeScript presets
├── infrastructure/
│   ├── docker/            # Dockerfiles and Docker Compose
│   └── nginx/             # Reverse proxy configuration
├── docs/                 # Project documentation
├── scripts/              # Developer and CI helper scripts
└── .github/              # CI workflows, Dependabot, code owners
```

`apps/dashboard`'s stack (Next.js) is a locked requirement of the
specification, alongside Kotlin/Compose for Android and NestJS/Prisma for
the API.

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

## API

The API is a single NestJS application. Each domain lives in its own Nest
module under `src/<module>/`; modules communicate through explicit
providers, never by importing another module's internals. Logging goes
through `nestjs-pino` (`@ritma/logger`), not Nest's default logger.

Current modules:

- `health` — liveness endpoint (`GET /health` → `{"status":"ok"}`),
  used by the Docker healthcheck and by orchestrators.
- `auth` — OTP-based login (sms.ir), JWT access/refresh tokens, and device
  session management:
  - `POST /auth/send-code` — sends a 5-digit OTP; 60s resend cooldown.
  - `POST /auth/verify` — verifies the OTP, provisions the user on first
    login, registers the device (fingerprint + platform), and issues an
    access/refresh token pair. Verification is capped at 5 attempts per
    code, after which the phone number is blocked for 30 minutes.
  - `POST /auth/refresh` — rotates a refresh token for a fresh
    access/refresh pair; the presented token is invalidated.
  - `POST /auth/logout` — revokes the caller's device and its refresh
    token (requires a bearer access token).
  - `GET /auth/me` — returns the authenticated user (requires a bearer
    access token).
  - A user may have at most 2 active devices; activating a third revokes
    the least-recently-seen one. Every login, logout, and device
    change/revocation is recorded in `audit_logs` via the API's
    application-wide `audit` module (see [docs/database.md](database.md)).
  - OTP state (code, cooldown, attempt count, block) lives in Redis, never
    in Postgres — it is ephemeral session state, not a domain entity.
  - First-time registration (an OTP verified for a phone number with no
    existing account) additionally requires a valid invitation code — see
    Invitations below. A returning user's login never needs one.

### Invitations

The beta is invite-only, capped at 100 total registered users, with a
maximum of 10 invitations per inviter. `POST /auth/verify` calls into this
module (via `AuthService`) rather than provisioning a user unconditionally;
`auth` and `invitation` are separate Nest providers, but `InvitationController`
is registered on `AuthModule` because its authenticated routes need
`JwtAuthGuard`/`TokenService`, and the two modules would otherwise import
each other circularly (see the comment on `InvitationModule`).

- `POST /invitations` — creates an invitation (bearer token required).
  Optionally bound to a specific invitee phone number.
- `POST /invitations/validate` — read-only check of whether a code is
  currently redeemable; does not consume it. Public (no bearer token),
  since the invitee doesn't have an account yet at this point in the flow.
- `GET /invitations` — lists the caller's own invitations.
- Redemption itself has no separate endpoint: it happens inside
  `POST /auth/verify` when `phoneNumber` has no existing account, taking
  `invitationCode` as an additional field on that same request.

**Concurrency and integrity.** Both the global 100-user cap and the
10-invitations-per-inviter quota are enforced with Postgres advisory locks
(`pg_advisory_xact_lock`) inside a single Prisma transaction, not just an
application-level check-then-write:

- Redemption takes a single fixed lock key before counting `users` and
  consuming the invitation, so every concurrent registration attempt —
  regardless of which invitation code it uses — is fully serialized around
  the capacity check. Two people redeeming the same code, or many people
  registering when only one slot remains, can never both succeed.
- Invitation creation takes a lock keyed by a hash of the inviter's id, so
  concurrent creations from the _same_ inviter are serialized against their
  quota, without blocking unrelated inviters from creating invitations at
  the same time.
- If the invitation was genuine but the cap was already reached, it is
  still consumed — moved to `WAITLISTED` rather than left `PENDING` — so it
  cannot be retried once capacity is gone.
- A failed registration (wrong OTP, invalid or reused invitation code)
  never touches the invitation: the invitation is only read-and-mutated in
  the same transaction as the user being provisioned, once OTP verification
  has already succeeded.

**Bootstrapping.** Because every registration requires an invitation from
an existing user, the very first account(s) cannot come through the API —
an operator must insert one `User` and one `Invitation` row directly (e.g.
via `psql` or Prisma Studio) to seed the initial inviter(s). This is
deliberate: no bypass endpoint exists, since the locked specification does
not call for one.

The domain model is defined in `@ritma/database` (see
[docs/database.md](database.md)); the catalog/streaming/commerce modules
that implement the rest of the product are added by dedicated milestones.

## Dashboard

`apps/dashboard` is the Artist and Administrator web surface (upload,
publish, metadata, pricing, reports, artist statistics/revenue). It is
presently a placeholder shell; screens are added by the milestone that
implements the admin/artist surface. It consumes the same HTTP contracts
as any other API client (`@ritma/api-contracts`).

## Shared packages

- **`@ritma/api-contracts`** — the single source of truth for HTTP routes
  and request/response types. The API implements these contracts; the
  Android and dashboard clients mirror them.
- **`@ritma/config`** — Zod-validated runtime environment configuration:
  infrastructure connection variables for Postgres, Redis, and MinIO, plus
  the JWT access/refresh secrets and sms.ir credentials the `auth` module
  requires. Service-specific secrets are added by the milestone that
  introduces the code consuming them.
- **`@ritma/database`** — the Prisma schema, migrations, and generated
  client for the full domain model (see [docs/database.md](database.md)).
- **`@ritma/design-system`** — design tokens consumed by tooling and
  mirrored by the Android theme (`ui/theme/Color.kt`, `Type.kt`).
- **`@ritma/logger`** — a `pino`/`nestjs-pino` setup with redaction rules
  enforcing "never log OTP codes, JWT secrets, or payment secrets."
- **`@ritma/shared`** — small, platform-neutral utilities.
- **`@ritma/tooling`** — ESLint, Prettier, and TypeScript presets consumed
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
  (install → format → lint → typecheck → build → unit tests → migrate →
  e2e tests, with ephemeral Postgres and Redis service containers) and the
  Android app (`./gradlew build`, which assembles both variants and runs
  Android Lint and unit tests).
- **Docker Compose** (`infrastructure/docker/docker-compose.yml`) provides
  the local stack: `postgres`, `redis`, `minio`, the containerized `api`
  (built from `infrastructure/docker/api/Dockerfile`), and `nginx` as the
  reverse proxy in front of it.
