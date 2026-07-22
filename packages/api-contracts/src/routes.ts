/**
 * Route path segments served by the Ritma API, without a leading slash,
 * as expected by Nest's `@Controller()` decorator and client base-URL joins.
 */
export const API_ROUTES = {
  health: 'health',
} as const;

export type ApiRouteKey = keyof typeof API_ROUTES;
