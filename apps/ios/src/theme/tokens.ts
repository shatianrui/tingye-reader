/**
 * Design tokens for the 听页 app chrome (2.0 极简现代 redesign).
 *
 * The reading surface keeps its own palette (`src/tingye/themes.ts`) because
 * reading mode must not depend on the host app's chrome theme.
 *
 * This file is the single source of truth for the rest of the app:
 * navigation, shelves, lists, detail pages, search, profile and account.
 *
 * Color palette: neutral monochrome — near-black ink on white, layered gray
 * surfaces, hairline dividers. No shadows, no gradients; depth comes from
 * tonal layering only. The brand gold (#C9A259) survives only in `brand.*`
 * as a sparing accent for the player highlight.
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
  primary: '#1C1C1E',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E8E8ED',
  onPrimaryContainer: '#1C1C1E',
  secondary: '#636366',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8E8ED',
  onSecondaryContainer: '#1C1C1E',
  tertiary: '#8A8A8E',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F2F2F7',
  onTertiaryContainer: '#3A3A3C',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
  background: '#FFFFFF',
  onBackground: '#1C1C1E',
  surface: '#FFFFFF',
  onSurface: '#1C1C1E',
  surfaceVariant: '#F2F2F7',
  onSurfaceVariant: '#636366',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FAFAFC',
  surfaceContainer: '#F5F5F7',
  surfaceContainerHigh: '#ECECF0',
  surfaceContainerHighest: '#E5E5EA',
  outline: '#AEAEB2',
  outlineVariant: '#E5E5EA',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#1C1C1E',
  inverseOnSurface: '#F5F5F7',
  inversePrimary: '#F5F5F7',
};

export const darkColors: AppColors = {
  primary: '#F5F5F7',
  onPrimary: '#1C1C1E',
  primaryContainer: '#2C2C2E',
  onPrimaryContainer: '#F5F5F7',
  secondary: '#98989D',
  onSecondary: '#1C1C1E',
  secondaryContainer: '#2C2C2E',
  onSecondaryContainer: '#F5F5F7',
  tertiary: '#8A8A8E',
  onTertiary: '#1C1C1E',
  tertiaryContainer: '#1C1C1E',
  onTertiaryContainer: '#D1D1D6',
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  background: '#000000',
  onBackground: '#F5F5F7',
  surface: '#000000',
  onSurface: '#F5F5F7',
  surfaceVariant: '#1C1C1E',
  onSurfaceVariant: '#98989D',
  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#0A0A0C',
  surfaceContainer: '#161618',
  surfaceContainerHigh: '#1C1C1E',
  surfaceContainerHighest: '#2C2C2E',
  outline: '#48484A',
  outlineVariant: '#2C2C2E',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#F5F5F7',
  inverseOnSurface: '#1C1C1E',
  inversePrimary: '#1C1C1E',
};

export const brand = {
  gold: '#C9A259',
  highlight: '#F0E6CE',
  deep: '#1C1C1E',
  green: '#3A3A3C',
  // Bundled Noto Serif CJK SC (registered by useReaderFonts). iOS does not
  // preinstall Songti SC, so naming it silently fell back to PingFang.
  serif: 'ReaderSerif',
  onBrand: '#F5F5F7',
  deepest: '#000000',
  ink: '#1C1C1E',
  /** Restrained neutral accent: inks in light mode, paper white in dark. */
  accent: '#1C1C1E',
  onAccent: '#FFFFFF',
} as const;

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