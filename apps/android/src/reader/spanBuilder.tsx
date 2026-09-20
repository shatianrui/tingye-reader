import { DisplayText as Text } from '../components/DisplayText';
import React from 'react';
import { TextStyle } from 'react-native';
import type { Annotation } from '../types/models';
import type { ReaderThemeColors } from '../theme/readerThemes';

export interface TtsRange {
  start: number;
  end: number;
}

/**
 * Renders `pageText` (the slice of chapter text shown on this page, starting
 * at chapter-relative offset `pageStart`) as nested <Text> spans, painting
 * background color for highlight/note annotations and for the currently
 * spoken TTS sentence (which takes priority), plus a dashed-underline-like
 * treatment for notes. Bookmarks carry no text styling (start === end).
 * Mirrors the original app's `buildAnnotatedSpans`.
 */
export function buildAnnotatedSpans(
  pageText: string,
  pageStart: number,
  annotations: Annotation[],
  ttsRange: TtsRange | null,
  colors: ReaderThemeColors,
  baseStyle: TextStyle
): React.ReactNode[] {
  const pageEnd = pageStart + pageText.length;
  const boundaries = new Set<number>([pageStart, pageEnd]);

  const relevant = annotations.filter(
    (a) => a.type !== 'bookmark' && a.end > pageStart && a.start < pageEnd
  );
  for (const a of relevant) {
    boundaries.add(Math.max(pageStart, a.start));
    boundaries.add(Math.min(pageEnd, a.end));
  }
  if (ttsRange && ttsRange.end > pageStart && ttsRange.start < pageEnd) {
    boundaries.add(Math.max(pageStart, ttsRange.start));
    boundaries.add(Math.min(pageEnd, ttsRange.end));
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const spans: React.ReactNode[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const segStart = sorted[i];
    const segEnd = sorted[i + 1];
    if (segStart >= segEnd) continue;

    const isTts = !!ttsRange && segStart >= ttsRange.start && segEnd <= ttsRange.end;
    const annotation = relevant.find((a) => segStart >= a.start && segEnd <= a.end);

    const style: TextStyle = { ...baseStyle };
    if (isTts) {
      style.backgroundColor = colors.ttsHighlight;
    } else if (annotation) {
      style.backgroundColor = colors.highlight;
      if (annotation.type === 'note') {
        style.textDecorationLine = 'underline';
        style.textDecorationStyle = 'dashed';
      }
    }

    const text = pageText.slice(segStart - pageStart, segEnd - pageStart);
    spans.push(
      <Text key={`${segStart}-${segEnd}`} style={style}>
        {text}
      </Text>
    );
  }

  return spans;
}
