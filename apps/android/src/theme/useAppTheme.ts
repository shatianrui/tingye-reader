import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import {
  lightColors,
  darkColors,
  typography,
  shape,
  spacing,
  motion,
  elevation,
} from './tokens';
import type { AppColors } from './tokens';
import { useAppearance, type AppearanceMode, type ResolvedScheme } from '../store/useAppearance';

export type { AppearanceMode, ResolvedScheme };
export type ColorScheme = ResolvedScheme;

export interface AppTheme {
  scheme: ColorScheme;
  colors: AppColors;
  typography: typeof typography;
  shape: typeof shape;
  spacing: typeof spacing;
  motion: typeof motion;
  elevation: typeof elevation;
}

/**
 * Returns the active Material You theme.
 *
 * - Reads the user's chosen mode from the `useAppearance` store
 *   (system / light / dark).
 * - Re-renders when the user toggles the mode or the system scheme changes.
 *
 * The reading surface (ReaderScreen) keeps its dedicated `readerThemes.ts`
 * palette because the reading state is opt-in and must not depend on the
 * host chrome's theme.
 */
export function useAppTheme(): AppTheme {
  const mode = useAppearance((s) => s.mode);
  const resolved = mode === 'light' || mode === 'dark' ? mode : null;

  // Subscribe to OS scheme changes when in 'system' mode so we re-render
  // immediately when the user flips their device's dark mode toggle.
  const [systemScheme, setSystemScheme] = useState<ResolvedScheme>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const scheme: ColorScheme = resolved ?? systemScheme;
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    typography,
    shape,
    spacing,
    motion,
    elevation,
  };
}

export { lightColors, darkColors, typography, shape, spacing, motion, elevation };
export type { AppColors };