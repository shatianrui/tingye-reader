import AsyncStorage from '@react-native-async-storage/async-storage';
import {Directory,File,Paths} from 'expo-file-system';
import {fetch} from 'expo/fetch';
import {api,ORIGIN,session} from './client';
import {createLibrary,type Entry,validateBook} from './library';
import {createCoverCache} from './cover-cache';
export function nativeLibrary(userId:string){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(userId))throw Error('账号标识无效。');
 const directory=new Directory(Paths.document,'tingye-vercel',userId);directory.create({intermediates:true,idempotent:true});
 const file=(id:string)=>{if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('书籍标识无效。');return new File(directory,id+'.json');};
 const key='tingye.vercel.catalog.'+userId;
 const read=async(id:string)=>{const f=file(id);return f.exists?validateBook(JSON.parse(await f.text())):undefined;};
 const covers=createCoverCache(directory,read);let requestVersion=0;
 return createLibrary({
  load:async()=>{const raw=await AsyncStorage.getItem(key);const entries=await covers.migrate(raw?JSON.parse(raw) as Entry[]:[]);await AsyncStorage.setItem(key,JSON.stringify(entries));return entries;},
  save:entries=>AsyncStorage.setItem(key,JSON.stringify(entries)),
  read,
  write:async book=>{file(book.id).write(JSON.stringify(book));},
  cover:book=>covers.prepare(book).catch(()=>undefined),
  remove:async id=>{const f=file(id);if(f.exists)f.delete();covers.remove(id);},
 },async<T>(path:string,options?:RequestInit)=>{
  if(session()?.user.userId!==userId)throw Error('请登录此书架的账号。');
  const reading=!options?.method||options.method.toUpperCase()==='GET';
  const headers=new Headers(options?.headers);
  if(reading){
   // A unique URL avoids stale OS/proxy book lists, including cached empty lists.
   requestVersion=Math.max(Date.now(),requestVersion+1);
   path+=(path.includes('?')?'&':'?')+'_sync='+requestVersion;
   headers.set('Cache-Control','no-cache');headers.set('Pragma','no-cache');
  }
  const result=await api<T>(path,{...options,headers,...(reading?{cache:'no-store' as const}:{}),signal:options?.signal??AbortSignal.timeout(path.startsWith('/api/backups')?120000:15000)});
  const owner=(result as {account?:{userId?:string}}|null)?.account;
  if(owner&&owner.userId!==userId)throw Error('云端返回的账号与本机书架不一致，请退出后登录同一听页账号。本机书籍不会删除。');
  return result;
 },async(url,options)=>{
  const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!==new URL(ORIGIN).hostname)throw Error('备份地址无效。');
  // Signed storage URLs need no account bearer token.
  return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});
 });
}
