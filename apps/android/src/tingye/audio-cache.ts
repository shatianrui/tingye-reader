import {Directory,File,Paths} from 'expo-file-system';
import type {SpeechEnvelope} from './speech-progress';

export type CachedAudio={file:File;bytes:number;envelope?:SpeechEnvelope;duration?:number;pins:number};
export type AudioLease={audio:CachedAudio;release:()=>void};
// Recent audio survives stop/replay within the signed-in app session. The index
// never contains credentials and the dedicated cache is cleared on account exit.
export class AudioCache{
 private entries=new Map<string,CachedAudio>();
 private directory:Directory|undefined;
 constructor(private maxBytes=128*1024*1024,private maxEntries=96){}
 private dir(){
  if(!this.directory){
   const dir=new Directory(Paths.cache,'tingye-audio-v2');dir.create({intermediates:true,idempotent:true});
   // Files from an interrupted previous process have no live native player.
   for(const file of dir.list())if(file instanceof File&&/\/audio-[\w.-]+\.(wav|mp3)$/.test(file.uri)){try{file.delete();}catch{}}
   this.directory=dir;
  }
  return this.directory;
 }
 private lease(audio:CachedAudio):AudioLease{audio.pins++;let released=false;return {audio,release:()=>{if(!released){released=true;audio.pins--;this.trim();}}};}
 acquire(key:string):AudioLease|undefined{
  const audio=this.entries.get(key);if(!audio)return;
  if(!audio.file.exists){this.entries.delete(key);return;}
  this.entries.delete(key);this.entries.set(key,audio);return this.lease(audio);
 }
 store(key:string,bytes:Uint8Array,extension:'wav'|'mp3',envelope?:SpeechEnvelope):AudioLease{
  const hit=this.acquire(key);if(hit)return hit;
  const file=new File(this.dir(),`audio-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
  file.write(bytes);
  const audio:CachedAudio={file,bytes:bytes.length,envelope,duration:envelope?.duration,pins:0};
  this.entries.set(key,audio);const lease=this.lease(audio);this.trim();return lease;
 }
 private trim(){
  let bytes=[...this.entries.values()].reduce((sum,a)=>sum+a.bytes,0);
  for(const [key,audio] of this.entries){
   if(bytes<=this.maxBytes&&this.entries.size<=this.maxEntries)break;
   if(audio.pins)continue;
   try{if(audio.file.exists)audio.file.delete();}catch{continue;}
   bytes-=audio.bytes;this.entries.delete(key);
  }
 }
 clear(){for(const audio of this.entries.values()){try{if(audio.file.exists)audio.file.delete();}catch{}}this.entries.clear();}
}
