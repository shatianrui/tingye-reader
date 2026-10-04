const env = process.env;

const MAX_AUDIO_HEX=16*1024*1024;
type MiniMaxResult={base_resp?:{status_code:number;status_msg?:string};data?:{audio?:string;status?:number;subtitle_file?:string;subtitle?:unknown;subtitles?:unknown};system_voice?:MiniMaxVoice[];voice_cloning?:MiniMaxVoice[];voice_generation?:MiniMaxVoice[]};
function providerError(code:number|undefined,msg?:string){
  const detail=msg?`（${msg}）`:'';
  return new Error(code===1008?`MiniMax 语音额度不足，请检查账户余额${detail}`:code===1004?`MiniMax 请求参数无效${detail}，请检查密钥与 GroupId 是否匹配。`:code===2049?`MiniMax 密钥无效${detail}，请检查 API 密钥。`:code===2013?`MiniMax 参数异常${detail}，请检查模型与音色。`:`MiniMax 语音服务返回错误（${code??'未知'}${detail}），请检查密钥、GroupId、语音权限与额度。`);
}
function checked(result:MiniMaxResult){if(result.base_resp&&result.base_resp.status_code!==0)throw providerError(result.base_resp.status_code,result.base_resp.status_msg);return result;}
// Per-request user credentials take priority over server env keys.
export type MiniMaxCreds={key?:string;groupId?:string;model?:string};
async function minimaxFetch(path: '/t2a_v2' | '/get_voice', body: unknown, creds: MiniMaxCreds = {}) {
  const key=creds.key||env.MINIMAX_API_KEY;
  if (!key) throw new Error('MiniMax 尚未配置密钥。请在设置中输入自己的 API 密钥。');
  const groupId=creds.groupId||env.MINIMAX_GROUP_ID;
  // China region T2A is served by api.minimaxi.com (api.minimax.cn only hosts
  // chat/Anthropic-compatible APIs); the international site is api.minimax.io.
  const origin=env.MINIMAX_REGION==='global'?'https://api.minimax.io':'https://api.minimaxi.com';
  const url=new URL('/v1'+path,origin);
  if(groupId)url.searchParams.set('GroupId',groupId);
  let response:Response;
  try {response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(45000)});}
  catch(error){const e=error as Error & {cause?:{code?:string;message?:string}};console.warn('MiniMax transport failed',{name:e.name,code:e.cause?.code,message:e.cause?.message||e.message});throw new Error('MiniMax 连接失败，请稍后重试。');}
  // Workers only supports manual/follow; never forward the API key on redirects.
  if(response.status>=300&&response.status<400)throw new Error('MiniMax 服务地址发生跳转，请检查服务端区域配置。');
  if(!response.ok)throw new Error(`MiniMax 请求失败（${response.status}），请检查密钥、权限与额度。`);
  return response;
}
export async function minimaxRequest(path: '/t2a_v2' | '/get_voice', body: unknown, creds: MiniMaxCreds = {}) {
  const result=checked(await (await minimaxFetch(path,body,creds)).json() as MiniMaxResult);
  if(result.base_resp?.status_code!==0)throw providerError(result.base_resp?.status_code);
  return result;
}
// MiniMax's non-streaming body is delivered far slower than real time from
// this server (about 21 s for 30 s of audio), while SSE delivers the same
// audio in about 2 s. Aggregate the stream so clients still get one file.
async function minimaxStreamedAudio(body:Record<string,unknown>,creds:MiniMaxCreds={}){
  const response=await minimaxFetch('/t2a_v2',{...body,stream:true,stream_options:{exclude_aggregated_audio:true}},creds);
  if(!response.headers.get('content-type')?.includes('event-stream')){
    // Errors are returned as ordinary JSON before any audio is produced.
    const result=checked(await response.json() as MiniMaxResult);
    return {audio:result.data?.audio??'',subtitles:result.data?.subtitles,subtitleFile:result.data?.subtitle_file};
  }
  if(!response.body)throw new Error('MiniMax 未返回有效音频。');
  const reader=response.body.getReader(),decoder=new TextDecoder(),audio:string[]=[],pieces:unknown[]=[];
  let buffer='',size=0,finished=false,subtitles:unknown,subtitleFile:string|undefined;
  const handle=(event:string)=>{
    const data=event.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    if(!data||data==='[DONE]')return;
    const result=checked(JSON.parse(data) as MiniMaxResult);
    const chunk=result.data;if(!chunk)return;
    if(chunk.status===2){finished=true;subtitles=chunk.subtitles;subtitleFile=chunk.subtitle_file;return;}
    if(chunk.subtitle)pieces.push(chunk.subtitle);
    if(typeof chunk.audio==='string'&&chunk.audio){size+=chunk.audio.length;if(size>MAX_AUDIO_HEX)throw new Error('MiniMax 音频过大，请缩短朗读段落。');audio.push(chunk.audio);}
  };
  try{
    for(;;){
      const next=await reader.read();
      if(next.done)break;
      buffer+=decoder.decode(next.value,{stream:true}).replace(/\r/g,'');
      if(buffer.length>MAX_AUDIO_HEX+1024*1024)throw new Error('MiniMax 返回数据异常。');
      for(let end=buffer.indexOf('\n\n');end>=0;end=buffer.indexOf('\n\n')){handle(buffer.slice(0,end));buffer=buffer.slice(end+2);}
    }
    buffer+=decoder.decode();if(buffer.trim())handle(buffer);
  }catch(error){await reader.cancel().catch(()=>{});if(error instanceof SyntaxError)throw new Error('MiniMax 返回数据异常。');throw error;}
  if(!finished)throw new Error('MiniMax 语音流意外中断，请重试。');
  return {audio:audio.join(''),subtitles:subtitles??(pieces.length?pieces:undefined),subtitleFile};
}
async function subtitleFileWords(file:string|undefined){
  // Provider-owned subtitle storage only; never forward API credentials.
  const url=minimaxFileUrl(file);if(!url)throw Error('Unexpected subtitle host');
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8000)});
  if(!response.ok||Number(response.headers.get('content-length'))>512000)throw Error('Invalid subtitles');
  const raw=await response.text();if(raw.length>512000)throw Error('Subtitles too large');
  const segments=JSON.parse(raw);if(!Array.isArray(segments))throw Error('Invalid subtitle format');
  return minimaxWords(segments);
}
type MiniMaxVoice={voice_id:string;voice_name?:string;description?:string[]};
export function minimaxWords(segments:unknown){
  const words:{text:string;startTime:number;endTime:number}[]=[];
  if(!Array.isArray(segments))return words;
  for(const segment of segments){
    let previous:{begin:number;end:number;text:string}|undefined;
    for(const w of Array.isArray(segment?.timestamped_words)?segment.timestamped_words:[]){
      if(typeof w?.word!=='string'||w.word.length>=300||!Number.isFinite(w.time_begin)||!Number.isFinite(w.time_end)||w.time_begin<0||w.time_end<=w.time_begin)continue;
      const repeated=previous&&Number.isInteger(w.word_begin)&&w.word_begin===previous.begin&&w.word_end===previous.end&&w.word===previous.text;
      if(repeated){words.at(-1)!.endTime=Math.max(words.at(-1)!.endTime,w.time_end/1000);}
      else words.push({text:w.word,startTime:w.time_begin/1000,endTime:w.time_end/1000});
      previous={begin:w.word_begin,end:w.word_end,text:w.word};
      if(words.length>4000)return [];
    }
  }
  return words;
}
const OSS_HOST=/^minimax-algeng-chat-tts\.oss-cn-[a-z0-9-]+\.aliyuncs\.com$/;
export function minimaxFileUrl(value:unknown){
  if(typeof value!=='string'||value.length>4096)return undefined;
  try{const url=new URL(value);return url.protocol==='https:'&&OSS_HOST.test(url.hostname)&&!url.port&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}
}
function speechRequest(input:string,voice:string,withTiming:boolean,audio_setting:Record<string,unknown>,creds:MiniMaxCreds={}){
  return {model:creds.model||env.MINIMAX_MODEL||'speech-2.8-hd',text:input,...(withTiming?{subtitle_enable:true,subtitle_type:'word'}:{}),language_boost:'auto',voice_setting:{voice_id:voice,speed:1,vol:1,pitch:0},audio_setting};
}
// The server sits outside mainland China while MiniMax and most listeners are
// inside it. Opt-in clients download the provider's signed files directly,
// so audio never crosses the congested border link twice.
export async function minimaxAudioUrl(input:string,voice:string,withTiming=false,creds:MiniMaxCreds={}){
  const result=await minimaxRequest('/t2a_v2',{...speechRequest(input,voice,withTiming,{format:'mp3',sample_rate:32000,bitrate:128000,channel:1},creds),stream:false,output_format:'url'},creds);
  const url=minimaxFileUrl(result.data?.audio),subtitleUrl=withTiming?minimaxFileUrl(result.data?.subtitle_file):undefined;
  if(!url)return undefined;
  return Response.json({format:'mp3',delivery:'url',url,...(subtitleUrl?{subtitleUrl}:{})},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export async function minimaxAudio(input:string,voice:string,withTiming=false,creds:MiniMaxCreds={}) {
  // Proxied audio crosses the border twice; 64 kbps mono keeps speech clear at half the bytes.
  const result=await minimaxStreamedAudio({...speechRequest(input,voice,withTiming,{format:'mp3',sample_rate:24000,bitrate:64000,channel:1},creds),output_format:'hex'},creds);
  const hex=result.audio;
  if(typeof hex!=='string'||!hex.length||hex.length>MAX_AUDIO_HEX||hex.length%2||!/^[0-9a-f]+$/i.test(hex))throw new Error('MiniMax 未返回有效音频。');
  if(withTiming){
    let words:{text:string;startTime:number;endTime:number}[]=[];
    try{
      words=Array.isArray(result.subtitles)?minimaxWords(result.subtitles):await subtitleFileWords(result.subtitleFile);
    }catch{console.warn('MiniMax word timestamps unavailable; retaining synthesized audio.');}
    return Response.json({format:'mp3',encoding:'hex',audio:hex,words},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  const bytes=new Uint8Array(hex.length/2);
  for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(hex.substr(i*2,2),16);
  return new Response(bytes,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
