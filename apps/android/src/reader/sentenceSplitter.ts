import type { Sentence } from '../types/models';

const SENTENCE_BREAKERS = new Set(['。', '！', '？', '；', '…', '\n']);
const TRAILING_QUOTES = new Set(['」', '』', '"', "'", '）', ')']);

/**
 * Splits chapter text into sentences on Chinese sentence-ending punctuation,
 * merging runs of consecutive breakers/closing quotes (handles "……", "？！",
 * a breaker immediately followed by a closing quote, etc.) into one sentence.
 * Offsets are chapter-relative and refer to the *original* (untrimmed) text,
 * so highlight ranges stay aligned with what's rendered.
 */
export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (SENTENCE_BREAKERS.has(ch)) {
      let end = i + 1;
      while (end < text.length && (SENTENCE_BREAKERS.has(text[end]) || TRAILING_QUOTES.has(text[end]))) {
        end++;
      }
      pushSentence(sentences, text, start, end);
      start = end;
      i = end;
    } else {
      i++;
    }
  }
  if (start < text.length) {
    pushSentence(sentences, text, start, text.length);
  }
  return sentences;
}

function pushSentence(sentences: Sentence[], text: string, start: number, end: number) {
  const raw = text.slice(start, end);
  const trimmed = raw.trim();
  if (trimmed.length === 0) return;
  sentences.push({ start, end, text: trimmed });
}
