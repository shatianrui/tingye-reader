import {samples,type Book} from './books';
import {validateBook} from './book-validation';
type LocalBook=Book&{updatedAt?:number;backedUp?:boolean;dirty?:boolean;deleted?:boolean};
export function createLibrary(userId:string){
 let database:Promise<IDBDatabase>|undefined;let queue=Promise.resolve();
 const open=()=>database??=new Promise((resolve,reject)=>{const req=indexedDB.open('tingye-library-'+userId,1);req.onupgradeneeded=()=>{req.result.createObjectStore('books',{keyPath:'id'});req.result.createObjectStore('catalog',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('无法打开本机书架，请检查浏览器存储权限。'));});
 async function all():Promise<LocalBook[]>{const db=await open();return new Promise((resolve,reject)=>{const req=db.transaction('catalog').objectStore('catalog').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
 async function put(book:LocalBook){const db=await open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['books','catalog'],'readwrite');tx.objectStore('books').put(book);tx.objectStore('catalog').put({...book,chapters:[]});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 async function get(id:string):Promise<LocalBook|undefined>{const db=await open();const tx=db.transaction(['books','catalog']);const read=(name:string)=>new Promise<LocalBook|undefined>((resolve,reject)=>{const req=tx.objectStore(name).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});const [body,meta]=await Promise.all([read('books'),read('catalog')]);return body?{...body,...meta,chapters:body.chapters}:meta;}
 async function putMetadata(book:LocalBook){const db=await open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['books','catalog'],'readwrite');tx.objectStore('catalog').put({...book,chapters:[]});if(book.deleted)tx.objectStore('books').delete(book.id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 async function remote<T>(url:string,options?:RequestInit):Promise<T>{let response:Response;try{response=await fetch(url,{...options,signal:options?.signal??AbortSignal.timeout(20000)});}catch{throw Error('暂时连接不上云端，请检查网络后重试。');}const data=await response.json();if(!response.ok)throw Error(data.error||'请求失败，请重试。');return data;}
 const meta=(b:Book)=>({id:b.id,title:b.title,author:b.author,format:b.format,color:b.color});
 const send=(body:unknown,method='POST')=>remote('/api/books',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 async function syncOne(book:LocalBook){
  if(book.deleted){await remote('/api/books?id='+book.id,{method:'DELETE'});const latest=await get(book.id);if(latest?.deleted)await putMetadata({...latest,dirty:false});return;}
  await send(meta(book));if(book.updatedAt)await send({id:book.id,chapter:book.chapter||0,position:book.position||0,updatedAt:book.updatedAt},'PATCH');
  const latest=await get(book.id);if(latest&&latest.updatedAt===book.updatedAt&&!latest.deleted)await putMetadata({...latest,dirty:false});
 }
 async function flush(){for(const b of await all())if(b.dirty)try{await syncOne(b);}catch{return false;}return true;}
 function schedule(){queue=queue.catch(()=>{}).then(async()=>{await flush();});return queue;}
 async function request<T=unknown>(url:string,options?:RequestInit):Promise<T>{
  if(!url.startsWith('/api/books'))return remote<T>(url,options);
  const id=new URL(url,'https://local.invalid').searchParams.get('id'),method=options?.method||'GET';
  if(method==='GET'&&!id){
   let cloud:LocalBook[]=[];try{await schedule();cloud=(await remote<{books:LocalBook[]}>('/api/books')).books;}catch{/* Local books remain usable. */}
   const local=await all(),merged=new Map(cloud.map(b=>[b.id,b]));for(const book of local){if(book.deleted){merged.delete(book.id);continue;}const other=merged.get(book.id);merged.set(book.id,{...book,backedUp:other?.backedUp??book.backedUp});}
   return {books:[...merged.values()].filter(b=>!b.id.startsWith('sample-'))} as T;
  }
  if(method==='GET'&&id){
   let local=await get(id);const sample=samples.find(b=>b.id===id);if(local?.deleted)throw Error("书籍已被移除。");if(!local&&sample)local={...sample};
   try{
    const cloud=await remote<LocalBook&{downloadUrl?:string}>('/api/books?id='+id);
    if(!local?.chapters.length){let full=cloud;if(cloud.downloadUrl){const response=await fetch(cloud.downloadUrl,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('下载备份失败，请重试。');full={...validateBook(await response.json()),...{chapter:cloud.chapter,position:cloud.position,updatedAt:cloud.updatedAt,backedUp:true}};}local=full;}
    else if(!local.dirty&&Number(cloud.updatedAt)>Number(local.updatedAt||0))local={...local,chapter:cloud.chapter,position:cloud.position,updatedAt:cloud.updatedAt};
   }catch(e){if(!local?.chapters.length)throw e;}
   if(!local?.chapters.length)throw Error('此设备没有这本书，请从原设备备份或重新导入。');await put(local);return local as T;
  }
  if(method==='POST'){const book=validateBook(JSON.parse(String(options?.body)));await put({...book,dirty:true,updatedAt:Date.now()});void schedule();return {ok:true,local:true} as T;}
  if(method==='PATCH'){
   const progress=JSON.parse(String(options?.body));const book=await get(progress.id)||samples.find(b=>b.id===progress.id);if(!book)throw Error('书籍不在本机。');
   const next={...book,chapter:progress.chapter,position:progress.position,updatedAt:Date.now(),dirty:true};await putMetadata(next);void schedule();return {ok:true,local:true} as T;
  }
  if(method==='DELETE'&&id){const book=await get(id)||{id,title:'',author:'',format:'',chapters:[]};await putMetadata({...book,deleted:true,dirty:true,chapters:[]});void schedule();return {ok:true} as T;}
  throw Error('无效书架操作。');
 }
 async function backup(id:string){
  const book=await get(id);if(book?.deleted||!book?.chapters.length)throw Error('请先在此设备导入或打开这本书。');
  await syncOne(book);const signed=await send({action:'backup-start',id}) as {uploadId:string;url:string};
  const response=await fetch(signed.url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(validateBook(book)),signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('备份上传失败，请检查网络或稍后重试。');
  await send({action:'backup-complete',uploadId:signed.uploadId});const latest=await get(id);if(latest)await putMetadata({...latest,backedUp:true});
 }
 return {request,backup,flush:schedule};
}
