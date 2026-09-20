import type {Book} from './books';

export type ReadingChange={book:Book;chapter:number;position:number;updatedAt:number};

// Restoration and layout callbacks are not reading activity. Only explicit turns,
// chapter navigation and speech boundaries can create a pending progress write.
export function createReadingProgress(now=()=>Date.now()){
 let current:ReadingChange|undefined,pending:ReadingChange|undefined;
 return {
  restore(book:Book,chapter:number,position:number){current={book,chapter,position,updatedAt:0};pending=undefined;},
  clear(){current=undefined;pending=undefined;},
  move(chapter:number,position:number){
   if(!current||current.chapter===chapter&&current.position===position)return;
   current={...current,chapter,position,updatedAt:Math.max(now(),current.updatedAt+1)};
   pending=current;
  },
  take(){const change=pending;pending=undefined;return change;},
 };
}
