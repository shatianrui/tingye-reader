import {File,type Directory} from 'expo-file-system';
import type {Book} from './books';
import type {Entry} from './library';
import {bookCover,coverImage} from './book-cover';

const extensions=['png','jpg','gif','webp','avif','svg'];
/** Cover files stay beside local books, rather than large base64 strings in AsyncStorage. */
export function createCoverCache(directory:Directory,read:(id:string)=>Promise<Book|undefined>){
 const file=(id:string,ext:string)=>{if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('书籍标识无效。');return new File(directory,id+'.cover.'+ext);};
 async function prepare(book:Book){
  const id=bookCover(book),match=id?book.resources?.[id]?.match(coverImage):undefined;
  if(!match)return undefined;
  const ext=match[1].toLowerCase().replace('jpeg','jpg').replace('svg+xml','svg');
  const target=file(book.id,ext);
  target.write(match[2].replace(/\s/g,''),{encoding:'base64'});
  return target.uri;
 }
 async function migrate(entries:Entry[]){
  for(const entry of entries){
   if(entry.deleted||entry.sample)continue;
   const cached=extensions.some(ext=>{const f=file(entry.id,ext);return f.uri===entry.coverUri&&f.exists;});
   if(entry.coverChecked&&(!entry.coverUri||cached))continue;
   try{
    const book=await read(entry.id);if(!book)continue;
    entry.coverUri=await prepare(book);entry.cover=bookCover(book);entry.coverChecked=true;
   }catch{/* A damaged cover must not prevent opening the rest of the shelf. Retry next launch. */}
  }
  return entries;
 }
 function remove(id:string){for(const ext of extensions){const f=file(id,ext);if(f.exists)f.delete();}}
 return {prepare,migrate,remove};
}
