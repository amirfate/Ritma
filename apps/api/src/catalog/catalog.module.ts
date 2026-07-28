import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AlbumAdminController } from './album/album.admin.controller';
import { AlbumPublicController } from './album/album.public.controller';
import { AlbumService } from './album/album.service';
import { ArtistAdminController } from './artist/artist.admin.controller';
import { ArtistPublicController } from './artist/artist.public.controller';
import { ArtistService } from './artist/artist.service';
import { LyricsAdminController } from './lyrics/lyrics.admin.controller';
import { LyricsService } from './lyrics/lyrics.service';
import { TrackAdminController } from './track/track.admin.controller';
import { TrackPublicController } from './track/track.public.controller';
import { TrackService } from './track/track.service';

/**
 * The Music Catalog core (Artist/Album/Track/Lyrics). Imports `AuthModule`
 * for `JwtAuthGuard`/`TokenService` (needed by every admin controller's
 * `@UseGuards(JwtAuthGuard, RolesGuard)`) — a one-directional dependency;
 * unlike `InvitationModule` in the auth milestone, nothing in `AuthModule`
 * needs anything from here, so there's no circular import to work around.
 */
@Module({
  imports: [AuthModule],
  controllers: [
    ArtistAdminController,
    ArtistPublicController,
    AlbumAdminController,
    AlbumPublicController,
    TrackAdminController,
    TrackPublicController,
    LyricsAdminController,
  ],
  providers: [ArtistService, AlbumService, TrackService, LyricsService],
})
export class CatalogModule {}
