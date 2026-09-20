// Marks use measured audio seconds. A multi-character mark may cover an entire
// sentence; only the PAGE anchor is interpolated inside that measured interval.
export type TimedWord={text:string;startTime:number;endTime:number};
export type SpeechMark={start:number;end:number;startTime:number;endTime:number};
const digits='零一二三四五六七八九';
function numberText(text:string){
 const value=text.replaceAll('〇','零').replaceAll('两','二');
 if(/^\d+$/.test(value))return value;
 if(!/[十百千万亿]/.test(value))return Array.from(value,c=>String(digits.indexOf(c))).join('');
 let total=0,section=0,n=0;
 for(const c of value){const digit=digits.indexOf(c);if(digit>=0){n=digit;continue;}
  const unit=({十:10,百:100,千:1000,万:10000,亿:100000000} as Record<string,number>)[c];
  if(unit<10000){section+=(n||1)*unit;n=0;}else{section+=n;total=unit===100000000?(total+section)*unit:total+section*unit;section=0;n=0;}
 }
 return String(total+section+n);
}
function units(text:string,normalizeNumbers=false){
 const result:{value:string;start:number;end:number}[]=[];
 const matches=text.matchAll(normalizeNumbers?/[0-9０-９零〇一二三四五六七八九十百千万亿两]+|[\p{L}\p{N}]/gu:/[\p{L}\p{N}]/gu);
 for(const m of matches){const value=m[0].normalize('NFKC').toLowerCase();const normalized=normalizeNumbers&&/^[0-9零〇一二三四五六七八九十百千万亿两]+$/.test(value)?numberText(value):value;
  for(const char of normalized)result.push({value:char,start:m.index,end:m.index+m[0].length});
 }
 return result;
}
export function mapTimedWords(text:string,words:TimedWord[]):SpeechMark[]{
 if(!words.length||words.length>4000||text.length>2000)return [];
 // Do not let a malformed/truncated timing response freeze the cursor on the
 // only valid word, or turn a successful synthesis into a playback error.
 if(words.some(w=>!w||typeof w.text!=='string'||!Number.isFinite(w.startTime)||!Number.isFinite(w.endTime)||w.startTime<0||w.endTime<=w.startTime))return [];
 const normalizeNumbers=units(text).map(u=>u.value).join('')!==words.flatMap(w=>units(w.text)).map(u=>u.value).join('');
 const original=units(text,normalizeNumbers),spoken=words.flatMap((w,index)=>units(w.text,normalizeNumbers).map(u=>({...u,index})));
 if(!original.length||!spoken.length||original.length*spoken.length>2000000)return [];
 const columns=spoken.length+1,dp=new Uint16Array((original.length+1)*columns);
 for(let i=original.length-1;i>=0;i--)for(let j=spoken.length-1;j>=0;j--)dp[i*columns+j]=original[i].value===spoken[j].value?1+dp[(i+1)*columns+j+1]:Math.max(dp[(i+1)*columns+j],dp[i*columns+j+1]);
 // A different/truncated transcription must never drive the reader across a book.
 if(dp[0]/Math.max(original.length,spoken.length)<.85)return [];
 const matched=new Map<number,number[]>();let i=0,j=0;
 while(i<original.length&&j<spoken.length){if(original[i].value===spoken[j].value){const wi=spoken[j].index;matched.set(wi,[...(matched.get(wi)||[]),i]);i++;j++;}else if(dp[(i+1)*columns+j]>dp[i*columns+j+1])i++;else j++;}
 const marks:SpeechMark[]=[];
 for(const [index,indices] of matched){const w=words[index];if(!Number.isFinite(w.startTime)||!Number.isFinite(w.endTime)||w.startTime<0||w.endTime<=w.startTime)continue;
  if(indices.length<units(w.text,normalizeNumbers).length*.8)continue;
  const start=original[indices[0]].start,end=original[indices.at(-1)!].end,previous=marks.at(-1);
  if(previous&&(w.startTime<previous.startTime||start<previous.start))return [];
  marks.push({start,end,startTime:w.startTime,endTime:w.endTime});
 }
 return marks;
}
export function pageOffsetWithinMark(text:string,mark:SpeechMark,seconds:number):number{
 const chars=Array.from(text.slice(mark.start,mark.end));
 if(chars.length<2||!Number.isFinite(seconds)||seconds<=mark.startTime)return mark.start;
 const ratio=Math.max(0,Math.min(1,(seconds-mark.startTime)/(mark.endTime-mark.startTime)));
 const index=Math.min(chars.length-1,Math.floor(ratio*chars.length));
 // UTF-16 offsets must never split a surrogate pair. During a pause retain the
 // last character of the completed mark, not the next sentence or next track.
 return mark.start+chars.slice(0,index).join('').length;
}
export function speechMarkAt(marks:SpeechMark[],seconds:number):SpeechMark|undefined{
 if(!Number.isFinite(seconds)||seconds<0)return;
 let lo=0,hi=marks.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(marks[mid].startTime<=seconds)lo=mid+1;else hi=mid;}
 // During pauses retain the word that actually finished, never predict the next.
 return marks[lo-1];
}
