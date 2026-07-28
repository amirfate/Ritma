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
- `AuditEventType`: `LOGIN`, `LOGOUT`, `DEVICE_CHANGE`, `PURCHASE`, `DONATION`, `PUBLISH`, `SETTLEMENT`, `ADMIN_ACTION`, `INVITATION_CREATED`, `INVITATION_ACCEPTED`, `INVITATION_REJECTED`

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
  `users` has no wallet relation at all — only `artists` does, via a
  unique `artist_id` foreign key.
- **Wallets act only as an earnings ledger — no top-up, no automatic
  withdrawal.** The only two things that can change a wallet's balance are
  a `Purchase`'s artist share or a `Donation` (both increases, both tied to
  a real, independently-auditable commerce event with a payment reference)
  and a `Settlement` (a decrease). There is no schema path for injecting
  arbitrary funds. Two CHECK constraints, added in the
  `wallet_ledger_invariants` migration since Prisma's schema DSL has no
  declarative check-constraint attribute in the pinned version, hold this
  at the database layer regardless of what application code attempts:
  - `wallets_balance_non_negative` (`balance >= 0`) — a wallet can never be
    over-settled into negative territory.
  - `settlements_amount_positive` (`amount > 0`) — a settlement is always a
    positive reduction; it can never be used to increase a balance.

  `settlements.recorded_by_id` is also required and non-nullable, so every
  balance-reducing row is attributable to a specific administrator's
  action — there is no scheduled or automatic settlement path.

- **`invitations.invitee_phone_number` is nullable and set at two possible
  points**: at creation, if the inviter already knows who they're inviting,
  or at redemption time, filled in from the phone number actually used. If
  it was set at creation, redemption is rejected unless the phone number
  matches — this stops one invitation code being redeemed by an arbitrary
  third party who intercepts it. The global 100-user cap and 10-invites-
  per-inviter limit are enforced transactionally by the invitation module
  (see [docs/architecture.md](architecture.md#invitations)), not by a
  schema constraint, since they require counting rows across a
  concurrency-safe critical section rather than a static check.

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
