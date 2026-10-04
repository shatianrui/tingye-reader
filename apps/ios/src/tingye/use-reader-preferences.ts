import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCallback, useEffect, useRef, useState} from 'react';
import {readingTheme} from './themes';
import {defaultTypography, normalizeTypography, type Typography} from './typesetting';
import {loadVoiceCredentials, saveVoiceCredentials} from './voice-keys';
import {defaultVoice, normalizeVoice, type VoiceConfig} from './voices';

export type Preferences = {fontSize:number;theme:string;voice:VoiceConfig;typography:Typography;originalLayout:boolean;spreadMode:'auto'|'single'};
export const initialPreferences:Preferences = {fontSize:22,theme:'paper',voice:defaultVoice,typography:defaultTypography,originalLayout:true,spreadMode:'auto'};
const storageKey = 'tingye.native.preferences.v1';

/**
 * Reader preferences persisted to AsyncStorage. Nothing is written until the
 * caller marks startup finished, so defaults never overwrite stored choices.
 * Voice API keys are stored separately in SecureStore and merged in/out at
 * load/save boundaries so they never reach unencrypted AsyncStorage.
 */
export function useReaderPreferences(){
  const [prefs,setPrefs] = useState(initialPreferences);
  const ready = useRef(false);
  const loadPreferences = useCallback(async()=>{
    const stored = await AsyncStorage.getItem(storageKey);if(!stored)return;
    const p = JSON.parse(stored);
    const creds = await loadVoiceCredentials();
    const voice:VoiceConfig = normalizeVoice(p.voice);
    const saved = voice.provider==='glm'||voice.provider==='minimax'?creds[voice.provider]:undefined;
    if(saved?.key)voice.apiKey = saved.key;
    if(saved?.groupId)voice.groupId = saved.groupId;
    setPrefs({...initialPreferences,...p,theme:readingTheme(p.theme,p.night===true).id,fontSize:Math.max(16,Math.min(30,Number(p.fontSize)||22)),voice,typography:normalizeTypography(p.typography)});
  },[]);
  const markPreferencesReady = useCallback(()=>{ready.current = true;},[]);
  useEffect(()=>{if(ready.current){
    // Extract provider credentials into SecureStore before writing the rest to AsyncStorage.
    const {apiKey,groupId,...voiceWithoutKey}=prefs.voice;
    if(prefs.voice.provider==='glm'||prefs.voice.provider==='minimax')void saveVoiceCredentials(prefs.voice.provider,{key:apiKey||'',groupId:groupId||''});
    void AsyncStorage.setItem(storageKey,JSON.stringify({...prefs,voice:voiceWithoutKey})).catch(()=>{});
  }},[prefs]);
  return {prefs,setPrefs,loadPreferences,markPreferencesReady};
}
