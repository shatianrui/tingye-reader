import { create } from 'zustand';
import { StorageKeys, loadNumber, saveNumber } from '../storage/storage';
import type { ReaderTheme } from '../theme/readerThemes';

export type PageTurnMode = 'slide' | 'scroll';

export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 28;

interface ReaderSettingsState {
  loaded: boolean;
  fontSize: number;
  lineHeight: number;
  theme: ReaderTheme;
  pageMode: PageTurnMode;
  ttsRate: number;
  load: () => Promise<void>;
  setFontSize: (v: number) => void;
  setLineHeight: (v: number) => void;
  setTheme: (v: ReaderTheme) => void;
  setPageMode: (v: PageTurnMode) => void;
  setTtsRate: (v: number) => void;
}

const themeIndex: ReaderTheme[] = ['day', 'night', 'eyeCare'];
const pageModeIndex: PageTurnMode[] = ['slide', 'scroll'];

export const useReaderSettings = create<ReaderSettingsState>((set, get) => ({
  loaded: false,
  fontSize: 18,
  lineHeight: 1.8,
  theme: 'day',
  pageMode: 'slide',
  ttsRate: 1.0,

  load: async () => {
    const [fontSize, lineHeight, themeIdx, pageModeIdx, ttsRate] = await Promise.all([
      loadNumber(StorageKeys.fontSize, 18),
      loadNumber(StorageKeys.lineHeight, 1.8),
      loadNumber(StorageKeys.theme, 0),
      loadNumber(StorageKeys.pageMode, 0),
      loadNumber(StorageKeys.ttsRate, 1.0),
    ]);
    set({
      fontSize,
      lineHeight,
      theme: themeIndex[themeIdx] ?? 'day',
      pageMode: pageModeIndex[pageModeIdx] ?? 'slide',
      ttsRate,
      loaded: true,
    });
  },

  setFontSize: (v) => {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, v));
    set({ fontSize: clamped });
    saveNumber(StorageKeys.fontSize, clamped);
  },
  setLineHeight: (v) => {
    set({ lineHeight: v });
    saveNumber(StorageKeys.lineHeight, v);
  },
  setTheme: (v) => {
    set({ theme: v });
    saveNumber(StorageKeys.theme, themeIndex.indexOf(v));
  },
  setPageMode: (v) => {
    set({ pageMode: v });
    saveNumber(StorageKeys.pageMode, pageModeIndex.indexOf(v));
  },
  setTtsRate: (v) => {
    const clamped = Math.max(0.5, Math.min(2.0, v));
    set({ ttsRate: clamped });
    saveNumber(StorageKeys.ttsRate, clamped);
  },
}));

void useReaderSettings.getState().load();
