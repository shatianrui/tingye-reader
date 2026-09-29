import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCallback, useEffect, useRef, useState} from 'react';
import {readingTheme} from './themes';
import {defaultTypography, normalizeTypography, type Typography} from './typesetting';
import {defaultVoice, normalizeVoice, type VoiceConfig} from './voices';

export type Preferences = {fontSize:number;theme:string;voice:VoiceConfig;typography:Typography;originalLayout:boolean;spreadMode:'auto'|'single'};
export const initialPreferences:Preferences = {fontSize:22,theme:'paper',voice:defaultVoice,typography:defaultTypography,originalLayout:true,spreadMode:'auto'};
const storageKey = 'tingye.native.preferences.v1';

/**
 * Reader preferences persisted to AsyncStorage. Nothing is written until the
 * caller marks startup finished, so defaults never overwrite stored choices.
 */
export function useReaderPreferences(){
  const [prefs,setPrefs] = useState(initialPreferences);
  const ready = useRef(false);
  const loadPreferences = useCallback(async()=>{
    const stored = await AsyncStorage.getItem(storageKey);if(!stored)return;
    const p = JSON.parse(stored);
    setPrefs({...initialPreferences,...p,theme:readingTheme(p.theme,p.night===true).id,fontSize:Math.max(16,Math.min(30,Number(p.fontSize)||22)),voice:normalizeVoice(p.voice),typography:normalizeTypography(p.typography)});
  },[]);
  const markPreferencesReady = useCallback(()=>{ready.current = true;},[]);
  useEffect(()=>{if(ready.current)void AsyncStorage.setItem(storageKey,JSON.stringify(prefs)).catch(()=>{});},[prefs]);
  return {prefs,setPrefs,loadPreferences,markPreferencesReady};
}
