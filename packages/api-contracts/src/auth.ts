/**
 * Roles defined by the locked specification.
 */
export type UserRole = 'LISTENER' | 'ARTIST' | 'ADMIN';

/**
 * Request body of `POST /auth/send-code`.
 */
export interface SendCodeRequest {
  phoneNumber: string;
}

/**
 * Response body of `POST /auth/send-code` (200).
 */
export interface SendCodeResponse {
  cooldownSeconds: number;
}

/**
 * Request body of `POST /auth/verify`. `invitationCode` is required only
 * when `phoneNumber` has no existing account (first-time registration) —
 * a returning user's login never needs one. `devicePlatform` is `'android'`
 * for the native app or `'web'` for the Dashboard's browser-based login.
 */
export interface VerifyRequest {
  phoneNumber: string;
  code: string;
  deviceFingerprint: string;
  devicePlatform: 'android' | 'web';
  deviceLabel?: string;
  invitationCode?: string;
}

export interface AuthUser {
  id: string;
  phoneNumber: string;
  role: UserRole;
}

/**
 * Response body of `POST /auth/verify` (200).
 */
export interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/**
 * Request body of `POST /auth/refresh`.
 */
export interface RefreshRequest {
  refreshToken: string;
}

/**
 * Response body of `POST /auth/refresh` (200). The presented refresh token
 * is invalidated on use — this pair replaces it, it does not extend it.
 */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Response body of `GET /auth/me` (200). Requires a bearer access token.
 */
export type MeResponse = AuthUser;

/**
 * `POST /auth/logout` requires a bearer access token, takes no request
 * body, and returns `204 No Content` — no response type applies.
 */
