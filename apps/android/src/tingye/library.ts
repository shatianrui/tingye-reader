import {samples,type Book} from './books';
import {validFormatting} from './book-format';
import {validateDocument} from './original-document';
import {bookCover} from './book-cover';
import {repairedPosition} from './book-repair';
import {createBackupLibrary,type BackupEntry,type BackupStorage,type BackupRemote,type BackupUpdate} from './backup-core';
import {sha256} from './backup-sha256';
export type Entry=BackupEntry<Book>;
export type LibraryStorage=BackupStorage<Book>;
export type Remote=BackupRemote;
export type SyncUpdate=BackupUpdate<Book>;
const meta=(b:Book)=>({id:b.id,title:b.title,author:b.author,format:b.format,color:b.color});
export function validateBook(value:unknown):Book{
 const b=value as Book;if(!b||typeof b.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(b.id)||typeof b.title!=='string'||!Array.isArray(b.chapters)||!b.chapters.length||b.chapters.length>3000)throw Error('书籍内容无效。');
 let total=0;for(const c of b.chapters){if(typeof c.title!=='string'||typeof c.text!=='string')throw Error('书籍章节无效。');total+=c.text.length;}if(total>4000000)throw Error('书籍超过 400 万字，请拆分导入。');
 const pdf=typeof b.pdf==='string'&&b.pdf.length<=30*1024*1024&&/^JVBER[a-z\d+/=\s]+$/i.test(b.pdf)?b.pdf:undefined;
 const resources:Record<string,string>={};let resourceSize=0;for(const [id,data] of Object.entries(b.resources||{})){if(!/^r\d+$/.test(id)||typeof data!=='string'||!/^data:(?:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)|font\/[\w+-]+);base64,[a-z\d+/=\s]+$/i.test(data))continue;resourceSize+=data.length;if(resourceSize>110*1024*1024)throw Error('书籍图片和字体资源过大。');resources[id]=data;}
 return {...meta(b),pdf,resources,cover:bookCover({...b,resources}),chapters:b.chapters.map(c=>({title:c.title,text:c.text,...validFormatting(c),document:validateDocument(c.document,c.text)}))};
}
export function createLibrary(storage:LibraryStorage,remote:Remote,transfer:(url:string,options?:RequestInit)=>Promise<Response>){return createBackupLibrary(storage,remote,transfer,validateBook,samples,sha256,repairedPosition);}
