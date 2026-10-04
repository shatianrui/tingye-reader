export type VoiceConfig = { provider: 'glm' | 'minimax' | 'system'; model: string; voice: string; rate: number; apiKey?: string; groupId?: string };
export type VoiceOption = {value:string;label:string};
export const defaultVoice: VoiceConfig = { provider: 'glm', model: 'glm-tts', voice: 'tongtong', rate: 1 };
export function normalizeVoice(value: Partial<VoiceConfig> = {}): VoiceConfig {
  const rate=Number.isFinite(value.rate)?Math.max(.5,Math.min(2,value.rate!)):1;
  if(!['glm','minimax','system'].includes(value.provider||''))return {...defaultVoice,rate};
  return {...defaultVoice,...value,rate};
}
export function voices(config: VoiceConfig): VoiceOption[] {
  if (config.provider === 'glm') return ['tongtong','chuichui','xiaochen','jam','kazi','douji','luodo','tiantian','yueyue','rongrong','chengzi','huahua','nuonuo'].map((value,i)=>({value,label:['彤彤','锤锤','小陈','Jam','Kazi','Douji','Luodo','甜甜','悦悦','融融','橙子','花花','诺诺'][i]}));
  if (config.provider === 'minimax') return [{value:'male-qn-qingse',label:'青涩青年'},{value:'female-shaonv',label:'少女'},{value:'female-yujie',label:'御姐'},{value:'female-chengshu',label:'成熟女性'},{value:'female-tianmei',label:'甜美女性'},{value:'presenter_male',label:'男性主持人'},{value:'presenter_female',label:'女性主持人'},{value:'audiobook_male_1',label:'有声书男声1'},{value:'audiobook_male_2',label:'有声书男声2'},{value:'audiobook_female_1',label:'有声书女声1'},{value:'audiobook_female_2',label:'有声书女声2'},{value:'male-qn-jingying',label:'精英青年'},{value:'male-qn-badao',label:'霸道青年'},{value:'male-qn-daxuesheng',label:'大学生'},{value:'female-qn-qingse',label:'青涩女声'},{value:'female-qn-yujie',label:'御姐女声'},{value:'female-qn-chengshu',label:'成熟女声'},{value:'female-qn-tianmei',label:'甜美女声'}];
  return [];
}
export const MODEL_OPTIONS: Record<'glm'|'minimax', VoiceOption[]> = {
  glm: [{value:'glm-tts',label:'glm-tts'},{value:'glm-tts-flash',label:'glm-tts-flash'},{value:'glm-tts-pro',label:'glm-tts-pro'}],
  minimax: [{value:'speech-2.8-hd',label:'speech-2.8-hd'},{value:'speech-2.8-turbo',label:'speech-2.8-turbo'},{value:'speech-2.6-hd',label:'speech-2.6-hd'},{value:'speech-2.6-turbo',label:'speech-2.6-turbo'},{value:'speech-02-hd',label:'speech-02-hd'},{value:'speech-02-turbo',label:'speech-02-turbo'},{value:'speech-01-hd',label:'speech-01-hd'},{value:'speech-01-turbo',label:'speech-01-turbo'},{value:'t2a-01-hd',label:'t2a-01-hd'},{value:'t2a-01',label:'t2a-01'}],
};
