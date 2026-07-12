/**
 * Type scale following the Material 3 roles used by the Android app.
 * Sizes and line heights are in scalable pixels (sp on Android).
 */
export interface TypeStyle {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: 400 | 500 | 700;
  readonly letterSpacing: number;
}

export const typography = {
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: 400, letterSpacing: 0 },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: 400, letterSpacing: 0 },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: 400, letterSpacing: 0 },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: 500, letterSpacing: 0.15 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: 400, letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: 400, letterSpacing: 0.25 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: 500, letterSpacing: 0.1 },
} as const satisfies Record<string, TypeStyle>;

export type TypographyToken = keyof typeof typography;
