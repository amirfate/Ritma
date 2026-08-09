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

  albums: 'albums',
  albumById: 'albums/:id',

  tracks: 'tracks',
  trackById: 'tracks/:id',

  playbackSessions: 'playback/sessions',
  playbackSessionStream: 'playback/sessions/:id/stream',
  playbackSessionEnd: 'playback/sessions/:id/end',
} as const;

export type ApiRouteKey = keyof typeof API_ROUTES;
