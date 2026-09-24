import {SYNTH_TIMEOUT_MS} from './audio-buffer-policy';
const stopped=()=>new Error('已停止');
function wait(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
 if(signal.aborted){reject(stopped());return;}
 const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(stopped());};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
 signal.addEventListener('abort',abort,{once:true});
});}
// A dropped connection, a request that hit our own timeout, or a gateway
// timeout (504) is transient: on a flaky mobile link one of these used to fail
// the clip and halt all prefetching. Server verdicts (502 upstream/balance,
// 503 unconfigured, auth) are not transient.
const TRANSIENT_BACKOFF_MS=[1000,3000];
// Retry only the application's short frequency window and transient transport
// failures. Never retry exhausted balance/daily quota/auth errors, and never
// remove the server abuse protection.
export async function withTtsRetry<T>(operation:(signal:AbortSignal)=>Promise<T>,signal:AbortSignal):Promise<T>{
 for(let attempt=0,transient=0;;attempt++){
  if(signal.aborted)throw stopped();
  const controller=new AbortController(),abort=()=>controller.abort();
  signal.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,SYNTH_TIMEOUT_MS);
  let retrySeconds=0;
  try{return await operation(controller.signal);}
  catch(error){
   if(signal.aborted)throw stopped();
   const e=error as {status?:number;code?:string;retryAfter?:number};
   if(controller.signal.aborted||e?.status===0||e?.status===504){
    if(transient>=TRANSIENT_BACKOFF_MS.length)throw error;
    retrySeconds=TRANSIENT_BACKOFF_MS[transient++]/1000;
   }else{
    if(attempt>=2||e?.status!==429||e.code!=='TTS_RATE_LIMIT'||!Number.isFinite(e.retryAfter)||e.retryAfter!<=0||e.retryAfter!>120)throw error;
    retrySeconds=e.retryAfter!;
   }
  }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  // No network timeout runs while waiting for Retry-After. Each real request,
  // including reading its response body, gets a fresh bounded timeout.
  await wait(retrySeconds*1000,signal);
 }
}
