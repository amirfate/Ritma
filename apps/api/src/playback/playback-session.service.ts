import { randomUUID } from 'node:crypto';

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type PlaybackSession } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { resolvePlaybackAccessType } from './playback-access';
import { PLAYBACK_SESSION_MAX_DURATION_MS } from './playback.constants';
import { ConcurrentPlaybackSessionError } from './playback.errors';

/**
 * Session creation/end and the "one active session per listener" rule.
 * Reclaiming an abandoned session is TTL-based and lazy: a session past
 * `PLAYBACK_SESSION_MAX_DURATION_MS` simply stops counting as active for
 * the concurrency check; this service also marks it `endedAt` at that
 * point as a data-hygiene side effect, not because correctness depends on
 * it (Milestone 5 decision — no heartbeat, no background sweep).
 */
@Injectable()
export class PlaybackSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, deviceId: string, trackId: string): Promise<PlaybackSession> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.revokedAt || device.userId !== userId) {
      throw new ForbiddenException('This device is not authorized for this account');
    }

    const track = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!track) {
      throw new NotFoundException('Track not found');
    }
    if (track.status !== 'PUBLISHED') {
      throw new NotFoundException('Track not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const ttlCutoff = new Date(Date.now() - PLAYBACK_SESSION_MAX_DURATION_MS);

      const activeSession = await tx.playbackSession.findFirst({
        where: { userId, endedAt: null, startedAt: { gt: ttlCutoff } },
      });
      if (activeSession) {
        throw new ConcurrentPlaybackSessionError();
      }

      await tx.playbackSession.updateMany({
        where: { userId, endedAt: null, startedAt: { lte: ttlCutoff } },
        data: { endedAt: new Date() },
      });

      const purchase =
        track.type === 'PAID'
          ? await tx.purchase.findUnique({ where: { userId_trackId: { userId, trackId } } })
          : null;
      const accessType = resolvePlaybackAccessType(track.type, purchase !== null);

      return tx.playbackSession.create({
        data: { userId, deviceId, trackId, streamToken: randomUUID(), accessType },
      });
    });
  }

  /** Fetches a session, verifying it belongs to `userId` and is still active. */
  async getActiveSessionForUser(userId: string, sessionId: string): Promise<PlaybackSession> {
    const session = await this.prisma.playbackSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Playback session not found');
    }
    const ttlCutoff = new Date(Date.now() - PLAYBACK_SESSION_MAX_DURATION_MS);
    if (session.userId !== userId || session.endedAt !== null || session.startedAt <= ttlCutoff) {
      throw new NotFoundException('Playback session not found');
    }
    return session;
  }

  /** Explicit end — idempotent if already ended. */
  async endSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.playbackSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Playback session not found');
    }
    if (session.userId !== userId) {
      throw new NotFoundException('Playback session not found');
    }
    if (session.endedAt !== null) {
      return;
    }
    await this.prisma.playbackSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });
  }
}
