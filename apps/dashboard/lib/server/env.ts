const DEFAULT_DEV_API_BASE_URL = 'http://localhost:3000';

/**
 * Server-only — never prefixed `NEXT_PUBLIC_`, so it is never bundled into
 * client JavaScript. The Dashboard's browser code never talks to the
 * Ritma API directly; every request is proxied through this app's own
 * Route Handlers, which is also why no CORS configuration is needed on
 * the API side for the Dashboard.
 */
export function getRitmaApiBaseUrl(): string {
  const value = process.env.RITMA_API_BASE_URL;
  if (value) {
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('RITMA_API_BASE_URL must be set in production.');
  }
  return DEFAULT_DEV_API_BASE_URL;
}
