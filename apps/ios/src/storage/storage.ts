import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
  shelf: 'shelf_v1',
  progress: 'progress_v1',
  annotations: 'annotations_v1',
  stats: 'stats_v1',
  fontSize: 'reader_font_size',
  lineHeight: 'reader_line_height',
  theme: 'reader_theme',
  pageMode: 'reader_page_mode',
  ttsRate: 'reader_tts_rate',
  appearance: 'appearance_mode_v1',
  readChapters: 'read_chapters_v1',
} as const;

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadNumber(key: string, fallback: number): Promise<number> {
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function saveNumber(key: string, value: number): Promise<void> {
  await AsyncStorage.setItem(key, String(value));
}
