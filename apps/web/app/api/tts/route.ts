const env = process.env;
import {db} from "@/lib/db";
import {dailyCharacterLimit,reserveTtsBudget,TtsQuotaError} from "@/lib/tts-quota";
export const runtime="nodejs";
export const maxDuration=60;
import { minimaxAudio, minimaxAudioUrl } from "@/lib/minimax";
import { readGlmWav } from "@/lib/glm-audio";
import { requestUser } from "@/lib/mobile-auth";

const endpoints: Record<string,string> = {
  glm: "https://open.bigmodel.cn/api/paas/v4/audio/speech",
  minimax: "https://api.minimaxi.com/v1/t2a_v2",
};
// GLM failures carry {error:{code,message}} JSON; surface a bounded excerpt so
// users can see which field the provider rejected (key, model, voice…).
async function upstreamDetail(upstream:Response){
  try{
    const body=JSON.parse((await upstream.text()).slice(0,4000)) as {error?:{message?:string};message?:string};
    const message=typeof body?.error?.message==='string'?body.error.message:typeof body?.message==='string'?body.message:'';
    return message?`服务商返回：${message.slice(0,200)}`:'';
  }catch{return '';}
}
export async function GET(req:Request) {
  if (!await requestUser(req)) return Response.json({error:"请先登录。"},{status:401});
  return Response.json({limits:{dailyCharacters:dailyCharacterLimit(env.TTS_DAILY_CHARACTERS),requestsPerMinute:60,maxCharactersPerRequest:1000},minimax:{configured:!!env.MINIMAX_API_KEY,model:env.MINIMAX_MODEL||'speech-2.8-hd'},glm:{configured:!!env.GLM_TTS_API_KEY,model:env.GLM_TTS_MODEL||"glm-tts",voice:env.GLM_TTS_VOICE||"tongtong"}},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:Request) {
  const user=await requestUser(req);if (!user) return Response.json({error:"请先登录后使用语音服务。"},{status:401});
  if(req.headers.get("origin")&&req.headers.get("origin")!==new URL(process.env.APP_ORIGIN||req.url).origin) return Response.json({error:"请求来源不受支持。"},{status:403});
  let refund: (()=>Promise<void>) | undefined;
  let synthesized=false;
  try {
    if(Number(req.headers.get("content-length"))>20000) return Response.json({error:"请求过大。"},{status:413});
    const raw=await req.text();
    if(raw.length>12000) return Response.json({error:"请求过大。"},{status:413});
    let body; try {body=JSON.parse(raw)} catch {return Response.json({error:"无效语音请求。"},{status:400})}
    const {provider,input}=body||{};
    if(!Object.hasOwn(endpoints,provider)||typeof input!=="string"||!input.trim()||input.length>1000) return Response.json({error:"请检查语音来源与朗读文本。"},{status:400});
    if(provider==='glm')body.voice??=env.GLM_TTS_VOICE||'tongtong';
    if(typeof body.voice!=='string'||!body.voice.trim()||body.voice.length>200)return Response.json({error:'请选择有效音色。'},{status:400});
    const userKey=typeof body.key==='string'&&body.key.trim()?body.key.trim():typeof body.apiKey==='string'&&body.apiKey.trim()?body.apiKey.trim():undefined;
    if(!userKey&&!(provider==='glm'?env.GLM_TTS_API_KEY:env.MINIMAX_API_KEY))return Response.json({error:'语音服务尚未配置密钥。请在设置中输入自己的 API 密钥，或暂用本地语音。'},{status:503});
    await reserveTtsBudget(db(),'tts-minute:'+user.userId,60,60,1,'frequency');
    refund=await reserveTtsBudget(db(),'tts:'+user.userId,dailyCharacterLimit(env.TTS_DAILY_CHARACTERS),86400,input.length,'daily');
    if(provider==='minimax'){
      if(typeof body.voice!=='string'||!body.voice.trim()||body.voice.length>200)return Response.json({error:'请选择 MiniMax 音色。'},{status:400});
      // User-provided MiniMax credentials take priority over server env keys.
      const creds={key:userKey,groupId:typeof body.groupId==='string'&&body.groupId.trim()?body.groupId.trim():undefined,model:typeof body.model==='string'&&body.model.trim()?body.model.trim():undefined};
      try{const timing=body.timing===true;const audio=(body.delivery==='url'?await minimaxAudioUrl(input,body.voice,timing,creds):undefined)??await minimaxAudio(input,body.voice,timing,creds);synthesized=true;return audio;}catch(error){return Response.json({error:error instanceof Error?error.message:'MiniMax 请求失败。'},{status:502});}
    }
    const glm=provider==="glm";
    // User-provided keys take priority over server env keys.
    const key=body.key||body.apiKey||(glm?env.GLM_TTS_API_KEY:env.MINIMAX_API_KEY);
    const model=body.model||(glm?(env.GLM_TTS_MODEL||"glm-tts"):(env.MINIMAX_MODEL||'speech-2.8-hd'));
    const voice=glm?(body.voice??env.GLM_TTS_VOICE??"tongtong"):body.voice;
    if(!key) return Response.json({error:"语音服务尚未配置。请在设置中输入自己的 API 密钥，或暂用系统语音。"},{status:503});
    if(typeof key!=="string"||!key||key.length>1000||typeof model!=="string"||!model||model.length>150||typeof voice!=="string"||!voice||voice.length>200) return Response.json({error:"请检查密钥、模型与音色。"},{status:400});
    // GLM otherwise adds an audible watermark to every synthesized sentence.
    // The provider applies this preference only when the account allows it.
    const upstream=await fetch(endpoints[provider],{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,voice:provider==="openai"&&voice.startsWith("voice_")?{id:voice}:voice,input,response_format:glm?"wav":"mp3",...(glm?{speed:1,volume:1,watermark_enabled:false}: {})}),signal:AbortSignal.timeout(45000),redirect:"manual"});
    if(!upstream.ok){
      const detail=await upstreamDetail(upstream);
      const error=upstream.status===401?"语音密钥无效或已过期。":upstream.status===402?"语音服务余额不足，请充值后重试。":upstream.status===429?"语音服务额度不足或请求过快，请稍后重试。":upstream.status===403?"当前密钥没有此语音模型的使用权限。":`语音服务返回 ${upstream.status}，请检查模型权限和音色。`;
      return Response.json({error:detail?`${error}（${detail}）`:error,upstreamStatus:upstream.status},{status:502});
    }
    const type=upstream.headers.get("Content-Type")||"";
    if(type.includes("json")||type.startsWith("text/")){
      const detail=await upstreamDetail(upstream);
      return Response.json({error:detail?`语音服务未返回音频。（${detail}）`:"语音服务未返回音频，请检查账户额度和音色。"},{status:502});
    }
    const audio=await readGlmWav(upstream);
    synthesized=true;
    return new Response(new Uint8Array(audio),{headers:{"Content-Type":"audio/wav","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  } catch (error) {if(error instanceof TtsQuotaError)return error.response();console.warn("TTS transport failed", error instanceof Error ? {name:error.name,message:error.message} : "Unknown transport error");return Response.json({error:"语音请求失败或超时，请检查网络与服务配置。"},{status:502})}
  finally {if(refund&&!synthesized)await refund().catch(()=>console.warn('TTS quota refund failed'));}
}
