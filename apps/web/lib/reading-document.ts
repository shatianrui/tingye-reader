import { sentences } from "./books";

// Keep the source paragraphs intact; sentence ranges are only audio annotations.
export function readingDocument(source: string) {
  const text = source.replace(/\r/g, "");
  let cursor = 0;
  const ranges = sentences(text).map((value, index) => {
    const start = text.indexOf(value, cursor);
    cursor = start + value.length;
    return { start, end: cursor, index };
  });
  let offset = 0, firstRange = 0;
  return text.split("\n").flatMap(paragraph => {
    const start = offset;
    offset += paragraph.length + 1;
    if (!paragraph.trim()) return [];
    const pieces: { text: string; index: number; offset: number }[] = [];
    let at = start;
    while (firstRange < ranges.length && ranges[firstRange].end <= start) firstRange++;
    for (let r = firstRange; r < ranges.length; r++) {
      const range = ranges[r];
      if (range.start >= start + paragraph.length) break;
      const left = Math.max(start, range.start), right = Math.min(start + paragraph.length, range.end);
      if (left > at) pieces.push({ text: text.slice(at, left), index: -1, offset: 0 });
      pieces.push({ text: text.slice(left, right), index: range.index, offset: left - range.start });
      at = right;
    }
    if (at < start + paragraph.length) pieces.push({ text: text.slice(at, start + paragraph.length), index: -1, offset: 0 });
    return [pieces];
  });
}
