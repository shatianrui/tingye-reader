import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {api,ORIGIN} from './client';
import type {ReadingTheme} from './themes';

export default function CloudConnection({colors}:{colors:ReadingTheme}) {
 const [message,setMessage]=useState('网页与 App 使用同一套听页账号。');
 const [checking,setChecking]=useState(false);
 const check=async()=>{
  if(checking)return;
  setChecking(true);
  try {
   const result=await api<{user:{username:string}|null}>('/api/auth',{signal:AbortSignal.timeout(10000)});
   if(!result.user){setMessage('已连接听页云端 · 请登录以检测语音配置');return;}
   const tts=await api<{limits?:{dailyCharacters:number;requestsPerMinute:number;maxCharactersPerRequest:number}}> ('/api/tts',{signal:AbortSignal.timeout(10000)});
   const limits=tts.limits?`\n应用每日字数：${tts.limits.dailyCharacters===0?'不限':tts.limits.dailyCharacters}；每分钟 ${tts.limits.requestsPerMinute} 次。单次 ${tts.limits.maxCharactersPerRequest} 字，App 自动分段。临时限流会等待重试，服务商余额和配额另计。`:'';
   setMessage(`已连接 · 当前账号 ${result.user.username}\nGLM 与 MiniMax 使用下方填写的自有密钥合成。${limits}\n此检测不调用付费合成；密钥有效性及余额以实际播放结果为准。`);
  } catch(error) {setMessage(error instanceof Error?error.message:'连接失败，请重试。');}
  finally {setChecking(false);}
 };
 return <View style={{padding:18,gap:10,backgroundColor:colors.surface,borderColor:colors.line,borderWidth:1,borderRadius:18}}>
  <Text style={{fontSize:15,fontWeight:'600',color:colors.text}}>听页云端 · Vercel</Text>
  <Text selectable style={{fontSize:13,color:colors.accent}}>{ORIGIN.replace('https://','')}</Text>
  <Text accessibilityLiveRegion="polite" style={{fontSize:13,lineHeight:20,color:colors.muted}}>{message}</Text>
  <Pressable accessibilityRole="button" disabled={checking} onPress={()=>void check()} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontWeight:'600'}}>{checking?'正在检测…':'检测连接与语音配置 ↗'}</Text></Pressable>
 </View>;
}
