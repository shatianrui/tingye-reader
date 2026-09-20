import {samples,type Book} from './books';
import {validFormatting} from './book-format';
import {validateDocument} from './original-document';
import {bookCover} from './book-cover';
import {repairedPosition} from './book-repair';
export type Entry=Book&{contentDirty?:boolean;contentVersion?:number;coverUri?:string;coverChecked?:boolean;coverCacheVersion?:number;chapterCount?:number;updatedAt?:number;backedUp?:boolean;dirty?:boolean;deleted?:boolean;local?:boolean};
export type LibraryStorage={load:()=>Promise<Entry[]>;save:(entries:Entry[])=>Promise<void>;read:(id:string)=>Promise<Book|undefined>;write:(book:Book)=>Promise<void>;remove:(id:string)=>Promise<void>;cover?:(book:Book)=>Promise<string|undefined>};
export type Remote=<T>(path:string,options?:RequestInit)=>Promise<T>;
export type SyncUpdate={books:Entry[];cloudCount:number;restored:number;uploaded:number;downloaded:number;phase:'catalog'|'upload'|'download';title?:string};
const meta=(b:Book)=>({id:b.id,title:b.title,author:b.author,format:b.format,color:b.color});
export function validateBook(value:unknown):Book{
 const b=value as Book;if(!b||typeof b.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(b.id)||typeof b.title!=='string'||!Array.isArray(b.chapters)||!b.chapters.length||b.chapters.length>3000)throw Error('书籍内容无效。');
 let total=0;for(const c of b.chapters){if(typeof c.title!=='string'||typeof c.text!=='string')throw Error('书籍章节无效。');total+=c.text.length;}if(total>4000000)throw Error('书籍超过 400 万字，请拆分导入。');
 const pdf=typeof b.pdf==='string'&&b.pdf.length<=30*1024*1024&&/^JVBER[a-z\d+/=\s]+$/i.test(b.pdf)?b.pdf:undefined;
 const resources:Record<string,string>={};let resourceSize=0;for(const [id,data] of Object.entries(b.resources||{})){if(!/^r\d+$/.test(id)||typeof data!=='string'||!/^data:(?:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)|font\/[\w+-]+);base64,[a-z\d+/=\s]+$/i.test(data))continue;resourceSize+=data.length;if(resourceSize>110*1024*1024)throw Error('书籍图片和字体资源过大。');resources[id]=data;}
 return {...meta(b),pdf,resources,cover:bookCover({...b,resources}),chapters:b.chapters.map(c=>({title:c.title,text:c.text,...validFormatting(c),document:validateDocument(c.document,c.text)}))};
}
export function createLibrary(storage:LibraryStorage,remote:Remote,transfer:(url:string,options?:RequestInit)=>Promise<Response>){
 let rows:Entry[]|undefined,loading:Promise<Entry[]>|undefined;let writes=Promise.resolve(),sync:Promise<boolean>|undefined;
 let lastSyncError:unknown;const backups=new Map<string,Promise<void>>();
 let syncingAll:Promise<{books:Entry[];uploaded:number;downloaded:number;cloudCount:number;restored:number;progressUpdates:Entry[];missing:string[];errors:string[]}>|undefined;
 const all=async()=>rows??(loading??=storage.load().then(value=>(rows=value)));
 const update=(fn:(entries:Entry[])=>void)=>{const task=writes.catch(()=>{}).then(async()=>{const entries=await all();fn(entries);await storage.save(entries);});writes=task;return task;};
 const find=async(id:string)=>(await all()).find(b=>b.id===id);
 const replace=(entries:Entry[],b:Entry)=>{const {pdf,resources,...metadata}=b;const i=entries.findIndex(x=>x.id===b.id);if(i<0)entries.push({...metadata,chapters:[]});else entries[i]={...metadata,chapters:[]};};
 const send=(body:unknown,method='POST')=>remote('/api/books',{method,body:JSON.stringify(body)});
 async function syncOne(b:Entry){
  if(b.deleted){await remote('/api/books?id='+encodeURIComponent(b.id),{method:'DELETE'});}
  else{await send(meta(b));if(b.updatedAt)await send({id:b.id,chapter:b.chapter||0,position:b.position||0,updatedAt:b.updatedAt},'PATCH');}
  await update(entries=>{const latest=entries.find(x=>x.id===b.id);if(latest&&latest.updatedAt===b.updatedAt&&!!latest.deleted===!!b.deleted)latest.dirty=false;});
 }
 async function flush():Promise<boolean>{if(sync)await sync;if(sync)return sync;sync=(async()=>{for(const b of [...await all()])if(b.dirty)try{await syncOne({...b});}catch(error){lastSyncError=error;return false;}lastSyncError=undefined;return true;})().finally(()=>{sync=undefined;});return sync;}
 async function pull(){
  const cloud=(await remote<{books:Entry[]}>('/api/books')).books;let restored=0;
  if(!Array.isArray(cloud))throw Error('云端书架响应无效，请重试。');
  await update(entries=>{for(const b of cloud){
   const local=entries.find(x=>x.id===b.id);
   if(local?.deleted&&local.dirty)continue; // An unacknowledged deletion must remain queued.
   if(!local||local.deleted){
    // A completed deletion is not a permanent local blacklist. If a fresh cloud
    // listing contains the ID again, another device has restored that book.
    if(local?.deleted)restored++;
    replace(entries,{...b,local:false});
   }else{
    // A queued older save must not hide newer reading activity on another device.
    // Keep content/deletion state separate; compare progress by its event time.
    const progress=Number(b.updatedAt)>Number(local.updatedAt||0)?{chapter:b.chapter,position:b.position,updatedAt:b.updatedAt}:{};
    replace(entries,{...local,...progress,backedUp:!!b.backedUp&&!local.contentDirty});
   }
  }});
  return {cloudCount:cloud.filter(b=>!b.id.startsWith('sample-')).length,restored};
 }
 async function list(refresh=false){
  if(refresh){await flush();try{await pull();}catch{/* Background refresh keeps the offline shelf; explicit synchronize reports errors. */}}
  const entries=await all();return [...entries.filter(b=>!b.deleted&&!b.sample&&!b.id.startsWith('sample-')),...samples.map(b=>({...b,...entries.find(x=>x.id===b.id),chapters:b.chapters}))];
 }
 async function open(id:string){
  const entry=await find(id);if(entry?.deleted)throw Error('书籍已移除。');const local=await storage.read(id)||samples.find(b=>b.id===id);
  if(local)return {...local,...entry,chapters:local.chapters};
  const cloud=await remote<Entry&{downloadUrl?:string}>('/api/books?id='+encodeURIComponent(id));
  if(!cloud.downloadUrl)throw Error('这本书的正文在其他设备，请先在原设备点击云端备份。');
  const response=await transfer(cloud.downloadUrl);if(!response.ok)throw Error('下载备份失败，请重试。');const body=validateBook(await response.json());if(body.id!==id)throw Error('备份书籍不匹配。');
  await storage.write(body);const coverUri=await storage.cover?.(body);await update(entries=>replace(entries,{...body,...cloud,cover:body.cover,coverUri,coverChecked:!body.cover||!!coverUri,chapterCount:body.chapters.length,chapters:[],local:true}));return {...body,...cloud,cover:body.cover,coverUri,chapters:body.chapters};
 }
 async function importBook(book:Book){const body=validateBook(book);await storage.write(body);const coverUri=await storage.cover?.(body);await update(entries=>replace(entries,{...body,coverUri,coverChecked:!body.cover||!!coverUri,updatedAt:Date.now(),contentVersion:Date.now(),contentDirty:true,backedUp:false,chapter:0,position:0,dirty:true,local:true,chapterCount:body.chapters.length}));void flush();}
 async function progress(book:Book,chapter:number,position:number,observedAt=Date.now()){
  if(!Number.isSafeInteger(observedAt)||observedAt<0)throw Error('阅读进度时间无效。');
  let changed=false;await update(entries=>{
   const old=entries.find(x=>x.id===book.id);
   if(old?.deleted||observedAt<Number(old?.updatedAt||0)||(old&&(old.chapter||0)===chapter&&(old.position||0)===position))return;
   changed=true;replace(entries,{...(old||book),chapter,position,chapterCount:book.chapters.length,updatedAt:Math.max(observedAt,Number(old?.updatedAt||0)+1),dirty:true,local:old?.local??!book.sample});
  });if(changed)void flush();
 }
 async function remove(id:string){const book=await find(id);if(!book)return;await update(entries=>replace(entries,{...book,deleted:true,dirty:true,updatedAt:Date.now(),local:false}));await storage.remove(id);void flush();}
 async function backup(id:string){
  if(backups.has(id))return backups.get(id)!;
  const task=(async()=>{
   const body=await storage.read(id),found=await find(id),entry=found?{...found}:undefined;if(!body||!entry||entry.deleted)throw Error('请先在此设备导入或打开这本书。');
   const json=JSON.stringify(validateBook(body)),bytes=new TextEncoder().encode(json).byteLength;if(bytes>18*1024*1024)throw Error('正文超过单本 18MB 的云端上限，请拆分书籍。');
   await syncOne({...entry,...meta(body)});const signed=await send({action:'backup-start',id,bytes}) as {uploadId:string;url:string};
   try{const upload=await transfer(signed.url,{method:'PUT',headers:{'Content-Type':'application/json'},body:json});if(!upload.ok)throw Error('正文上传失败，请检查网络后重试。');await send({action:'backup-complete',uploadId:signed.uploadId});}
   catch(error){await send({action:'backup-cancel',uploadId:signed.uploadId}).catch(()=>{});throw error;}
   await update(entries=>{const b=entries.find(x=>x.id===id);if(b&&!b.deleted&&b.contentVersion===entry.contentVersion){b.backedUp=true;b.contentDirty=false;}});
  })();backups.set(id,task);try{await task;}finally{backups.delete(id);}
 }
 async function synchronize(onUpdate?:(state:SyncUpdate)=>void){
  if(syncingAll)return syncingAll;
  syncingAll=(async()=>{
   const errors:string[]=[];let uploaded=0,downloaded=0,cloudCount=0,restored=0;
   const before=new Map((await all()).map(b=>[b.id,{chapter:b.chapter||0,position:b.position||0}]));
   const notify=async(phase:SyncUpdate['phase'],title?:string)=>{onUpdate?.({books:await list(),cloudCount,restored,uploaded,downloaded,phase,title});};
   const refresh=async()=>{const result=await pull();cloudCount=result.cloudCount;restored+=result.restored;await notify('catalog');};
   // Verify/publish the current cloud listing before writes or large downloads.
   // A transfer failure must never keep already-fetched book titles off screen.
   await refresh();
   if(!await flush())errors.push('书架/进度上传：'+(lastSyncError instanceof Error?lastSyncError.message:'连接失败'));
   await refresh();
   for(const b of [...await all()])if(!b.deleted&&!b.id.startsWith('sample-')&&b.local&&(!b.backedUp||b.contentDirty)){
    await notify('upload',b.title);
    try{await backup(b.id);uploaded++;}catch(error){errors.push(b.title+'：'+(error instanceof Error?error.message:'正文上传失败'));}
   }
   await refresh();
   for(const b of [...await all()])if(!b.deleted&&!b.id.startsWith('sample-')&&!b.local&&b.backedUp){
    await notify('download',b.title);
    try{await open(b.id);downloaded++;}catch(error){errors.push(b.title+'：'+(error instanceof Error?error.message:'正文下载失败'));}
    await notify('download');
   }
   const books=await list(),missing=books.filter(b=>!b.sample&&!b.id.startsWith('sample-')&&!b.local&&!b.backedUp).map(b=>b.title);
   const progressUpdates=books.filter(b=>!b.sample&&!b.id.startsWith('sample-')&&((before.get(b.id)?.chapter||0)!==(b.chapter||0)||(before.get(b.id)?.position||0)!==(b.position||0)));
   return {books,uploaded,downloaded,cloudCount,restored,progressUpdates,missing,errors};
  })().finally(()=>{syncingAll=undefined;});return syncingAll;
 }
 async function repair(id:string,original:Book){
  await writes;
  const entry=await find(id),previous=await storage.read(id);
  if(!entry||entry.deleted||!previous)throw Error('请先在此设备打开书籍。');
  const body=validateBook({...original,id,title:entry.title}),position=repairedPosition({...previous,...entry,chapters:previous.chapters},body);
  await storage.write(body);
  const coverUri=await storage.cover?.(body);
  await update(entries=>replace(entries,{...entry,...body,...position,coverUri,coverChecked:!body.cover||!!coverUri,coverCacheVersion:undefined,chapterCount:body.chapters.length,updatedAt:Date.now(),contentVersion:Date.now(),contentDirty:true,dirty:true,local:true,backedUp:false}));
  void flush();return open(id);
 }
 return {list,open,importBook,progress,remove,backup,flush,repair,synchronize};
}
