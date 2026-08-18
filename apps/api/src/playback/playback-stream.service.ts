import { type Readable } from 'node:stream';

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { type FlacBoundaryOutcome, findFlacBoundary } from './flac-boundary';
import { PlaybackSessionService } from './playback-session.service';
import { PREVIEW_BOUNDARY_PROBE_BYTES, PREVIEW_SECONDS } from './playback.constants';
import { computeEffectiveRange, type RangeResult } from './range';
import { StorageService } from './storage.service';

export type PreparedStream =
  | { status: 200 | 206; start: number; end: number; contentLimit: number; stream: Readable }
  | { status: 416; contentLimit: number };

async function readAllChunks(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Orchestrates a single stream request: resolves the session's access tier
 * into a servable content limit (the full object for FULL_FREE/
 * FULL_PURCHASED, or the exact FLAC frame boundary at/before 30 seconds
 * for PREVIEW), then clamps whatever Range the client asked for against
 * that limit — never the other way around.
 */
@Injectable()
export class PlaybackStreamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: PlaybackSessionService,
    private readonly storageService: StorageService,
  ) {}

  async prepare(
    userId: string,
    sessionId: string,
    rangeHeader: string | undefined,
  ): Promise<PreparedStream> {
    const session = await this.sessionService.getActiveSessionForUser(userId, sessionId);
    const track = await this.prisma.track.findUnique({ where: { id: session.trackId } });
    if (!track) {
      throw new NotFoundException('Track not found');
    }

    const objectSize = await this.storageService.getObjectSize(track.flacFileUrl);
    const contentLimit =
      session.accessType === 'PREVIEW'
        ? await this.resolvePreviewLimit(track.flacFileUrl, objectSize)
        : objectSize;

    const range: RangeResult = computeEffectiveRange(rangeHeader, contentLimit);
    if (range.status === 416) {
      return { status: 416, contentLimit };
    }

    const stream = await this.storageService.readRange(track.flacFileUrl, range.start, range.end);
    return { status: range.status, start: range.start, end: range.end, contentLimit, stream };
  }

  private async resolvePreviewLimit(flacFileUrl: string, objectSize: number): Promise<number> {
    const probeSize = Math.min(objectSize, PREVIEW_BOUNDARY_PROBE_BYTES);
    const outcome = await this.boundaryFor(flacFileUrl, probeSize, probeSize === objectSize);

    if (outcome.kind === 'boundary') return outcome.byteOffset;
    if (outcome.kind === 'whole-stream-within-target') return objectSize;

    // The probe didn't cover enough of an unusually high-bitrate file to
    // resolve the boundary — fetch the rest once rather than guess a
    // bigger constant.
    const finalOutcome = await this.boundaryFor(flacFileUrl, objectSize, true);
    return finalOutcome.kind === 'boundary' ? finalOutcome.byteOffset : objectSize;
  }

  private async boundaryFor(
    flacFileUrl: string,
    probeSize: number,
    coversWholeFile: boolean,
  ): Promise<FlacBoundaryOutcome> {
    const stream = await this.storageService.readRange(flacFileUrl, 0, probeSize - 1);
    const buffer = await readAllChunks(stream);
    return findFlacBoundary(buffer, PREVIEW_SECONDS, coversWholeFile);
  }
}
