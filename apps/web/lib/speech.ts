export type VoiceConfig={provider:"glm"|"browser"|"minimax";endpoint:string;model:string;voice:string;key:string;browserVoice:string;extraVoices?:{value:string;label:string}[]};
export const defaultConfig:VoiceConfig={provider:"glm",endpoint:"https://open.bigmodel.cn/api/paas/v4/audio/speech",model:"glm-tts",voice:"tongtong",key:"",browserVoice:"auto"};
const PROVIDER_FILE=/^https:\/\/minimax-algeng-chat-tts\.oss-cn-[a-z0-9-]+\.aliyuncs\.com\//;
export async function speechBlob(text:string,config:VoiceConfig,signal:AbortSignal):Promise<Blob>{
 const synth=(delivery?:'url')=>fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:config.provider,voice:config.voice,input:text,...(delivery?{delivery}:{})}),signal,credentials:'same-origin'});
 let response=await synth(config.provider==='minimax'?'url':undefined);
 if(response.ok&&response.headers.get('content-type')?.includes('application/json')){
  // Download MiniMax files straight from mainland storage instead of relaying them through the server.
  const {url}=await response.json() as {url?:unknown};
  try{
   if(typeof url!=='string'||!PROVIDER_FILE.test(url))throw new Error('invalid url');
   const file=await fetch(url,{signal,credentials:'omit',redirect:'error'});
   if(!file.ok)throw new Error('download failed');
   const blob=await file.blob();if(blob.size)return blob;
  }catch(error){if(signal.aborted)throw error;}
  response=await synth();
 }
 if(!response.ok){const body=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(body?.error||'语音请求失败。');}
 const blob=await response.blob();if(!blob.size||blob.type.includes('json')||blob.type.startsWith('text/'))throw new Error('语音服务未返回有效音频。');return blob;
}
