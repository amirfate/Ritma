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
- `catalog` — Artist/Album/Track/Lyrics management and the public catalog
  read surface. See Catalog below.
- `playback` — FLAC streaming and access control. See Streaming & Playback
  below.
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

### Catalog

Artist/Album/Track/Lyrics management (Milestone 4). `CatalogModule` imports
`AuthModule` for `JwtAuthGuard`/`RolesGuard` — one-directional, since
nothing in `AuthModule` depends on `CatalogModule` back (unlike
`InvitationModule`, there's no circular-import problem to work around
here).

**Authorization.** Every mutating endpoint requires a bearer token _and_
the `ADMIN` role (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN')`).
`RolesGuard` (`auth/guards/roles.guard.ts`) is a small, reusable,
catalog-independent addition to the auth module: it reads the role already
embedded in the access token payload (`request.auth.role`, present since
Milestone 2) against an `@Roles(...)` decorator's metadata — authentication
alone (a valid token) is never sufficient for these routes.

**Endpoints** — admin routes are Admin-only; public routes are
unauthenticated and read-only:

- `POST/GET /admin/artists`, `GET/PATCH /admin/artists/:id`,
  `POST /admin/artists/:id/enable|disable`
- `POST/GET /admin/albums`, `GET/PATCH /admin/albums/:id`,
  `POST /admin/albums/:id/publish|unpublish`
- `POST/GET /admin/tracks`, `GET/PATCH /admin/tracks/:id`,
  `POST /admin/tracks/:id/ready|publish|unpublish|archive`
- `POST/GET/PATCH /admin/tracks/:trackId/lyrics`
- `GET /artists`, `GET /artists/:id` — active artists only
- `GET /albums`, `GET /albums/:id` — published albums only
- `GET /tracks`, `GET /tracks/:id` — published tracks only; the response
  omits `flacFileUrl` entirely (metadata only — this is not a delivery
  surface) and `status` (redundant once "published" is the only thing
  ever returned)

There are deliberately no delete endpoints for any catalog entity — the
admin operations list never included one; `enable/disable`,
`publish/unpublish`, and the track lifecycle are the only ways to remove
something from view, so nothing is ever orphaned.

**Track lifecycle.** `DRAFT → READY → PUBLISHED → UNPUBLISHED → ARCHIVED`,
enforced by an explicit transition map
(`catalog/track/track-lifecycle.ts`) — `ARCHIVED` is reachable from every
other status (the sole terminal one); every other transition follows the
chain in order with no shortcuts or reverse transitions. Publishing
(`READY → PUBLISHED`) additionally validates every prerequisite the spec
requires — the track's artist is active, required metadata is present, an
`albumId` (if set) resolves to a real album, lyrics exist for the track,
and a paid track has a positive price — collecting every failing reason at
once rather than failing on the first, so an admin isn't stuck making one
fix per rejected request.

**Search/filter/pagination.** List endpoints share one `PageQueryDto`
(`page`/`pageSize`, offset-based, capped at 100 per page) plus
per-entity filters — title/name search, artist/album association, genre,
and (admin-only) lifecycle/publication status — with deterministic
`createdAt desc, id asc` ordering.

**Audit.** Reuses the existing `AuditService`/`AuditLog`: `PUBLISH` for
the publish transition (the dedicated type this event already had before
Milestone 4), `ADMIN_ACTION` for every other catalog mutation (create,
update, enable/disable, publish/unpublish an album, ready/unpublish/archive
a track, lyrics create/update), each with `metadata` identifying the
entity, action, and record id. No new audit event types were added — the
existing generic `ADMIN_ACTION` category already covers this without
inventing a parallel taxonomy.

The domain model is defined in `@ritma/database` (see
[docs/database.md](database.md)); the commerce module is added by a
dedicated future milestone.

### Streaming & Playback

Delivers a published track's FLAC audio to an authenticated listener
(Milestone 5). `PlaybackModule` imports `AuthModule` for `JwtAuthGuard`
only — one-directional, same pattern as `CatalogModule`. No role
restriction: streaming is a plain listener capability, not admin/artist-only.

**Endpoints** — every route requires a bearer token; none are public:

- `POST /playback/sessions` — body `{ trackId }`. Creates a session for the
  caller's current device (the device already embedded in the access token
  payload since Milestone 2 — no separate device lookup/header). Returns
  only the session id and the resolved access tier, never a storage
  reference.
