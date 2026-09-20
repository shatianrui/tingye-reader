export type VoiceConfig = { provider: 'glm' | 'minimax' | 'system'; model: string; voice: string; rate: number };
export type VoiceOption = {value:string;label:string};
export const defaultVoice: VoiceConfig = { provider: 'glm', model: 'glm-tts', voice: 'tongtong', rate: 1 };
export function normalizeVoice(value: Partial<VoiceConfig> = {}): VoiceConfig {
  const rate=Number.isFinite(value.rate)?Math.max(.5,Math.min(2,value.rate!)):1;
  if(!['glm','minimax','system'].includes(value.provider||''))return {...defaultVoice,rate};
  return {...defaultVoice,...value,rate};
}
export function voices(config: VoiceConfig): VoiceOption[] {
  if (config.provider === 'glm') return ['tongtong','chuichui','xiaochen','jam','kazi','douji','luodo'].map((value,i)=>({value,label:['彤彤','锤锤','小陈','Jam','Kazi','Douji','Luodo'][i]}));
  if (config.provider === 'minimax') return [{value:'male-qn-qingse',label:'青涩青年'}];
  return [];
}
