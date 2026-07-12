/**
 * Status values reported by the health endpoint.
 */
export type HealthStatus = 'ok';

/**
 * Response body of `GET /health`.
 */
export interface HealthResponse {
  readonly status: HealthStatus;
}
