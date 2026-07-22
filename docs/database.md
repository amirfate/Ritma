# Database

`@ritma/database` (`packages/database`) owns the Prisma schema, migrations,
and generated client. It defines exactly the 15 entities required by the
specification — no more, no less — as shape only; the business rules that
govern them (OTP cooldowns, device/stream limits, invitation caps, revenue
splits, track lifecycle transitions) are enforced by the application
modules that implement those flows, not by the schema.

## Entities

| Table               | Purpose                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`             | Account identity (phone number, role: Listener / Artist / Admin).                                                                                                                              |
| `devices`           | A user's logged-in devices. Max two active; oldest revoked on a third login.                                                                                                                   |
| `artists`           | Artist profile, optionally linked to a `users` account, with a per-artist revenue-share override.                                                                                              |
| `albums`            | Grouping and metadata for tracks. No purchase relation — album purchases are disabled in beta.                                                                                                 |
| `tracks`            | Catalog entries: metadata, FLAC file reference, price, lifecycle status.                                                                                                                       |
| `lyrics`            | One row per track: standard lyrics (required once written) plus optional synced (timed) lyrics.                                                                                                |
| `playlists`         | A user's playlists.                                                                                                                                                                            |
| `playlist_tracks`   | Ordered join table between playlists and tracks.                                                                                                                                               |
| `purchases`         | Permanent per-track streaming rights. Unique per (user, track) — no re-purchasing, no album purchases, no download rights.                                                                     |
| `donations`         | 100% of the amount goes to the artist. No campaigns, no listener wallet.                                                                                                                       |
| `wallets`           | The **artist's** earnings ledger (accumulated purchase share + donations awaiting settlement). Not a listener/user wallet — the spec explicitly forbids one; this is what `GET /wallet` reads. |
| `settlements`       | A manual payout recorded by an administrator against a wallet. No automated payout processor.                                                                                                  |
| `invitations`       | Invite-only beta: one row per invite, tracking inviter, redemption, and waitlist status. The global 100-user cap and 10-invites-per-inviter limit are enforced by the invitation module.       |
| `playback_sessions` | One row per stream. The "one simultaneous stream per listener" rule is enforced by the streaming module (an open session blocks a new one).                                                    |
| `audit_logs`        | Append-only. Covers the eight required event categories: login, logout, device change, purchase, donation, publishing, settlement, admin action.                                               |

## Enums

- `UserRole`: `LISTENER`, `ARTIST`, `ADMIN`
- `TrackType`: `FREE`, `PAID`
- `TrackStatus`: `DRAFT` → `PENDING_REVIEW` → `PUBLISHED` → `ARCHIVED` (archive is the only terminal state; physical deletion is forbidden)
- `Genre`: `POP`, `TRADITIONAL`, `ROCK`, `RAP`, `ELECTRONIC`, `CLASSICAL`, `FUSION`
- `InvitationStatus`: `PENDING`, `ACCEPTED`, `WAITLISTED`
- `AuditEventType`: `LOGIN`, `LOGOUT`, `DEVICE_CHANGE`, `PURCHASE`, `DONATION`, `PUBLISHING`, `SETTLEMENT`, `ADMIN_ACTION`

## Notable design decisions

- **Revenue share** is stored on `artists.revenue_share_bps` as basis points
  (`9000` = 90.00%), defaulting to the locked 90/10 split. An administrator
  overriding a specific artist's split is a single column update, not a
  schema change.
- **Purchases are track-only.** There is no `album_id` on `purchases` and no
  album-purchase table; the spec disables album purchases for the beta.
- **No physical deletion.** No relation in the schema cascades a delete;
  required relations default to `RESTRICT`, optional ones to `SET NULL`
  (Prisma's standard defaults). Tracks move to `ARCHIVED` instead of being
  removed.
- **Wallets belong to artists, not users.** The specification lists a
  `wallets` entity and a `GET /wallet` endpoint, but also says "no user
  wallet." Read together with the donation and settlement rules, `wallets`
  is the artist's earnings ledger; there is no listener-facing wallet.

## Local development

```bash
cp packages/database/.env.example packages/database/.env
# Requires a reachable Postgres — e.g. via
# docker compose -f infrastructure/docker/docker-compose.yml up -d postgres

pnpm --filter @ritma/database db:migrate:dev     # apply migrations, regenerate the client
pnpm --filter @ritma/database db:generate        # regenerate the client only
```

Migrations live in `packages/database/prisma/migrations/` and are applied
in production with `db:migrate:deploy`.
