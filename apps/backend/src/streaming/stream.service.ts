import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { validateStreamSignature } from './stream-sign';

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Serves local audio files placed in MEDIA_DIR by the admin (per the
   * locked beta spec: no upload UI — admin drops files and registers audioUrl).
   * Range requests are honored so <audio> can seek.
   */
  async pipe(
    trackId: string,
    exp: number,
    sig: string,
    rangeHeader: string | undefined,
    res: Response,
  ): Promise<void> {
    if (!validateStreamSignature(trackId, exp, sig)) {
      res.status(403).json({ error: 'امضای استریم نامعتبر است' });
      return;
    }
    const track = await this.prisma.track.findUnique({
      where: { id: trackId },
      select: { id: true, title: true, audioUrl: true },
    });
    if (!track || !track.audioUrl) throw new NotFoundException('فایل صوتی این ترک ثبت نشده است');

    const filePath = resolveMediaPath(track.audioUrl);
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      this.logger.warn(`audio file missing for track ${trackId}: ${track.audioUrl}`);
      throw new NotFoundException('فایل صوتی روی سرور پیدا نشد');
    }

    const size = statSync(filePath).size;
    const contentType = contentTypeFor(filePath);
    const base = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=240',
    };

    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader ?? '');
    if (match) {
      let start = match[1] === '' ? NaN : Number(match[1]);
      let end = match[2] === '' ? NaN : Number(match[2]);
      if (Number.isNaN(start)) {
        // suffix range: bytes=-N → last N bytes
        const n = Number(match[2]);
        start = Math.max(0, size - n);
        end = size - 1;
      }
      if (Number.isNaN(end) || end >= size) end = size - 1;
      if (start > end || start >= size) {
        res.writeHead(416, { ...base, 'Content-Range': `bytes */${size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        ...base,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1,
      });
      createReadStream(filePath, { start, end }).pipe(res);
      this.logger.log(`stream ${trackId} [${start}-${end}]`);
      return;
    }

    res.writeHead(200, { ...base, 'Content-Length': size });
    createReadStream(filePath).pipe(res);
    this.logger.log(`stream ${trackId} full (${size} bytes)`);
  }
}

/** Resolve an audioUrl to a file inside MEDIA_DIR; null when unsafe. */
function resolveMediaPath(rawKey: string): string | null {
  const mediaDir = process.env.MEDIA_DIR;
  if (!mediaDir) return null;
  // accept both "audio/demo.mp3" and "media/audio/demo.mp3"
  const key = rawKey.replace(/^\/+/, '').replace(/^media\//, '');
  const path = `${mediaDir}/${key}`;
  if (path.includes('..')) return null;
  return path;
}

function contentTypeFor(file: string): string {
  if (file.endsWith('.flac')) return 'audio/flac';
  if (file.endsWith('.m4a') || file.endsWith('.mp4')) return 'audio/mp4';
  if (file.endsWith('.aac')) return 'audio/aac';
  if (file.endsWith('.ogg')) return 'audio/ogg';
  return 'audio/mpeg';
}
