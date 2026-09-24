import * as SecureStore from 'expo-secure-store';
import { fetch } from 'expo/fetch';
// Both names serve the same Vercel deployment. *.vercel.app is blocked in
// mainland China, so the custom domain goes first; the fallback covers the
// time before its DNS is live and any network where only one name resolves.
export const ORIGINS=['https://tingye.copilotcli.top','https://tingye-reader.vercel.app'] as const;
export const ORIGIN=ORIGINS[0];
let preferred=0;
export const activeOrigin=()=>ORIGINS[preferred];
// Site tokens are intentionally kept separate from the new account service.
const KEY='tingye.vercel.session.v1';
export type Session={token:string;expiresAt:number;user:{userId:string;displayName:string;username:string}};
export type Credentials={action:'login'|'register'|'recover';username:string;password:string;invite?:string;recoveryCode?:string};
let current:Session|null=null;
export const session=()=>current;
function valid(value:Session|null):value is Session{return !!value&&/^[a-f0-9]{64}$/.test(value.token)&&Number.isFinite(value.expiresAt)&&value.expiresAt>Date.now()&&typeof value.user?.userId==='string'&&!!value.user?.username;}
export async function restoreSession(){const raw=await SecureStore.getItemAsync(KEY);try{current=raw?JSON.parse(raw):null;}catch{current=null;}if(!valid(current)){current=null;await SecureStore.deleteItemAsync(KEY);}return current;}
export class ApiError extends Error{constructor(message:string,public status:number,public code?:string,public retryAfter?:number){super(message);}}
export async function request(path:string,options:RequestInit={},anonymous=false){
 if(!/^\/api\//.test(path)||path.includes('://'))throw new Error('无效的服务地址。');
 const headers=new Headers(options.headers);headers.set('X-Tingye-Client','native');if(!anonymous&&current)headers.set('Authorization','Bearer '+current.token);if(typeof options.body==='string')headers.set('Content-Type','application/json');
 let response:Response|undefined;
 // A name that cannot be reached is skipped; the one that answered is kept for
 // later requests so a dead name costs one failed attempt, not one per request.
 for(let attempt=0;!response;attempt++){
  const index=(preferred+attempt)%ORIGINS.length;
  try{response=await fetch(ORIGINS[index]+path,{...options,headers,signal:options.signal??AbortSignal.timeout(45000),redirect:'error'});preferred=index;}
  catch(e){if(options.signal?.aborted)throw e;if(attempt>=ORIGINS.length-1)throw new ApiError('暂时连接不上云端。已下载的书籍可以继续阅读，请检查网络后重试。',0);}
 }
 if(!response.ok){const body=await response.json().catch(()=>null) as {error?:string;code?:string;retryAfter?:number}|null;const retry=Number(response.headers?.get('Retry-After')??body?.retryAfter);throw new ApiError(body?.error||(response.status===401?'登录已过期，请重新登录。':`服务暂不可用（${response.status}）。`),response.status,body?.code,Number.isFinite(retry)&&retry>0?retry:undefined);}return response;
}
export async function api<T>(path:string,options?:RequestInit):Promise<T>{return (await request(path,options)).json() as Promise<T>;}
export async function signIn(credentials:Credentials):Promise<Session&{recoveryCode?:string}>{
 const response=await request('/api/auth',{method:'POST',body:JSON.stringify({...credentials,username:credentials.username.trim()})},true);const next=await response.json() as Session&{recoveryCode?:string};if(!valid(next))throw new Error('登录响应无效，请重试。');
 const saved:Session={token:next.token,expiresAt:next.expiresAt,user:next.user};await SecureStore.setItemAsync(KEY,JSON.stringify(saved));current=saved;return next;
}
export async function clearSession(){current=null;await SecureStore.deleteItemAsync(KEY);}
export async function signOut(){try{await api('/api/auth',{method:'DELETE',signal:AbortSignal.timeout(5000)});}catch{/* Allow local logout even offline. */}finally{await clearSession();}}
