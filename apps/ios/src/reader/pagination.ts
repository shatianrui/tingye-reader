import type { TextStyle } from 'react-native';
import type { Chapter, PageSpec } from '../types/models';
import type { MeasuredLine } from './TextMeasurer';

export type Measure = (text: string, style: TextStyle, width: number) => Promise<MeasuredLine[]>;

interface FlatLine {
  start: number; // chapter-relative
  end: number;
  height: number;
}

async function measureChapterLines(
  measure: Measure,
  content: string,
  style: TextStyle,
  width: number
): Promise<FlatLine[]> {
  const paragraphs = content.length > 0 ? content.split('\n') : [];
  const flat: FlatLine[] = [];
  let paragraphOffset = 0;
  for (const paragraph of paragraphs) {
    const lines = paragraph.length > 0 ? await measure(paragraph, style, width) : [{ length: 0, height: style.lineHeight ?? 20 }];
    let cursor = paragraphOffset;
    for (const line of lines) {
      flat.push({ start: cursor, end: cursor + line.length, height: line.height });
      cursor += line.length;
    }
    paragraphOffset += paragraph.length + 1; // +1 for the joining '\n'
  }
  return flat;
}

/**
 * Breaks a chapter's lines into pages that fit `pageHeight`, cutting only
 * on whole-line boundaries (never mid-line) — mirrors the original app's
 * `Paginator.paginateChapter`.
 */
function buildPages(lines: FlatLine[], chapterIndex: number, contentLength: number, pageHeight: number): PageSpec[] {
  if (lines.length === 0) {
    return [{ chapterIndex, start: 0, end: contentLength }];
  }
  const pages: PageSpec[] = [];
  let pageStart = lines[0].start;
  let usedHeight = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (usedHeight + line.height > pageHeight && usedHeight > 0) {
      pages.push({ chapterIndex, start: pageStart, end: line.start });
      pageStart = line.start;
      usedHeight = 0;
    }
    usedHeight += line.height;
  }
  pages.push({ chapterIndex, start: pageStart, end: contentLength });
  return pages;
}

export async function paginateChapter(
  measure: Measure,
  chapter: Chapter,
  chapterIndex: number,
  style: TextStyle,
  width: number,
  pageHeight: number
): Promise<PageSpec[]> {
  const lines = await measureChapterLines(measure, chapter.content, style, width);
  return buildPages(lines, chapterIndex, chapter.content.length, pageHeight);
}

export async function paginateBook(
  measure: Measure,
  chapters: Chapter[],
  style: TextStyle,
  width: number,
  pageHeight: number
): Promise<PageSpec[]> {
  const all: PageSpec[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const pages = await paginateChapter(measure, chapters[i], i, style, width, pageHeight);
    all.push(...pages);
  }
  return all;
}
