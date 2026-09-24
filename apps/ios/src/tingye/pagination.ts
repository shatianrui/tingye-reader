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

// A paragraph at most this long (a dialogue line, a heading) may share a
// request with its neighbours, up to SHORT_RUN_LIMIT characters in total.
export const SHORT_PARAGRAPH = 60, SHORT_RUN_LIMIT = 200;

function paragraphLength(text: string, offset: number) {
  let start = offset, end = offset;
  while (start > 0 && !/[\r\n]/.test(text[start - 1])) start--;
  while (end < text.length && !/[\r\n]/.test(text[end])) end++;
  return text.slice(start, end).trim().length;
}

// Preserve the book's sentence IDs while giving TTS the context of a paragraph.
// Page geometry never participates in narration boundaries. Prose paragraphs
// keep their own prosody group; runs of short paragraphs share one, because each
// request costs a full synthesis round trip, and a run of one-line paragraphs
// (dialogue) otherwise drains the audio queue faster than it can be refilled.
export function narrationGroups(text: string, startOffset = 0, position = 0) {
  type Segment = ReturnType<typeof speechSegments>[number];
  const groups: (Segment & { anchors: Segment[] })[] = [];
  for (const segment of speechSegments(text, startOffset).filter(s=>s.position>=position)) {
    const previous = groups.at(-1);
    const paragraphBreak = !!previous && /[\r\n]/.test(text.slice(previous.end, segment.start));
    const sameParagraph = !!previous && !paragraphBreak && segment.end-previous.start<=400;
    const shortRun = !!previous && paragraphBreak && segment.end-previous.start<=SHORT_RUN_LIMIT
      && paragraphLength(text, previous.end-1)<=SHORT_PARAGRAPH && paragraphLength(text, segment.start)<=SHORT_PARAGRAPH;
    if (previous && (sameParagraph || shortRun)) {
      previous.end=segment.end;
      previous.text=text.slice(previous.start,previous.end);
      previous.anchors.push(segment);
    } else groups.push({...segment,anchors:[segment]});
  }
  return groups;
}
