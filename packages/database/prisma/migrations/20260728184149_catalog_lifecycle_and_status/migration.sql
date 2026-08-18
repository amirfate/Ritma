-- Rename PENDING_REVIEW -> READY, and add UNPUBLISHED, to match the
-- locked Milestone 4 track lifecycle: DRAFT -> READY -> PUBLISHED ->
-- UNPUBLISHED -> ARCHIVED. Hand-written because Prisma's migration diff
-- cannot distinguish a rename from a removal (same reasoning as the
-- rename_audit_event_publish migration).
ALTER TYPE "track_status" RENAME VALUE 'PENDING_REVIEW' TO 'READY';
ALTER TYPE "track_status" ADD VALUE 'UNPUBLISHED' AFTER 'PUBLISHED';

-- AlterTable
ALTER TABLE "artists" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "albums" ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "artists_is_active_idx" ON "artists"("is_active");

-- CreateIndex
CREATE INDEX "albums_is_published_idx" ON "albums"("is_published");
