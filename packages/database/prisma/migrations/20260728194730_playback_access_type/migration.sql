/*
  Warnings:

  - Added the required column `access_type` to the `playback_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "playback_access_type" AS ENUM ('PREVIEW', 'FULL_FREE', 'FULL_PURCHASED');

-- AlterTable
ALTER TABLE "playback_sessions" ADD COLUMN     "access_type" "playback_access_type" NOT NULL;
