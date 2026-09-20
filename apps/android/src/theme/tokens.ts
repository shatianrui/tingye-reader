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
 * Color palette: Material 3 Tonal Spot generated from a green seed (#006B5F).
 * Surface roles are layered to express hierarchy without heavy shadows.
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

export const lightColors: AppColors = {
  primary: '#006B5F',
  onPrimary: '#FFFFFF',
  primaryContainer: '#74F8E6',
  onPrimaryContainer: '#00201C',

  secondary: '#4A635E',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#CCE8E2',
  onSecondaryContainer: '#06201C',

  tertiary: '#436277',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#C9E6FF',
  onTertiaryContainer: '#001E2F',

  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',

  background: '#F4F7F5',
  onBackground: '#181C1B',
  surface: '#FAFDFB',
  onSurface: '#181C1B',
  surfaceVariant: '#DAE5E2',
  onSurfaceVariant: '#3F4946',

  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F1F4F2',
  surfaceContainer: '#EBEEEC',
  surfaceContainerHigh: '#E5E9E7',
  surfaceContainerHighest: '#DFE3E1',

  outline: '#6F7976',
  outlineVariant: '#BEC9C5',

  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#2C322F',
  inverseOnSurface: '#ECF2EF',
  inversePrimary: '#54DBC9',
};

export const darkColors: AppColors = {
  primary: '#54DBC9',
  onPrimary: '#003731',
  primaryContainer: '#005048',
  onPrimaryContainer: '#74F8E6',

  secondary: '#B1CCC6',
  onSecondary: '#1C3531',
  secondaryContainer: '#324B47',
  onSecondaryContainer: '#CCE8E2',

  tertiary: '#ABCBE3',
  onTertiary: '#103449',
  tertiaryContainer: '#2A4B5F',
  onTertiaryContainer: '#C9E6FF',

  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',

  background: '#0F1413',
  onBackground: '#DEE4E1',
  surface: '#0F1413',
  onSurface: '#DEE4E1',
  surfaceVariant: '#3F4946',
  onSurfaceVariant: '#BEC9C5',

  surfaceContainerLowest: '#0A0F0E',
  surfaceContainerLow: '#181C1B',
  surfaceContainer: '#1C2120',
  surfaceContainerHigh: '#272B2A',
  surfaceContainerHighest: '#313634',

  outline: '#899390',
  outlineVariant: '#3F4946',

  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#DEE4E1',
  inverseOnSurface: '#2C322F',
  inversePrimary: '#006B5F',
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