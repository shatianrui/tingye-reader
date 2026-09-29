import { sentences } from './books';

export function sentenceRanges(text: string) {
  let offset = 0;
  return sentences(text).map((value, index) => {
    const found = text.indexOf(value, offset), start = found < 0 ? offset : found;
    offset = start + value.length;
    return { start, end: offset, text: value, index };
  });
}

export function measuredPageEnds(text: string, lines: { text: string; height: number }[], height: number) {
  let cursor = 0, used = 0;
  const ends: number[] = [];
  for (const line of lines) {
    const found = text.indexOf(line.text, cursor), start = found < 0 ? cursor : found;
    if (used + line.height > height && used > 0) { if (start > (ends.at(-1) ?? 0)) ends.push(start); used = 0; }
    used += line.height; cursor = start + line.text.length;
  }
  if (text.length > (ends.at(-1) ?? 0)) ends.push(text.length);
  return ends;
}

export function pageForOffset(ends: number[], offset: number) {
  const index = ends.findIndex(end => end > offset);
  return index < 0 ? Math.max(0, ends.length - 1) : index;
}

// Pages never split synthesis. Only an explicit start from the middle of a
// sentence trims its opening text; subsequent sentences remain intact.
export function speechSegments(text: string, startOffset = 0) {
  return sentenceRanges(text).filter(range=>range.end>startOffset).map(range=>{
    const start=Math.max(startOffset,range.start),raw=text.slice(start,range.end),content=raw.trimStart();
    return {text:content,position:range.index,start:start+raw.length-content.length,end:range.end};
  });
}

// Cloud synthesis latency grows with clip length (a 400-character GLM clip took
// ~36 s against a 45 s timeout). Cloud playback uses shorter clips and a short
// opening clip so audio starts quickly; system speech keeps whole paragraphs.
export const CLOUD_GROUP_CHARS=160;
export const CLOUD_FIRST_GROUP_CHARS=60;

// Preserve the book's sentence IDs while giving TTS the context of a paragraph.
// Page geometry never participates in narration boundaries.
export function narrationGroups(text: string, startOffset = 0, position = 0, maxChars = 400, firstMaxChars = maxChars) {
  type Segment = ReturnType<typeof speechSegments>[number];
  const groups: (Segment & { anchors: Segment[] })[] = [];
  for (const segment of speechSegments(text, startOffset).filter(s=>s.position>=position)) {
    const previous = groups.at(-1);
    const limit = groups.length===1 ? firstMaxChars : maxChars;
    if (previous && segment.end-previous.start<=limit && !/[\r\n]/.test(text.slice(previous.end,segment.start))) {
      previous.end=segment.end;
      previous.text=text.slice(previous.start,previous.end);
      previous.anchors.push(segment);
    } else groups.push({...segment,anchors:[segment]});
  }
  return groups;
}
