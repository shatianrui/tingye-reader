import {samples,type Book} from './books';
import {validateBook} from './book-validation';
import {createBackupLibrary,type BackupEntry} from './backup-core';
import {sha256} from './backup-sha256';
type LocalBook=BackupEntry<Book>;
export function createLibrary(userId:string){
 let database:Promise<IDBDatabase>|undefined;
 const open=()=>database??=new Promise((resolve,reject)=>{const req=indexedDB.open('tingye-library-'+userId,1);req.onupgradeneeded=()=>{req.result.createObjectStore('books',{keyPath:'id'});req.result.createObjectStore('catalog',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('无法打开本机书架，请检查浏览器存储权限。'));});
 async function all():Promise<LocalBook[]>{const db=await open();return new Promise((resolve,reject)=>{const req=db.transaction('catalog').objectStore('catalog').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
 async function put(book:LocalBook){const db=await open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['books','catalog'],'readwrite');tx.objectStore('books').put(book);const {chapters,resources,pdf,...metadata}=book as LocalBook&{resources?:unknown;pdf?:unknown};tx.objectStore('catalog').put({...metadata,chapters:[]});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 async function get(id:string):Promise<LocalBook|undefined>{const db=await open();const tx=db.transaction(['books','catalog']);const read=(name:string)=>new Promise<LocalBook|undefined>((resolve,reject)=>{const req=tx.objectStore(name).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});const [body,meta]=await Promise.all([read('books'),read('catalog')]);return body?{...body,...meta,chapters:body.chapters}:meta;}
 async function putMetadata(book:LocalBook){const db=await open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction(['books','catalog'],'readwrite');const {chapters,resources,pdf,...metadata}=book as LocalBook&{resources?:unknown;pdf?:unknown};tx.objectStore('catalog').put({...metadata,chapters:[]});if(book.deleted)tx.objectStore('books').delete(book.id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 async function remote<T>(url:string,options?:RequestInit):Promise<T>{let response:Response;try{response=await fetch(url,{...options,signal:options?.signal??AbortSignal.timeout(20000)});}catch{throw Error('暂时连接不上云端，请检查网络后重试。');}const data=await response.json();if(!response.ok)throw Error(data.error||'请求失败，请重试。');return data;}
 // Preserve original EPUB documents/resources when a browser restores and re-uploads a native backup.
 function validate(value:unknown):Book{const raw=value as Book&{pdf?:string;resources?:Record<string,string>;cover?:string};const meta=validateBook(raw);return {...meta,chapters:raw.chapters,...(raw.pdf?{pdf:raw.pdf}:{}),...(raw.resources?{resources:raw.resources}:{}),...(raw.cover?{cover:raw.cover}:{})};}
 const engine=createBackupLibrary<Book>({
  load:all,
  save:async entries=>{const database=await open();await new Promise<void>((resolve,reject)=>{const tx=database.transaction('catalog','readwrite'),store=tx.objectStore('catalog');store.clear();for(const entry of entries)store.put(entry);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});},
  read:async id=>{const body=await get(id);return body?.chapters.length?body:undefined;},
  write:async book=>{const database=await open();await new Promise<void>((resolve,reject)=>{const tx=database.transaction('books','readwrite');tx.objectStore('books').put(book);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});},
  remove:async id=>{const database=await open();await new Promise<void>((resolve,reject)=>{const tx=database.transaction('books','readwrite');tx.objectStore('books').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});},
 },async<T>(url:string,options?:RequestInit)=>{const result=await remote<T>(url,{...options,headers:{...options?.headers,'Content-Type':'application/json'},cache:'no-store'});const owner=(result as {account?:{userId:string}})?.account;if(owner&&owner.userId!==userId)throw Error('当前账号已改变，请刷新后重新登录。');return result;},(url,options)=>fetch(url,{...options,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(120000)}),validate,samples,sha256);
 async function request<T=unknown>(url:string,options?:RequestInit):Promise<T>{
  if(!url.startsWith('/api/books'))return remote<T>(url,options);
  const id=new URL(url,'https://local.invalid').searchParams.get('id'),method=options?.method||'GET';
  if(method==='GET'&&!id){try{await engine.list(true);}catch{/* Keep the local shelf available offline. */}return {books:(await engine.list()).filter(b=>!b.sample)} as T;}
  if(method==='GET'&&id)return await engine.open(id) as T;
  if(method==='POST'){await engine.importBook(validate(JSON.parse(String(options?.body))));return {ok:true,local:true} as T;}
  if(method==='PATCH'){const p=JSON.parse(String(options?.body));await engine.progress(await engine.open(p.id),p.chapter,p.position);return {ok:true,local:true} as T;}
  if(method==='DELETE'&&id){await engine.remove(id);return {ok:true} as T;}
  throw Error('无效书架操作。');
 }
 return {request,backup:engine.backup,restore:engine.restore,uploadAll:engine.uploadAll,restoreAll:engine.synchronize,flush:engine.flush};
}