- `GET /playback/sessions/:id/stream` — the Range-capable audio endpoint.
- `POST /playback/sessions/:id/end` — explicit end; idempotent.

**Access policy.** Computed once, at session creation, from two facts only
— a track's `type` and whether a matching `Purchase` row exists — and
persisted as `PlaybackSession.accessType` (`PlaybackAccessType`, see
[docs/database.md](database.md)) rather than re-derived later:

| Track.type | Purchase exists | accessType       | Behavior         |
| ---------- | --------------- | ---------------- | ---------------- |
| FREE       | n/a             | `FULL_FREE`      | Full stream      |
| PAID       | no              | `PREVIEW`        | 30s preview only |
| PAID       | yes             | `FULL_PURCHASED` | Full stream      |

Only `PUBLISHED` tracks are streamable — the same visibility rule already
enforced for the public catalog, with no separate/looser check introduced.
`Purchase` rows are only ever read here; Commerce (purchase creation,
refunds, wallet, settlement) remains out of scope.

**The 30-second preview clamp is enforced exactly, at FLAC frame
granularity, entirely server-side.** `catalog`-adjacent module
`playback/flac-boundary.ts` is a pure, framework-independent FLAC
frame-header scanner (mirroring the `track-lifecycle.ts` pattern): it walks
frame headers via their sync code, reserved-bit checks, and 8-bit header
CRC — the same seektable-independent technique the reference FLAC decoder
uses to seek — to find the exact byte offset of the frame boundary at or
immediately before the 30-second mark, without decoding any audio and
without any ffmpeg/libFLAC runtime dependency. Because FLAC frames are
independently decodable and byte-aligned, truncating at that boundary
yields a complete, correctly playable prefix; this was independently
cross-validated by truncating real reference-`flac`-encoded fixtures at the
computed offset and decoding the result with the reference `flac` decoder,
confirming the exact predicted sample count. A `PREVIEW` session's clamp is
recomputed from the persisted `accessType` on every request — a client can
never obtain more than 30 seconds by requesting a larger `Range`,
reconnecting, or retrying.

**Storage.** `StorageService` is the minimal abstraction Milestone 5
requires: it resolves a track's `flacFileUrl` to bytes from MinIO — the
only storage provider implemented — and is the only thing in the API that
knows MinIO's endpoint/credentials. No client ever receives a direct or
signed storage URL; every byte is proxied through the API. `flacFileUrl`
keeps its exact Milestone 4 contract (a validated URL, unchanged
validation, no rename, no data migration) — `StorageService` reads the
URL's path as the MinIO object key internally, which is a resolution
detail of this one service, not a reinterpretation of what the column
stores or means.

**Session lifecycle and concurrency.** The existing "one simultaneous
stream per listener" rule (locked since Milestone 1) is enforced the same
way M3's invitation capacity/quota checks are: a Postgres advisory lock
(`pg_advisory_xact_lock(hashtext(userId))`) serializes concurrent
session-creation attempts for the same user inside one transaction, so two
simultaneous requests can never both succeed. There is no
`lastActivityAt`/heartbeat column or endpoint — Milestone 5 sets no
fast-reclaim SLA, so an abandoned session (crash, dropped connection) is
reclaimed purely by a bounded TTL against `startedAt`
(`PLAYBACK_SESSION_MAX_DURATION_MS`, set well above the longest plausible
continuous listen): once a session is past the TTL it simply stops
blocking a new one, and is lazily marked `endedAt` as a data-hygiene side
effect, not because correctness depends on it.

**Audit.** No new `AuditEventType` was added. `PlaybackSession` itself —
`userId`, `deviceId`, `trackId`, `accessType`, `startedAt`, `endedAt` — is
already the durable, queryable record of a stream; a session start/stop
isn't a `LOGIN`/`PURCHASE`/`PUBLISH`-equivalent event worth a duplicate
`AuditLog` row.

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
