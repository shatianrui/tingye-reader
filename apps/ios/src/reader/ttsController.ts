import * as Speech from 'expo-speech';
import { useSyncExternalStore } from 'react';
import type { Chapter, Sentence } from '../types/models';
import { splitSentences } from './sentenceSplitter';

export type SentenceChangedHandler = (chapterIndex: number, sentence: Sentence) => void;
export type BookFinishedHandler = () => void;

/**
 * Speaks one sentence at a time via expo-speech, advancing across chapters,
 * firing `onSentenceChanged` *before* each sentence starts so the UI can
 * move the highlight / auto-turn pages. Mirrors the original app's
 * `TtsController` (a Flutter ChangeNotifier wrapping flutter_tts), including
 * its "generation counter" trick for cancelling a stale speak loop when the
 * user pauses/stops/changes rate/skips chapters — expo-speech (like
 * flutter_tts) has no real cancellation token, only a global `Speech.stop()`.
 */
class TtsController {
  private listeners = new Set<() => void>();
  private session = 0;

  isActive = false;
  isPaused = false;
  chapterIndex = 0;
  sentenceIndex = 0;
  sentences: Sentence[] = [];
  currentRange: { start: number; end: number } | null = null;
  rate = 1.0;

  private chapters: Chapter[] = [];
  onSentenceChanged: SentenceChangedHandler | null = null;
  onBookFinished: BookFinishedHandler | null = null;

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = () => this;

  private notify() {
    for (const l of this.listeners) l();
  }

  configure(onSentenceChanged: SentenceChangedHandler, onBookFinished: BookFinishedHandler) {
    this.onSentenceChanged = onSentenceChanged;
    this.onBookFinished = onBookFinished;
  }

  async start(opts: { chapters: Chapter[]; chapterIndex: number; fromOffset: number; rate: number }) {
    this.stop();
    this.chapters = opts.chapters;
    this.rate = opts.rate;
    this.chapterIndex = opts.chapterIndex;
    this.sentences = splitSentences(opts.chapters[opts.chapterIndex]?.content ?? '');
    const idx = this.sentences.findIndex((s) => s.end > opts.fromOffset);
    this.sentenceIndex = idx >= 0 ? idx : 0;
    this.isActive = true;
    this.isPaused = false;
    this.notify();
    this.runLoop(++this.session);
  }

  pause() {
    if (!this.isActive) return;
    this.session++; // cancel the in-flight loop
    Speech.stop();
    this.isPaused = true;
    this.notify();
  }

  resume() {
    if (!this.isActive || !this.isPaused) return;
    this.isPaused = false;
    this.notify();
    this.runLoop(++this.session);
  }

  stop() {
    this.session++;
    Speech.stop();
    this.isActive = false;
    this.isPaused = false;
    this.currentRange = null;
    this.notify();
  }

  setRate(rate: number) {
    this.rate = rate;
    if (this.isActive && !this.isPaused) {
      this.runLoop(++this.session);
    }
  }

  skipToChapter(index: number) {
    if (index < 0 || index >= this.chapters.length) return;
    this.session++;
    Speech.stop();
    this.chapterIndex = index;
    this.sentences = splitSentences(this.chapters[index].content);
    this.sentenceIndex = 0;
    this.isPaused = false;
    this.notify();
    if (this.isActive) this.runLoop(++this.session);
  }

  private async runLoop(mySession: number) {
    while (this.isActive && !this.isPaused && mySession === this.session) {
      if (this.sentenceIndex >= this.sentences.length) {
        const nextChapter = this.chapterIndex + 1;
        if (nextChapter >= this.chapters.length) {
          this.stop();
          this.onBookFinished?.();
          return;
        }
        this.chapterIndex = nextChapter;
        this.sentences = splitSentences(this.chapters[nextChapter].content);
        this.sentenceIndex = 0;
        continue;
      }

      const sentence = this.sentences[this.sentenceIndex];
      this.currentRange = { start: sentence.start, end: sentence.end };
      this.onSentenceChanged?.(this.chapterIndex, sentence);
      this.notify();

      await this.speakSentence(sentence, mySession);
      if (mySession !== this.session) return;
      this.sentenceIndex++;
    }
  }

  private speakSentence(sentence: Sentence, mySession: number): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const platformRate = Math.max(0.1, Math.min(2.0, this.rate));
      Speech.speak(sentence.text, {
        language: 'zh-CN',
        rate: platformRate,
        onDone: finish,
        onStopped: finish,
        onError: finish,
      });
      // Fallback timer in case the platform has no TTS voice installed and
      // never fires a completion callback — keeps the highlight/auto-page
      // demo working, mirroring the original app's simulated-duration path.
      const expectedMs = (sentence.text.length * 220) / this.rate + 400;
      setTimeout(() => {
        if (mySession === this.session) finish();
      }, expectedMs);
    });
  }
}

export const ttsController = new TtsController();

export function useTtsController() {
  return useSyncExternalStore(ttsController.subscribe, ttsController.getSnapshot);
}
