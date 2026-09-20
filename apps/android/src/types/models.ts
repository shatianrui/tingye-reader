export type BookFormat = 'txt' | 'epub';

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  intro: string;
  format: BookFormat;
  coverColors: [string, string];
  coverUri?: string;
  txtContent?: string;
  epubAssetModule?: number; // require() module id for the bundled .epub asset
  rating: number;
  readers: number;
  isNew: boolean;
}

export interface Chapter {
  title: string;
  content: string; // paragraphs joined by \n
}

export type AnnotationType = 'highlight' | 'note' | 'bookmark';

export interface Annotation {
  id: string;
  bookId: string;
  chapterIndex: number;
  start: number; // char offset within chapter (inclusive)
  end: number; // char offset within chapter (exclusive); bookmark: start === end
  type: AnnotationType;
  selectedText: string;
  note?: string;
  createdAt: number; // ms epoch
}

export interface ReadingProgress {
  bookId: string;
  chapterIndex: number;
  charOffset: number;
  percent: number; // 0..1 whole-book
  updatedAt: number; // ms epoch
}

export interface Sentence {
  start: number; // chapter-relative char offset
  end: number;
  text: string;
}

export interface PageSpec {
  chapterIndex: number;
  start: number;
  end: number;
}
