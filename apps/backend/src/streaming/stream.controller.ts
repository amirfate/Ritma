import { Controller, Get, Header, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { StreamService } from './stream.service';

/**
 * Public (signature-gated) audio endpoint. The <audio> tag cannot send an
 * Authorization header, so access is granted via the signed stream-url
 * returned by GET /tracks/:id/stream-url.
 */
@Controller('tracks')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Get(':id/stream')
  @Header('Accept-Ranges', 'bytes')
  play(
    @Param('id') id: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.streamService.pipe(id, Number(exp), sig, req.headers.range, res);
  }
}
