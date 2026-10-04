import { requestUser } from '@/lib/mobile-auth';
import { minimaxRequest } from '@/lib/minimax';
export async function POST(req:Request){
 if(!await requestUser(req))return Response.json({error:'请先登录。'},{status:401});
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(process.env.APP_ORIGIN||req.url).origin)return Response.json({error:'请求来源不受支持。'},{status:403});
 try{
  const raw=await req.text();if(raw.length>2000)return Response.json({error:'请求过大。'},{status:413});
  const body=JSON.parse(raw||'{}');if(body?.provider!=='minimax')return Response.json({error:'不支持的语音来源。'},{status:400});
  const creds={key:typeof body.key==='string'&&body.key.trim()?body.key.trim():typeof body.apiKey==='string'&&body.apiKey.trim()?body.apiKey.trim():undefined,groupId:typeof body.groupId==='string'&&body.groupId.trim()?body.groupId.trim():undefined};
  const data=await minimaxRequest('/get_voice',{voice_type:'all'},creds);
  const voices=[...(data.system_voice||[]),...(data.voice_cloning||[]),...(data.voice_generation||[])].filter(v=>typeof v.voice_id==='string').map(v=>({value:v.voice_id,label:v.voice_name||v.description?.[0]||v.voice_id}));
  return Response.json({voices:[...new Map(voices.map(v=>[v.value,v])).values()]},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'获取 MiniMax 音色失败。'},{status:502});}
}
