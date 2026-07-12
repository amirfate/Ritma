/**
 * Corner radius scale in density-independent pixels (dp on Android).
 */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
