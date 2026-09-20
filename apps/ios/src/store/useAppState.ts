import { create } from 'zustand';
import { StorageKeys, loadJson, saveJson } from '../storage/storage';
import type { Annotation, AnnotationType, ReadingProgress } from '../types/models';

function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface AppStateStore {
  loaded: boolean;
  shelf: string[]; // book ids, most-recently-read first
  progress: Record<string, ReadingProgress>;
  annotations: Annotation[];
  stats: Record<string, number>; // yyyy-MM-dd -> seconds
  readChapters: Record<string, number[]>; // bookId -> chapter indexes user marked as read

  load: () => Promise<void>;

  isOnShelf: (bookId: string) => boolean;
  addToShelf: (bookId: string) => void;
  removeFromShelf: (bookId: string) => void;

  progressOf: (bookId: string) => ReadingProgress | undefined;
  saveProgress: (progress: ReadingProgress) => void;

  /** Chapter-level manual "read" markers (long-press in BookDetail). */
  isChapterRead: (bookId: string, chapterIndex: number) => boolean;
  toggleChapterRead: (bookId: string, chapterIndex: number) => void;
  readChapterCount: (bookId: string) => number;

  annotationsOf: (bookId: string) => Annotation[];
  addAnnotation: (a: Omit<Annotation, 'id' | 'createdAt'>) => Annotation;
  removeAnnotation: (id: string) => void;
  bookmarkAt: (bookId: string, chapterIndex: number, start: number, end: number) => void;
  isBookmarked: (bookId: string, chapterIndex: number, start: number, end: number) => boolean;

  addReadingSeconds: (seconds: number) => void;
  totalReadingSeconds: () => number;
  todayReadingSeconds: () => number;
  readingDays: () => number;
  noteCount: () => number;
}

export const useAppState = create<AppStateStore>((set, get) => ({
  loaded: false,
  shelf: [],
  progress: {},
  annotations: [],
  stats: {},
  readChapters: {},

  load: async () => {
    const [shelf, progress, annotations, stats, readChapters] = await Promise.all([
      loadJson<string[]>(StorageKeys.shelf, []),
      loadJson<Record<string, ReadingProgress>>(StorageKeys.progress, {}),
      loadJson<Annotation[]>(StorageKeys.annotations, []),
      loadJson<Record<string, number>>(StorageKeys.stats, {}),
      loadJson<Record<string, number[]>>(StorageKeys.readChapters, {}),
    ]);
    set({ shelf, progress, annotations, stats, readChapters, loaded: true });
  },

  isOnShelf: (bookId) => get().shelf.includes(bookId),

  addToShelf: (bookId) => {
    const shelf = get().shelf.filter((id) => id !== bookId);
    shelf.unshift(bookId);
    set({ shelf });
    saveJson(StorageKeys.shelf, shelf);
  },

  removeFromShelf: (bookId) => {
    const shelf = get().shelf.filter((id) => id !== bookId);
    set({ shelf });
    saveJson(StorageKeys.shelf, shelf);
  },

  progressOf: (bookId) => get().progress[bookId],

  saveProgress: (progress) => {
    const next = { ...get().progress, [progress.bookId]: progress };
    const shelf = get().shelf.filter((id) => id !== progress.bookId);
    shelf.unshift(progress.bookId);
    set({ progress: next, shelf });
    saveJson(StorageKeys.progress, next);
    saveJson(StorageKeys.shelf, shelf);
  },

  annotationsOf: (bookId) => get().annotations.filter((a) => a.bookId === bookId),

  addAnnotation: (a) => {
    const annotation: Annotation = {
      ...a,
      id: String(Date.now()) + Math.random().toString(36).slice(2, 8),
      createdAt: Date.now(),
    };
    const next = [...get().annotations, annotation];
    set({ annotations: next });
    saveJson(StorageKeys.annotations, next);
    return annotation;
  },

  removeAnnotation: (id) => {
    const next = get().annotations.filter((a) => a.id !== id);
    set({ annotations: next });
    saveJson(StorageKeys.annotations, next);
  },

  bookmarkAt: (bookId, chapterIndex, start, end) => {
    const existing = get().annotations.find(
      (a) =>
        a.type === 'bookmark' &&
        a.bookId === bookId &&
        a.chapterIndex === chapterIndex &&
        a.start >= start &&
        a.start < end
    );
    if (existing) {
      get().removeAnnotation(existing.id);
    } else {
      get().addAnnotation({
        bookId,
        chapterIndex,
        start,
        end: start,
        type: 'bookmark' as AnnotationType,
        selectedText: '',
      });
    }
  },

  isBookmarked: (bookId, chapterIndex, start, end) =>
    get().annotations.some(
      (a) =>
        a.type === 'bookmark' &&
        a.bookId === bookId &&
        a.chapterIndex === chapterIndex &&
        a.start >= start &&
        a.start < end
    ),

  addReadingSeconds: (seconds) => {
    if (seconds <= 0) return;
    const key = todayKey();
    const next = { ...get().stats, [key]: (get().stats[key] ?? 0) + seconds };
    set({ stats: next });
    saveJson(StorageKeys.stats, next);
  },

  isChapterRead: (bookId, chapterIndex) => {
    const list = get().readChapters[bookId];
    return !!list && list.includes(chapterIndex);
  },

  toggleChapterRead: (bookId, chapterIndex) => {
    const current = get().readChapters[bookId] ?? [];
    const nextList = current.includes(chapterIndex)
      ? current.filter((i) => i !== chapterIndex)
      : [...current, chapterIndex].sort((a, b) => a - b);
    const next = { ...get().readChapters, [bookId]: nextList };
    set({ readChapters: next });
    saveJson(StorageKeys.readChapters, next);
  },

  readChapterCount: (bookId) => (get().readChapters[bookId]?.length ?? 0),

  totalReadingSeconds: () => Object.values(get().stats).reduce((a, b) => a + b, 0),
  todayReadingSeconds: () => get().stats[todayKey()] ?? 0,
  readingDays: () => Object.keys(get().stats).length,
  noteCount: () => get().annotations.filter((a) => a.type === 'note').length,
}));

void useAppState.getState().load();
