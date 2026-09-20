import AsyncStorage from '@react-native-async-storage/async-storage';
import {Directory,File,Paths} from 'expo-file-system';
import {fetch} from 'expo/fetch';
import {api,session} from './client';
import {createLibrary,type Entry,validateBook} from './library';
import {createCoverCache} from './cover-cache';
export function nativeLibrary(userId:string){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(userId))throw Error('账号标识无效。');
 const directory=new Directory(Paths.document,'tingye-vercel',userId);directory.create({intermediates:true,idempotent:true});
 const file=(id:string)=>{if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('书籍标识无效。');return new File(directory,id+'.json');};
 const key='tingye.vercel.catalog.'+userId;
 const read=async(id:string)=>{const f=file(id);return f.exists?validateBook(JSON.parse(await f.text())):undefined;};
 const covers=createCoverCache(directory,read);
 return createLibrary({
  load:async()=>{const raw=await AsyncStorage.getItem(key);const entries=await covers.migrate(raw?JSON.parse(raw) as Entry[]:[]);await AsyncStorage.setItem(key,JSON.stringify(entries));return entries;},
  save:entries=>AsyncStorage.setItem(key,JSON.stringify(entries)),
  read,
  write:async book=>{file(book.id).write(JSON.stringify(book));},
  cover:book=>covers.prepare(book).catch(()=>undefined),
  remove:async id=>{const f=file(id);if(f.exists)f.delete();covers.remove(id);},
 },async<T>(path:string,options?:RequestInit)=>{if(session()?.user.userId!==userId)throw Error('请登录此书架的账号。');return api<T>(path,{...options,signal:options?.signal??AbortSignal.timeout(path.startsWith('/api/backups')?120000:15000)});},async(url,options)=>{
  const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='cjhiszkujkqgmblxwryw.supabase.co')throw Error('备份地址无效。');
  // Signed storage URLs need no account bearer token.
  return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});
 });
}
