/**
 * Route path segments served by the Ritma API, without a leading slash,
 * as expected by Nest's `@Controller()` decorator and client base-URL joins.
 */
export const API_ROUTES = {
  health: 'health',

  authSendCode: 'auth/send-code',
  authVerify: 'auth/verify',
  authRefresh: 'auth/refresh',
  authLogout: 'auth/logout',
  authMe: 'auth/me',

  artists: 'artists',
  artistById: 'artists/:id',

  adminArtists: 'admin/artists',

  albums: 'albums',
  albumById: 'albums/:id',

  adminAlbums: 'admin/albums',

  tracks: 'tracks',
  trackById: 'tracks/:id',

  adminTracks: 'admin/tracks',

  playbackSessions: 'playback/sessions',
  playbackSessionStream: 'playback/sessions/:id/stream',
  playbackSessionEnd: 'playback/sessions/:id/end',
} as const;

export type ApiRouteKey = keyof typeof API_ROUTES;
