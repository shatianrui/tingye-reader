// Markup that TTS engines either skip or spell out ("竖线", "减号"), e.g.
// Markdown tables, rules and emphasis left in TXT/MD/PDF text. Only markup
// PATTERNS are silenced; the same characters as content stay voiced
// ("C#", "x*y", "2 < 3", "1+1=2", "COVID-19", "snake_case", "[1]").
const SILENT:RegExp[]=[
 /<!--[\s\S]*?-->|<\/?[a-zA-Z][\w-]*(?:\s[^<>\n]*)?\/?>/g, // HTML comments and tags (before "--")
 /`+/g,                                              // code fences / spans
 /\*{2,}|_{2,}|~{2,}|={2,}|-{2,}/g,                  // emphasis, strike, rules, setext
 /^[ \t]*(?:#{1,6}|[-*+•]|>+)(?=[ \t])/gm,           // heading, bullet, quote markers
 /\[[ xX]\](?=[ \t])|\[\^[^\]\s]+\]/g,               // task boxes, footnote refs
 /[•☐☑]/g,                                           // list glyphs
];

/**
 * The text sent to speech synthesis. Silent markup becomes spaces of the SAME
 * length, so boundary charIndex, word timestamps and page offsets computed on
 * the book text stay valid without any remapping.
 */
export function speakableText(text:string){
 const blank=(m:string)=>' '.repeat(m.length);
 // Table rows: a line with two or more pipes is layout, not content.
 let voiced=text.replace(/^[^\n]*\|[^\n]*\|[^\n]*$/gm,line=>line.replace(/\|/g,' '));
 for(const pattern of SILENT)voiced=voiced.replace(pattern,blank);
 return voiced;
}

/** A segment with nothing but markup/whitespace has nothing to voice. */
export function hasSpeech(text:string){return /[\p{L}\p{N}]/u.test(speakableText(text));}
