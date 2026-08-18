-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('LISTENER', 'ARTIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "track_type" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "track_status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "genre" AS ENUM ('POP', 'TRADITIONAL', 'ROCK', 'RAP', 'ELECTRONIC', 'CLASSICAL', 'FUSION');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "audit_event_type" AS ENUM ('LOGIN', 'LOGOUT', 'DEVICE_CHANGE', 'PURCHASE', 'DONATION', 'PUBLISHING', 'SETTLEMENT', 'ADMIN_ACTION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'LISTENER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "label" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "revenue_share_bps" INTEGER NOT NULL DEFAULT 9000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cover_image_url" TEXT NOT NULL,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "album_id" TEXT,
    "title" TEXT NOT NULL,
    "genre" "genre" NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "type" "track_type" NOT NULL,
    "price" DECIMAL(10,2),
    "flac_file_url" TEXT NOT NULL,
    "cover_image_url" TEXT NOT NULL,
    "credits" TEXT,
    "story" TEXT,
    "status" "track_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lyrics" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "synced_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lyrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_tracks" (
    "id" TEXT NOT NULL,
    "playlist_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "price_paid" DECIMAL(10,2) NOT NULL,
    "artist_share" DECIMAL(10,2) NOT NULL,
    "platform_share" DECIMAL(10,2) NOT NULL,
    "payment_reference" TEXT NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_reference" TEXT NOT NULL,
    "donated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "recorded_by_id" TEXT NOT NULL,
    "note" TEXT,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "inviter_id" TEXT NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "redeemed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemed_at" TIMESTAMP(3),

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playback_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "stream_token" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "playback_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "event_type" "audit_event_type" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "devices_user_id_revoked_at_idx" ON "devices"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_fingerprint_key" ON "devices"("user_id", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "artists_user_id_key" ON "artists"("user_id");

-- CreateIndex
CREATE INDEX "albums_artist_id_idx" ON "albums"("artist_id");

-- CreateIndex
CREATE INDEX "tracks_artist_id_idx" ON "tracks"("artist_id");

-- CreateIndex
CREATE INDEX "tracks_album_id_idx" ON "tracks"("album_id");

-- CreateIndex
CREATE INDEX "tracks_status_idx" ON "tracks"("status");

-- CreateIndex
CREATE INDEX "tracks_genre_idx" ON "tracks"("genre");

-- CreateIndex
CREATE UNIQUE INDEX "lyrics_track_id_key" ON "lyrics"("track_id");

-- CreateIndex
CREATE INDEX "playlists_user_id_idx" ON "playlists"("user_id");

-- CreateIndex
CREATE INDEX "playlist_tracks_track_id_idx" ON "playlist_tracks"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_tracks_playlist_id_track_id_key" ON "playlist_tracks"("playlist_id", "track_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_user_id_track_id_key" ON "purchases"("user_id", "track_id");

-- CreateIndex
CREATE INDEX "donations_artist_id_idx" ON "donations"("artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_artist_id_key" ON "wallets"("artist_id");

-- CreateIndex
CREATE INDEX "settlements_wallet_id_idx" ON "settlements"("wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_code_key" ON "invitations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_redeemed_by_id_key" ON "invitations"("redeemed_by_id");

-- CreateIndex
CREATE INDEX "invitations_inviter_id_idx" ON "invitations"("inviter_id");

-- CreateIndex
CREATE INDEX "invitations_status_idx" ON "invitations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "playback_sessions_stream_token_key" ON "playback_sessions"("stream_token");

-- CreateIndex
CREATE INDEX "playback_sessions_user_id_ended_at_idx" ON "playback_sessions"("user_id", "ended_at");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artists" ADD CONSTRAINT "artists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lyrics" ADD CONSTRAINT "lyrics_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_redeemed_by_id_fkey" FOREIGN KEY ("redeemed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
