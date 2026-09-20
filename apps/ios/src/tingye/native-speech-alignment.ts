import {requireOptionalNativeModule} from 'expo';
import {Platform} from 'react-native';
import {mapTimedWords,type SpeechMark,type TimedWord} from './speech-timing';
type AlignmentModule={requestSpeechAlignment:()=>Promise<boolean>;alignSpeech:(id:string,uri:string,text:string)=>Promise<{status:string;words:TimedWord[]}>;cancelSpeechAlignment:(id:string)=>Promise<void>};
const native=Platform.OS==='ios'?requireOptionalNativeModule<AlignmentModule>('TingyeDocuments'):null;

// A missing native callback must not retain the background queue or its file
// lease forever. Never treat timeout/permission denial as an audio error.
function optionalTask<T>(run:()=>Promise<T>,fallback:T,signal:AbortSignal|undefined,timeoutMs:number,cancel:()=>Promise<void>=async()=>{}):Promise<T>{
 return new Promise(resolve=>{
  if(signal?.aborted){resolve(fallback);return;}
  let finished=false;
  const finish=(value:T,cancelNative=false)=>{
   if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
   if(cancelNative)void Promise.resolve().then(cancel).catch(()=>{});
   resolve(value);
  };
  const abort=()=>finish(fallback,true),timer=setTimeout(abort,timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  void Promise.resolve().then(()=>finished?fallback:run()).then(value=>finish(value),()=>finish(fallback,true));
 });
}
export async function prepareSpeechAlignment(signal?:AbortSignal){
 if(!native)return false;
 return optionalTask(()=>native.requestSpeechAlignment(),false,signal,10000);
}
export async function alignSpeechFile(uri:string,text:string,signal:AbortSignal):Promise<SpeechMark[]>{
 if(!native||signal.aborted)return [];
 const id=Date.now()+'-'+Math.random().toString(36).slice(2);
 const result=await optionalTask(()=>native.alignSpeech(id,uri,text),{status:'unavailable',words:[]},signal,25000,()=>native.cancelSpeechAlignment(id));
 try{return !signal.aborted&&result.status==='aligned'&&Array.isArray(result.words)?mapTimedWords(text,result.words):[];}
 catch{return [];}
}
