const env = process.env;

export async function minimaxRequest(path: '/t2a_v2' | '/get_voice', body: unknown) {
  if (!env.MINIMAX_API_KEY) throw new Error('MiniMax 尚未配置服务端密钥。');
  const origin=env.MINIMAX_REGION==='global'?'https://api.minimax.io':'https://api.minimax.cn';
  const url=new URL('/v1'+path,origin);
  if(env.MINIMAX_GROUP_ID)url.searchParams.set('GroupId',env.MINIMAX_GROUP_ID);
  let response:Response;
  try {response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${env.MINIMAX_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(45000)});}
  catch(error){const e=error as Error & {cause?:{code?:string;message?:string}};console.warn('MiniMax transport failed',{name:e.name,code:e.cause?.code,message:e.cause?.message||e.message});throw new Error('MiniMax 连接失败，请稍后重试。');}
  // Workers only supports manual/follow; never forward the API key on redirects.
  if(response.status>=300&&response.status<400)throw new Error('MiniMax 服务地址发生跳转，请检查服务端区域配置。');
  if(!response.ok)throw new Error(`MiniMax 请求失败（${response.status}），请检查密钥、权限与额度。`);
  const result=await response.json() as {base_resp?:{status_code:number;status_msg?:string};data?:{audio?:string;subtitle_file?:string};system_voice?:MiniMaxVoice[];voice_cloning?:MiniMaxVoice[];voice_generation?:MiniMaxVoice[]};
  const code=result.base_resp?.status_code;
  if(code!==0)throw new Error(code===1008?'MiniMax 语音额度不足，请检查账户余额。':code===1004?'MiniMax 密钥无效或没有语音权限。':`MiniMax 语音服务返回错误（${code??'未知'}），请检查语音权限与额度。`);
  return result;
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
export async function minimaxAudio(input:string,voice:string,withTiming=false) {
  const result=await minimaxRequest('/t2a_v2',{model:env.MINIMAX_MODEL||'speech-2.8-hd',text:input,stream:false,output_format:'hex',...(withTiming?{subtitle_enable:true,subtitle_type:'word'}:{}),language_boost:'auto',voice_setting:{voice_id:voice,speed:1,vol:1,pitch:0},audio_setting:{format:'mp3',sample_rate:32000,bitrate:128000,channel:1}});
  const hex=result.data?.audio;
  if(typeof hex!=='string'||!hex.length||hex.length>16*1024*1024||hex.length%2||!/^[0-9a-f]+$/i.test(hex))throw new Error('MiniMax 未返回有效音频。');
  if(withTiming){
    let words:{text:string;startTime:number;endTime:number}[]=[];
    try{
      const url=new URL(result.data?.subtitle_file||'');
      // Provider-owned subtitle storage only; never forward API credentials.
      if(url.protocol!=='https:'||url.hostname!=='minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com'||url.port||url.username||url.password)throw Error('Unexpected subtitle host');
      const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8000)});
      if(!response.ok||Number(response.headers.get('content-length'))>512000)throw Error('Invalid subtitles');
      const raw=await response.text();if(raw.length>512000)throw Error('Subtitles too large');
      const segments=JSON.parse(raw);if(!Array.isArray(segments))throw Error('Invalid subtitle format');
      words=minimaxWords(segments);
    }catch{console.warn('MiniMax word timestamps unavailable; retaining synthesized audio.');}
    return Response.json({format:'mp3',encoding:'hex',audio:hex,words},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  const bytes=new Uint8Array(hex.length/2);
  for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(hex.slice(i*2,i*2+2),16);
  return new Response(bytes,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
