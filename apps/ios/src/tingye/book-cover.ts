import {Parser} from 'htmlparser2';
import type {Book,Chapter} from './books';

export const coverImage = /^data:image\/(png|jpeg|gif|webp|avif|svg\+xml);base64,([a-z\d+/=\s]+)$/i;

/** Only reference images already stored in this book, never a URL from its markup. */
export function chapterCover(chapter:Chapter,resources:Record<string,string>):string|undefined {
 let cover:string|undefined;
 const parser=new Parser({onopentag(tag,attrs){
  if(cover||!['img','image'].includes(tag))return;
  const id=(attrs.src||attrs.href||attrs['xlink:href']||'').match(/^tingye-resource:(r\d+)$/)?.[1];
  if(id&&coverImage.test(resources[id]||''))cover=id;
 }});
 parser.end(chapter.document?.html||'');return cover;
}

export function bookCover(book:Pick<Book,'cover'|'resources'|'chapters'>):string|undefined {
 const resources=book.resources||{};
 if(book.cover&&/^r\d+$/.test(book.cover)&&coverImage.test(resources[book.cover]||''))return book.cover;
 // Migrate previously imported EPUBs from their preserved cover/front-matter pages.
 const named=book.chapters.filter(c=>/(?:^|\/)(?:cover|titlepage|frontcover)[^/]*\.(?:x?html?)/i.test(c.document?.path||'')||/^(封面|cover)$/i.test(c.title));
 const front=book.chapters.slice(0,3).filter(c=>c.text.trim().length<300);
 for(const c of [...named,...front]){const id=chapterCover(c,resources);if(id)return id;}
 return undefined;
}
