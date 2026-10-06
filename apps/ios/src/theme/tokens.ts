/**
 * Design tokens for the 听页 app chrome (水墨 redesign).
 *
 * The reading surface keeps its own palette (`src/tingye/themes.ts`) because
 * reading mode must not depend on the host app's chrome theme.
 *
 * This file is the single source of truth for the rest of the app:
 * navigation, shelves, lists, detail pages, search, profile and account.
 *
 * Color palette: Chinese ink wash. Warm rice paper (宣纸) grounds, ink tones
 * from 浓墨 to 淡墨 for text and rules, and a single cinnabar (朱砂) accent kept
 * for seals and the listening state. Corners stay nearly square; separation
 * comes from hairlines and double rules rather than shadows.
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
  primary: '#1A1A18',
  onPrimary: '#F4EFE4',
  primaryContainer: '#E6DECD',
  onPrimaryContainer: '#1A1A18',
  secondary: '#4A4843',
  onSecondary: '#F4EFE4',
  secondaryContainer: '#EAE3D3',
  onSecondaryContainer: '#1A1A18',
  tertiary: '#A83226',
  onTertiary: '#F6F0E4',
  tertiaryContainer: '#F1DCD5',
  onTertiaryContainer: '#5C1A12',
  error: '#9B2C2C',
  onError: '#FFFFFF',
  errorContainer: '#F4D8D2',
  onErrorContainer: '#4A0E08',
  background: '#F4EFE4',
  onBackground: '#1A1A18',
  surface: '#F4EFE4',
  onSurface: '#1A1A18',
  surfaceVariant: '#EAE3D3',
  onSurfaceVariant: '#6B6862',
  surfaceContainerLowest: '#FBF9F4',
  surfaceContainerLow: '#FAF7F0',
  surfaceContainer: '#F1EBDF',
  surfaceContainerHigh: '#EAE3D3',
  surfaceContainerHighest: '#E3DBC9',
  outline: '#A9A291',
  outlineVariant: '#D9D1BF',
  shadow: '#1A1A18',
  scrim: '#000000',
  inverseSurface: '#1F1E1B',
  inverseOnSurface: '#F4EFE4',
  inversePrimary: '#F4EFE4',
};

export const darkColors: AppColors = {
  primary: '#EDE6D6',
  onPrimary: '#15140F',
  primaryContainer: '#2E2C27',
  onPrimaryContainer: '#EDE6D6',
  secondary: '#A39D90',
  onSecondary: '#15140F',
  secondaryContainer: '#2A2823',
  onSecondaryContainer: '#EDE6D6',
  tertiary: '#D9705F',
  onTertiary: '#1C1B17',
  tertiaryContainer: '#4A2620',
  onTertiaryContainer: '#F4D8D2',
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  background: '#15140F',
  onBackground: '#EDE6D6',
  surface: '#15140F',
  onSurface: '#EDE6D6',
  surfaceVariant: '#22211C',
  onSurfaceVariant: '#A39D90',
  surfaceContainerLowest: '#100F0B',
  surfaceContainerLow: '#1A1914',
  surfaceContainer: '#1F1E19',
  surfaceContainerHigh: '#26241F',
  surfaceContainerHighest: '#2E2C27',
  outline: '#5C584F',
  outlineVariant: '#33312B',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#EDE6D6',
  inverseOnSurface: '#1A1A18',
  inversePrimary: '#1A1A18',
};

export const brand = {
  /** 朱砂: seals, the listening state and the one active marker per view. */
  cinnabar: '#A83226',
  /** Cinnabar for small text and marks on night-ink grounds (5:1 on #15140F). */
  cinnabarBright: '#D9705F',
  onCinnabar: '#F6F0E4',
  paper: '#F4EFE4',
  /** Sentence highlight wash (淡赭) on paper. */
  highlight: '#E7DCC4',
  /** Night ink ground for the full-screen player. */
  deep: '#15140F',
  onBrand: '#EDE6D6',
  deepest: '#000000',
  ink: '#1A1A18',
  /** Mid ink for mountains and washes; use with opacity. */
  wash: '#1A1A18',
  // Bundled Noto Serif CJK SC (registered by useReaderFonts). iOS does not
  // preinstall Songti SC, so naming it silently fell back to PingFang.
  serif: 'ReaderSerif',
  /** Bundled 马善政 brush face for display titles; regular weight only. */
  brush: 'InkBrush',
  accent: '#1A1A18',
  onAccent: '#F4EFE4',
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
  extraSmall: 2,
  small: 4,
  medium: 6,
  large: 8,
  extraLarge: 12,
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