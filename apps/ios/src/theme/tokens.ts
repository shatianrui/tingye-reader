/**
 * Design tokens for the 听页 app chrome (1.9 Figma redesign).
 *
 * The reading surface keeps its own palette (`src/tingye/themes.ts`) because
 * reading mode must not depend on the host app's chrome theme.
 *
 * This file is the single source of truth for the rest of the app:
 * navigation, shelves, lists, detail pages, search, profile and account.
 *
 * Color palette: warm forest green (#2B5C4B) on paper (#F6F3EA) with a gold
 * accent (#C9A259). Role names follow Material 3 so surfaces stay layered
 * without heavy shadows.
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
  primary: '#2B5C4B',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E2EBE4',
  onPrimaryContainer: '#1C3E33',
  secondary: '#6E776F',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E2EBE4',
  onSecondaryContainer: '#1C3E33',
  tertiary: '#C9A259',
  onTertiary: '#1E2A23',
  tertiaryContainer: '#EFDFB4',
  onTertiaryContainer: '#4A3A14',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
  background: '#F6F3EA',
  onBackground: '#1E2A23',
  surface: '#F6F3EA',
  onSurface: '#1E2A23',
  surfaceVariant: '#EDE9DD',
  onSurfaceVariant: '#6E776F',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FFFDF8',
  surfaceContainer: '#F1EDE2',
  surfaceContainerHigh: '#ECE7DA',
  surfaceContainerHighest: '#E6E1D4',
  outline: '#A5ABA2',
  outlineVariant: '#E6E1D4',
  shadow: '#1E2A23',
  scrim: '#000000',
  inverseSurface: '#1C3E33',
  inverseOnSurface: '#F6F3EA',
  inversePrimary: '#9FC7B5',
};

export const darkColors: AppColors = {
  primary: '#9FC7B5',
  onPrimary: '#0F2A21',
  primaryContainer: '#244A3C',
  onPrimaryContainer: '#DDEBE3',
  secondary: '#A9B3AB',
  onSecondary: '#1C2621',
  secondaryContainer: '#2A3A32',
  onSecondaryContainer: '#DDEBE3',
  tertiary: '#D9B870',
  onTertiary: '#2E230A',
  tertiaryContainer: '#4A3A14',
  onTertiaryContainer: '#EFDFB4',
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  background: '#111A16',
  onBackground: '#E6E8E2',
  surface: '#111A16',
  onSurface: '#E6E8E2',
  surfaceVariant: '#26322C',
  onSurfaceVariant: '#A9B3AB',
  surfaceContainerLowest: '#0B120F',
  surfaceContainerLow: '#18231E',
  surfaceContainer: '#1D2923',
  surfaceContainerHigh: '#243029',
  surfaceContainerHighest: '#2C3931',
  outline: '#6E776F',
  outlineVariant: '#2C3931',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#E6E8E2',
  inverseOnSurface: '#1E2A23',
  inversePrimary: '#2B5C4B',
};

export const brand = {
  gold: '#C9A259',
  highlight: '#EFDFB4',
  deep: '#1C3E33',
  green: '#2B5C4B',
  // Bundled Noto Serif CJK SC (registered by useReaderFonts). iOS does not
  // preinstall Songti SC, so naming it silently fell back to PingFang.
  serif: 'ReaderSerif',
  onBrand: '#F6F3EA',
  deepest: '#0F241C',
  ink: '#1E2A23',
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