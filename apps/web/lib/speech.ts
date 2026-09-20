export type VoiceConfig={provider:"glm"|"browser"|"minimax";endpoint:string;model:string;voice:string;key:string;browserVoice:string;extraVoices?:{value:string;label:string}[]};
export const defaultConfig:VoiceConfig={provider:"glm",endpoint:"https://open.bigmodel.cn/api/paas/v4/audio/speech",model:"glm-tts",voice:"tongtong",key:"",browserVoice:"auto"};
export async function speechBlob(text:string,config:VoiceConfig,signal:AbortSignal):Promise<Blob>{
 const response=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:config.provider,voice:config.voice,input:text}),signal,credentials:'same-origin'});
 if(!response.ok){const body=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(body?.error||'语音请求失败。');}
 const blob=await response.blob();if(!blob.size||blob.type.includes('json')||blob.type.startsWith('text/'))throw new Error('语音服务未返回有效音频。');return blob;
}
