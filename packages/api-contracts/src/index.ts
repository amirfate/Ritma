export { API_ROUTES, type ApiRouteKey } from './routes';
export { type HealthResponse, type HealthStatus } from './health';
export type {
  UserRole,
  SendCodeRequest,
  SendCodeResponse,
  VerifyRequest,
  AuthUser,
  VerifyResponse,
  RefreshRequest,
  RefreshResponse,
  MeResponse,
} from './auth';
export type {
  Genre,
  TrackType,
  PageQuery,
  PaginatedResponse,
  PublicArtistQuery,
  PublicArtist,
  PublicAlbumQuery,
  PublicAlbum,
  PublicTrackQuery,
  PublicTrack,
} from './catalog';
export type {
  AdminArtistQuery,
  AdminArtist,
  CreateArtistRequest,
  UpdateArtistRequest,
  AdminAlbumQuery,
  AdminAlbum,
  CreateAlbumRequest,
  UpdateAlbumRequest,
  TrackStatus,
  TrackLifecycleAction,
  AdminTrackQuery,
  AdminTrack,
  CreateTrackRequest,
  UpdateTrackRequest,
  LyricsResponse,
  CreateLyricsRequest,
  UpdateLyricsRequest,
} from './admin-catalog';
export type { PlaybackAccessType, CreateSessionRequest, PlaybackSessionResponse } from './playback';
