import { Controller, ForbiddenException, Get, Logger, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { validateStreamSignature } from './stream-sign';

@Controller('tracks')
export class StreamController {
  private readonly logger = new Logger(StreamController.name);

  @UseGuards(JwtAuthGuard)
  @Get(':id/stream')
  stream(@Param('id') id: string, @Req() req: Request): { error?: string } {
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? '');
    if (!validateStreamSignature(id, exp, sig)) {
      throw new ForbiddenException('امضای استریم نامعتبر است');
    }
    // In production the request is proxied to MinIO / the CDN with these
    // validated parameters; in local dev we only confirm the signature.
    this.logger.log(`stream authorized for track ${id}`);
    return { error: 'audio source not configured' };
  }
}
