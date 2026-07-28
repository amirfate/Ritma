import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PlaybackController } from './playback.controller';
import { PlaybackSessionService } from './playback-session.service';
import { PlaybackStreamService } from './playback-stream.service';
import { StorageService } from './storage.service';

/**
 * Streaming & Playback Access Core (Milestone 5). Imports `AuthModule` for
 * `JwtAuthGuard` only — one-directional, same pattern as `CatalogModule`.
 * No role restriction: streaming is a plain authenticated-listener
 * capability (§11).
 */
@Module({
  imports: [AuthModule],
  controllers: [PlaybackController],
  providers: [PlaybackSessionService, PlaybackStreamService, StorageService],
})
export class PlaybackModule {}
