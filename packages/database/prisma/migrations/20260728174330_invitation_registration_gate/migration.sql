-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_event_type" ADD VALUE 'INVITATION_CREATED';
ALTER TYPE "audit_event_type" ADD VALUE 'INVITATION_ACCEPTED';
ALTER TYPE "audit_event_type" ADD VALUE 'INVITATION_REJECTED';

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "invitee_phone_number" TEXT;
