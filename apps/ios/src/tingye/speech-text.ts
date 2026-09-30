// Markup and decoration that TTS engines either skip or spell out ("竖线",
// "减号"), e.g. Markdown tables, rules and emphasis left in TXT/MD/PDF text.
// Runs of two or more hyphens are rules; a single hyphen stays ("COVID-19").
const SILENT=/[`*_~|#=<>[\]{}^\\•☐☑]|-{2,}/gu;

/**
 * The text sent to speech synthesis. Silent symbols become spaces of the SAME
 * length, so boundary charIndex, word timestamps and page offsets computed on
 * the book text stay valid without any remapping.
 */
export function speakableText(text:string){return text.replace(SILENT,m=>' '.repeat(m.length));}

/** A segment with nothing but symbols/whitespace has nothing to voice. */
export function hasSpeech(text:string){return /[\p{L}\p{N}]/u.test(speakableText(text));}
