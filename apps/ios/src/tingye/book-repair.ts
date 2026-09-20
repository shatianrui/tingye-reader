import type {Book} from './books';
import {sentenceRanges} from './pagination';

export function needsOriginalRepair(book:Book){
 if(book.sample)return false;
 if(book.format==='PDF')return !book.pdf;
 return ['EPUB','DOCX','HTML','HTM'].includes(book.format)&&book.chapters.some(c=>!c.document);
}

/** Restore an original file without duplicating its shelf ID or resetting reading progress. */
export function repairedPosition(old:Book,next:Book){
 const previous=old.chapters[Math.min(old.chapter||0,old.chapters.length-1)];
 let chapter=next.chapters.findIndex(c=>!!previous.document?.path&&c.document?.path===previous.document.path);
 if(chapter<0)chapter=next.chapters.findIndex(c=>c.text===previous.text);
 if(chapter<0)chapter=next.chapters.findIndex(c=>c.title===previous.title);
 if(chapter<0)chapter=Math.min(old.chapter||0,next.chapters.length-1);
 const prior=sentenceRanges(previous.text)[old.position||0];
 const quote=prior?previous.text.slice(prior.start,prior.end).trim():'';
 const text=next.chapters[chapter].text,ranges=sentenceRanges(text),offset=quote?text.indexOf(quote):-1;
 const position=offset>=0?Math.max(0,ranges.findIndex(r=>r.end>offset)):Math.min(old.position||0,Math.max(0,ranges.length-1));
 return {chapter,position};
}
