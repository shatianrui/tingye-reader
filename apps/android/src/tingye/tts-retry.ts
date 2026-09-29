import {SYNTH_TIMEOUT_MS} from './audio-buffer-policy';
const stopped=()=>new Error('已停止');
export const TTS_NETWORK_MESSAGE='语音网络连接中断或超时，已自动重试。请检查网络后再试。';
const TRANSIENT_RETRIES=2;
function wait(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
 if(signal.aborted){reject(stopped());return;}
 const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(stopped());};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
 signal.addEventListener('abort',abort,{once:true});
});}
// Timeouts and dropped connections (including the native "request canceled"
// raised when our per-attempt timer aborts a fetch) are worth another try;
// HTTP errors with a status are decided by the server and are not retried.
function transient(error:unknown,timedOut:boolean){
 if(timedOut)return true;
 const e=error as {status?:number;message?:unknown};
 if(e?.status===0)return true;
 if(typeof e?.status==='number')return false;
 return /fetch failed|cancel+ed|network request failed|timed?\s*out/i.test(String(e?.message??''));
}
// Retry the application's short frequency window and transient network
// failures. Never retry exhausted balance/daily quota/auth errors, and never
// remove the server abuse protection.
export async function withTtsRetry<T>(operation:(signal:AbortSignal)=>Promise<T>,signal:AbortSignal):Promise<T>{
 let networkRetries=0;
 for(let attempt=0;;attempt++){
  if(signal.aborted)throw stopped();
  const controller=new AbortController(),abort=()=>controller.abort();
  signal.addEventListener('abort',abort,{once:true});
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},SYNTH_TIMEOUT_MS);
  let retrySeconds=0;
  try{return await operation(controller.signal);}
  catch(error){
   if(signal.aborted)throw stopped();
   if(transient(error,timedOut)){
    if(networkRetries>=TRANSIENT_RETRIES)throw Object.assign(new Error(TTS_NETWORK_MESSAGE),{status:0});
    networkRetries++;retrySeconds=networkRetries;
   }else{
    const e=error as {status?:number;code?:string;retryAfter?:number};
    if(attempt-networkRetries>=2||e?.status!==429||e.code!=='TTS_RATE_LIMIT'||!Number.isFinite(e.retryAfter)||e.retryAfter!<=0||e.retryAfter!>120)throw error;
    retrySeconds=e.retryAfter!;
   }
  }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  // No network timeout runs while waiting. Each real request, including
  // reading its response body, gets a fresh bounded timeout.
  await wait(retrySeconds*1000,signal);
 }
}
