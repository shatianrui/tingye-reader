import * as SecureStore from 'expo-secure-store';

// Voice provider credentials are user-owned secrets. They live in the system
// keychain (SecureStore), never in AsyncStorage preferences, and are only
// sent to the Tingye cloud relay at synthesis time; the relay does not
// persist them.
const STORE_KEY='tingye.voice.keys.v1';
export type CloudVoiceProvider='glm'|'minimax';
export type VoiceCredentials={key?:string;groupId?:string};
type CredMap=Partial<Record<CloudVoiceProvider,VoiceCredentials>>;

export async function loadVoiceCredentials():Promise<CredMap>{
  try{
    const raw=await SecureStore.getItemAsync(STORE_KEY);const parsed=raw?JSON.parse(raw):{};
    if(!parsed||typeof parsed!=='object')return {};
    // Legacy shape stored plain strings per provider.
    const out:CredMap={};
    for(const p of ['glm','minimax'] as const){const v=parsed[p];if(typeof v==='string'&&v)out[p]={key:v};else if(v&&typeof v==='object')out[p]={key:typeof v.key==='string'?v.key:undefined,groupId:typeof v.groupId==='string'?v.groupId:undefined};}
    return out;
  }catch{return {};}
}

export async function saveVoiceCredentials(provider:CloudVoiceProvider,creds:VoiceCredentials){
  try{
    const keys=await loadVoiceCredentials();
    if(creds.key||creds.groupId)keys[provider]={key:creds.key||undefined,groupId:creds.groupId||undefined};else delete keys[provider];
    await SecureStore.setItemAsync(STORE_KEY,JSON.stringify(keys));
  }catch{/* Keychain unavailable: credentials stay runtime-only for this session. */}
}
