import type { Book, Chapter } from '../types/models';
import { parseEpub } from './epubParser';

const CHAPTER_HEADING_RE = /^第[一二三四五六七八九十百千0-9]+章.*$/;

function parseTxt(content: string): Chapter[] {
  const lines = content.split('\n');
  const chapters: Chapter[] = [];
  let currentTitle: string | null = null;
  let currentParagraphs: string[] = [];

  const flush = () => {
    if (currentTitle !== null) {
      chapters.push({ title: currentTitle, content: currentParagraphs.join('\n') });
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (CHAPTER_HEADING_RE.test(line)) {
      flush();
      currentTitle = line;
      currentParagraphs = [];
    } else if (line.length > 0) {
      currentParagraphs.push(line);
    }
  }
  flush();
  return chapters;
}

class BookRepository {
  private cache = new Map<string, Chapter[]>();

  async loadChapters(book: Book): Promise<Chapter[]> {
    const cached = this.cache.get(book.id);
    if (cached) return cached;

    let chapters: Chapter[];
    if (book.format === 'txt') {
      chapters = parseTxt(book.txtContent ?? '');
    } else {
      if (!book.epubAssetModule) throw new Error(`Book ${book.id} has no epub asset`);
      chapters = await parseEpub(book.epubAssetModule);
    }
    this.cache.set(book.id, chapters);
    return chapters;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const bookRepository = new BookRepository();
