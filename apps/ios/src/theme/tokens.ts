/**
 * Material You (Material Design 3) design tokens for the we_reader's system UI.
 *
 * The reading surface (ReaderScreen) keeps its own dedicated palette
 * (`readerThemes.ts`) because reading mode is a focused, opt-in state that
 * should not depend on the host app's chrome theme.
 *
 * This file is the single source of truth for the rest of the app:
 * navigation, shelves, lists, detail pages, search, profile and tingye.
 *
 * Color palette: Material 3 roles filled from the reader's own themes — light
 * follows 暖纸 (paper), dark follows 深林 (forest) — so the chrome and the page
 * share one colour temperature. Surface roles are layered to express
 * hierarchy without heavy shadows.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Color roles
// ---------------------------------------------------------------------------

export interface AppColors {
  // Primary
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;

  // Secondary
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;

  // Tertiary
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;

  // Error
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  // Surface family
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;

  // Surface containers (tonal elevation ladder)
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;

  // Outline
  outline: string;
  outlineVariant: string;

  // Inverse / shadow
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

// Warm "paper" chrome that matches the reader's default 暖纸 theme, so moving
// between the library and a book doesn't jump from cool teal to warm cream.
export const lightColors: AppColors = {
  primary: '#2B5C4B',
  onPrimary: '#FFFFFF',
  primaryContainer: '#CFE3D6',
  onPrimaryContainer: '#0F2A20',

  secondary: '#56655C',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E1EADF',
  onSecondaryContainer: '#1A2A21',

  tertiary: '#7A5A3A',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F2DFC8',
  onTertiaryContainer: '#2B1A08',

  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',

  background: '#F9F6ED',
  onBackground: '#283C31',
  surface: '#FFFEFA',
  onSurface: '#283C31',
  surfaceVariant: '#E8E4D8',
  onSurfaceVariant: '#5A665E',

  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FBF8F1',
  surfaceContainer: '#F3EFE4',
  surfaceContainerHigh: '#EDE9DD',
  surfaceContainerHighest: '#E7E3D6',

  outline: '#7E857C',
  outlineVariant: '#D9D5C8',

  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#2E3A33',
  inverseOnSurface: '#F3F0E6',
  inversePrimary: '#9FD1B9',
};

export const darkColors: AppColors = {
  primary: '#A8C4AC',
  onPrimary: '#10251B',
  primaryContainer: '#2C4A3B',
  onPrimaryContainer: '#CDE6D3',

  secondary: '#B7C8BA',
  onSecondary: '#22332A',
  secondaryContainer: '#34463B',
  onSecondaryContainer: '#D3E4D6',

  tertiary: '#E3C39F',
  onTertiary: '#3F2B12',
  tertiaryContainer: '#5A4127',
  onTertiaryContainer: '#FFE0BF',

  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',

  background: '#141D18',
  onBackground: '#DDDCCD',
  surface: '#17251F',
  onSurface: '#DDDCCD',
  surfaceVariant: '#34443A',
  onSurfaceVariant: '#B3C0B5',

  surfaceContainerLowest: '#101814',
  surfaceContainerLow: '#1A2620',
  surfaceContainer: '#1E2B24',
  surfaceContainerHigh: '#25332B',
  surfaceContainerHighest: '#2D3B33',

  outline: '#8C998F',
  outlineVariant: '#3B4A40',

  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#DDDCCD',
  inverseOnSurface: '#1E2B24',
  inversePrimary: '#2B5C4B',
};

// ---------------------------------------------------------------------------
// Typography (Material 3 type scale)
// ---------------------------------------------------------------------------

const baseFontFamily = Platform.select({
  android: 'sans-serif',
  ios: 'System',
  default: 'System',
});

const mediumFontFamily = Platform.select({
  android: 'sans-serif-medium',
  ios: 'System',
  default: 'System',
});

export const typography = {
  displayLarge: { fontFamily: baseFontFamily, fontSize: 57, lineHeight: 64, fontWeight: '400' as const, letterSpacing: -0.25 },
  displayMedium: { fontFamily: baseFontFamily, fontSize: 45, lineHeight: 52, fontWeight: '400' as const },
  displaySmall: { fontFamily: baseFontFamily, fontSize: 36, lineHeight: 44, fontWeight: '400' as const },

  headlineLarge: { fontFamily: baseFontFamily, fontSize: 32, lineHeight: 40, fontWeight: '400' as const },
  headlineMedium: { fontFamily: baseFontFamily, fontSize: 28, lineHeight: 36, fontWeight: '400' as const },
  headlineSmall: { fontFamily: baseFontFamily, fontSize: 24, lineHeight: 32, fontWeight: '400' as const },

  titleLarge: { fontFamily: mediumFontFamily, fontSize: 22, lineHeight: 28, fontWeight: '500' as const },
  titleMedium: { fontFamily: mediumFontFamily, fontSize: 16, lineHeight: 24, fontWeight: '500' as const, letterSpacing: 0.15 },
  titleSmall: { fontFamily: mediumFontFamily, fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.1 },

  bodyLarge: { fontFamily: baseFontFamily, fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.5 },
  bodyMedium: { fontFamily: baseFontFamily, fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodySmall: { fontFamily: baseFontFamily, fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.4 },

  labelLarge: { fontFamily: mediumFontFamily, fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.1 },
  labelMedium: { fontFamily: mediumFontFamily, fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.5 },
  labelSmall: { fontFamily: mediumFontFamily, fontSize: 11, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.5 },
} as const;

export type TypographyToken = keyof typeof typography;

// ---------------------------------------------------------------------------
// Shape (Material 3 corner radius scale)
// ---------------------------------------------------------------------------

export const shape = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Motion (Material 3 emphasized / standard easing tokens)
// ---------------------------------------------------------------------------

export const motion = {
  durationShort1: 50,
  durationShort2: 100,
  durationMedium1: 200,
  durationMedium2: 250,
  durationLong1: 400,
} as const;

// ---------------------------------------------------------------------------
// Elevation tiers (1–5). Used only as a fallback when surfaceContainer is not
// expressive enough; Material 3 prefers tonal layering over shadows.
// ---------------------------------------------------------------------------

export const elevation = {
  level0: {
    shadowOpacity: 0,
    elevation: 0,
  },
  level1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  level2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  level3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  level4: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;