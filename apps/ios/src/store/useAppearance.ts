import { Appearance } from 'react-native';
import { create } from 'zustand';
import { StorageKeys, loadJson, saveJson } from '../storage/storage';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

export interface AppearanceState {
  loaded: boolean;
  mode: AppearanceMode;
  load: () => Promise<void>;
  setMode: (mode: AppearanceMode) => void;
  /** Resolved scheme based on mode + system color scheme. */
  resolve: () => ResolvedScheme;
}

function systemScheme(): ResolvedScheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export const useAppearance = create<AppearanceState>((set, get) => ({
  loaded: false,
  mode: 'system',
  load: async () => {
    const stored = await loadJson<AppearanceMode>(StorageKeys.appearance, 'system');
    set({ mode: stored, loaded: true });
  },
  setMode: (mode) => {
    set({ mode });
    void saveJson(StorageKeys.appearance, mode);
  },
  resolve: () => {
    const { mode } = get();
    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    return systemScheme();
  },
}));

/** Imperative accessor for use outside React (mirrors the store's resolve). */
export function resolveAppearanceMode(mode: AppearanceMode): ResolvedScheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme();
}

// Boot the store immediately so the first render already has the saved value.
void useAppearance.getState().load();