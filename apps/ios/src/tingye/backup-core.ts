// Canonical cross-platform backup engine. Run tools/sync-backup-core.mjs after edits.
export type BackupBook={id:string;title:string;author:string;format:string;color?:string;chapters:{title:string;text:string}[];chapter?:number;position?:number;sample?:boolean};
export type BackupEntry<B extends BackupBook>=B&{local?:boolean;deleted?:boolean;dirty?:boolean;updatedAt?:number;localEventAt?:number;backedUp?:boolean;contentDirty?:boolean;contentVersion?:number;chapterCount?:number;coverUri?:string;coverChecked?:boolean;coverCacheVersion?:number;snapshotRevision?:string;cloudRevision?:string;backupAt?:number};
export type BackupStorage<B extends BackupBook>={load:()=>Promise<BackupEntry<B>[]>;save:(rows:BackupEntry<B>[])=>Promise<void>;update?:(change:(rows:BackupEntry<B>[])=>void)=>Promise<BackupEntry<B>[]>;read:(id:string)=>Promise<B|undefined>;write:(book:B)=>Promise<void>;remove:(id:string)=>Promise<void>;cover?:(book:B)=>Promise<string|undefined>};
export type BackupRemote=<T>(path:string,options?:RequestInit)=>Promise<T>;
export type BackupUpdate<B extends BackupBook>={books:BackupEntry<B>[];cloudCount:number;restored:number;uploaded:number;downloaded:number;phase:'catalog'|'upload'|'download';title?:string};
type Receipt<B extends BackupBook>=BackupEntry<B>&{revision:string;bytes:number;sha256:string;downloadUrl?:string};
export function createBackupLibrary<B extends BackupBook>(storage:BackupStorage<B>,remote:BackupRemote,transfer:(url:string,options?:RequestInit)=>Promise<Response>,validate:(value:unknown)=>B,samples:B[],digest:(text:string)=>string,repairPosition?:(before:B,after:B)=>{chapter:number;position:number}){
 let rows:BackupEntry<B>[]|undefined,loading:Promise<BackupEntry<B>[]>|undefined,writes=Promise.resolve();
 let batch:Promise<Result>|undefined;
 const transfers=new Map<string,Promise<unknown>>();
 type Result={books:BackupEntry<B>[];uploaded:number;downloaded:number;cloudCount:number;restored:number;progressUpdates:BackupEntry<B>[];missing:string[];errors:string[]};
 // Transactional stores may be shared with another browser tab. Never serve their
 // catalog from an instance-local cache, and apply changes inside the transaction.
 const all=()=>storage.update?storage.load():rows?Promise.resolve(rows):(loading??=storage.load().then(value=>rows=value));
 const mutate=(fn:(entries:BackupEntry<B>[])=>void)=>{const task=writes.catch(()=>{}).then(async()=>{if(storage.update){rows=await storage.update(fn);return;}const current=await all(),next=current.map(b=>({...b}));fn(next);await storage.save(next);rows=next;});writes=task;return task;};
 const find=async(id:string)=>(await all()).find(b=>b.id===id);
 const replace=(entries:BackupEntry<B>[],entry:BackupEntry<B>)=>{const {chapters,...rest}=entry;const safe={...rest,chapters:[]} as BackupEntry<B>;delete (safe as Record<string,unknown>).resources;delete (safe as Record<string,unknown>).pdf;const i=entries.findIndex(b=>b.id===entry.id);if(i<0)entries.push(safe);else entries[i]=safe;};
 const send=<T>(body:unknown)=>remote<T>('/api/backups',{method:'POST',body:JSON.stringify(body)});
 async function catalog(){const data=await remote<{books:Receipt<B>[];protocol:number}>('/api/backups');if(data.protocol!==2||!Array.isArray(data.books))throw Error('云端备份服务版本不匹配，请更新后重试。');return data.books;}
 async function pull(){const cloud=await catalog(),ids=new Set(cloud.map(b=>b.id));await mutate(entries=>{
  for(const local of entries)if(!ids.has(local.id)){local.backedUp=false;local.cloudRevision=undefined;}
  for(const book of cloud){const local=entries.find(b=>b.id===book.id);if(local&&!local.deleted)replace(entries,{...local,backedUp:true,cloudRevision:book.revision,backupAt:book.backupAt});else replace(entries,{...book,chapters:[],local:false,deleted:false,backedUp:true,cloudRevision:book.revision});}
 });return cloud;}
 async function list(refresh=false){if(refresh)try{await pull();}catch{/* Passive shelf refresh never replaces offline reading. */}const entries=await all();return [...entries.filter(b=>!b.deleted&&!b.sample&&!b.id.startsWith('sample-')),...samples.map(b=>({...b,...entries.find(e=>e.id===b.id),chapters:b.chapters}))];}
 async function flush(){await writes;return true;} // Reading stays local until an explicit upload.
 async function open(id:string):Promise<B>{await writes;const entry=await find(id);if(entry?.deleted)throw Error('本机书籍已移除。');const body=await storage.read(id)||samples.find(b=>b.id===id);if(body)return {...body,...entry,chapters:body.chapters};return restore(id);}
 async function importBook(book:B){const body=validate(book);await storage.write(body);const coverUri=await storage.cover?.(body);await mutate(entries=>replace(entries,{...body,chapter:0,position:0,updatedAt:0,local:true,dirty:false,contentDirty:true,contentVersion:Date.now(),backedUp:false,chapterCount:body.chapters.length,coverUri,coverChecked:!!coverUri}));}
 async function progress(book:B,chapter:number,position:number,observedAt=Date.now()){
  if(!Number.isSafeInteger(observedAt)||observedAt<0||!Number.isInteger(chapter)||chapter<0||chapter>=book.chapters.length||!Number.isInteger(position)||position<0)throw Error('阅读进度无效。');
  await mutate(entries=>{const old=entries.find(b=>b.id===book.id);if(old?.deleted||observedAt<Number(old?.localEventAt||0))return;if(old&&(old.chapter||0)===chapter&&(old.position||0)===position){old.localEventAt=observedAt;return;}replace(entries,{...(old||book),chapter,position,updatedAt:observedAt,localEventAt:observedAt,local:!book.sample,dirty:false});});
 }
 async function exclusive<T>(id:string,work:()=>Promise<T>):Promise<T>{if(transfers.has(id))throw Error('这本书正在上传或还原，请等待完成。');const task=work();transfers.set(id,task);try{return await task;}finally{transfers.delete(id);}}
 async function backup(id:string,known?:ReadonlyMap<string,Receipt<B>>){return exclusive(id,async()=>{
  await writes;const body=await storage.read(id),found=await find(id),entry=found?{...found}:undefined;
  if(!body||!entry||entry.deleted||body.sample)throw Error('请先在此设备导入或下载这本书。');
  const snapshot={format:'tingye-backup',version:2,book:validate(body),progress:{chapter:entry.chapter||0,position:entry.position||0,updatedAt:entry.updatedAt||0}};
  const payload=JSON.stringify(snapshot),bytes=new TextEncoder().encode(payload).byteLength,sha256=digest(payload);
  const existing=known?known.get(id):(await catalog()).find(b=>b.id===id);
  if(existing?.sha256===sha256&&existing.bytes===bytes){await mutate(entries=>{const b=entries.find(e=>e.id===id);if(b){b.snapshotRevision=existing.revision;b.cloudRevision=existing.revision;b.backedUp=true;b.backupAt=existing.backupAt;b.contentDirty=false;}});return;}
  const signed=await send<{uploadId:string;url:string}>({action:'start',id,bytes,sha256,expectedRevision:entry.snapshotRevision||null});
  let receipt:Receipt<B>;
  try{const r=await transfer(signed.url,{method:'PUT',headers:{'Content-Type':'application/json'},body:payload});if(!r.ok)throw Error('备份上传中断，请重试。旧备份仍然可用。');try{receipt=await send<Receipt<B>>({action:'complete',uploadId:signed.uploadId});}catch{receipt=await send<Receipt<B>>({action:'complete',uploadId:signed.uploadId});}}
  catch(e){await send({action:'cancel',uploadId:signed.uploadId}).catch(()=>{});throw e;}
  if(!receipt.revision||receipt.sha256!==sha256||receipt.bytes!==bytes)throw Error('云端备份校验未通过，请刷新后重试。');
  await mutate(entries=>{const latest=entries.find(b=>b.id===id);if(latest&&!latest.deleted){latest.snapshotRevision=receipt.revision;latest.cloudRevision=receipt.revision;latest.backedUp=true;latest.backupAt=receipt.backupAt;if(latest.contentVersion===entry.contentVersion)latest.contentDirty=false;}});
 });}
 async function restore(id:string):Promise<B>{return exclusive(id,async()=>{
  const receipt=await remote<Receipt<B>>('/api/backups?id='+encodeURIComponent(id));
  if(!receipt.downloadUrl||!receipt.revision)throw Error('没有可还原的完整备份。');
  const r=await transfer(receipt.downloadUrl);if(!r.ok)throw Error('下载失败，请重试。本机书籍未更改。');
  const text=await r.text();if(new TextEncoder().encode(text).byteLength!==receipt.bytes||digest(text)!==receipt.sha256)throw Error('备份校验失败，本机书籍未更改，请重新下载。');
  const packet=JSON.parse(text);if(packet.format!=='tingye-backup'||packet.version!==2)throw Error('不支持的备份版本。');
  const body=validate(packet.book),p=packet.progress;
  if(body.id!==id||!p||!Number.isInteger(p.chapter)||p.chapter<0||p.chapter>=body.chapters.length||!Number.isInteger(p.position)||p.position<0||!Number.isSafeInteger(p.updatedAt)||p.updatedAt<0)throw Error('备份书籍或阅读位置无效。');
  if(p.chapter!==receipt.chapter||p.position!==receipt.position)throw Error('备份内容与云端目录不一致，请重试。');
  await storage.write(body);const coverUri=await storage.cover?.(body);
  const entry={...body,...p,localEventAt:0,local:true,deleted:false,dirty:false,contentDirty:false,backedUp:true,snapshotRevision:receipt.revision,cloudRevision:receipt.revision,backupAt:receipt.backupAt,coverUri,coverChecked:!!coverUri,chapterCount:body.chapters.length};
  await mutate(entries=>replace(entries,entry));return {...body,...entry};
 });}
 async function remove(id:string){if(transfers.has(id))throw Error('请等待这本书的传输完成。');const entry=await find(id);if(!entry)return;await remote('/api/backups?id='+encodeURIComponent(id),{method:'DELETE'});await mutate(entries=>replace(entries,{...entry,deleted:true,dirty:false,local:false}));await storage.remove(id);}
 async function runBatch(mode:'upload'|'download',onUpdate?:(state:BackupUpdate<B>)=>void):Promise<Result>{
  if(batch)return batch;
  batch=(async()=>{let uploaded=0,downloaded=0;const errors:string[]=[],progressUpdates:BackupEntry<B>[]=[];const cloud=await pull(),cloudIds=new Set(cloud.map(b=>b.id)),known=new Map(cloud.map(b=>[b.id,b]));
   const notify=async(title?:string)=>onUpdate?.({books:await list(),cloudCount:cloudIds.size,restored:downloaded,uploaded,downloaded,phase:mode,title});
   await notify();const targets=mode==='upload'?(await all()).filter(b=>b.local&&!b.deleted&&!b.sample&&!b.id.startsWith('sample-')):cloud;
   for(const target of targets){await notify(target.title);try{if(mode==='upload'){await backup(target.id,known);uploaded++;cloudIds.add(target.id);}else{const restored=await restore(target.id);downloaded++;progressUpdates.push(restored);}}catch(e){errors.push(target.title+'：'+(e instanceof Error?e.message:'传输失败'));}await notify();}
   return {books:await list(),uploaded,downloaded,cloudCount:cloudIds.size,restored:downloaded,progressUpdates,missing:[],errors};
  })().finally(()=>{batch=undefined;});return batch;
 }
 async function repair(id:string,original:B){await writes;const old=await open(id);const body=validate({...original,id,title:old.title}),p=repairPosition?.(old,body)||{chapter:old.chapter||0,position:old.position||0};await storage.write(body);const coverUri=await storage.cover?.(body);await mutate(entries=>replace(entries,{...entries.find(b=>b.id===id),...body,...p,local:true,contentDirty:true,contentVersion:Date.now(),coverUri}));return open(id);}
 return {list,open,importBook,progress,remove,backup,restore,flush,repair,synchronize:(notify?:(state:BackupUpdate<B>)=>void)=>runBatch('download',notify),uploadAll:(notify?:(state:BackupUpdate<B>)=>void)=>runBatch('upload',notify)};
}
