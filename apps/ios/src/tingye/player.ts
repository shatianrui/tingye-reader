import { createAudioPlaylist, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { request } from './client';
import {withTtsRetry} from './tts-retry';
import { type Book } from './books';
import { narrationGroups, sentenceRanges, CLOUD_GROUP_CHARS, CLOUD_FIRST_GROUP_CHARS } from './pagination';
import { wavEnvelope, estimatedSpeechOffset, type SpeechEnvelope } from './speech-progress';
import {speakableText} from './speech-text';
import {mapTimedWords,speechMarkAt,pageOffsetWithinMark,type SpeechMark,type TimedWord} from './speech-timing';
import {prepareSpeechAlignment,alignSpeechFile} from './native-speech-alignment';
import type { VoiceConfig } from './voices';
import {AudioCache,type AudioLease} from './audio-cache';
import {SYNTH_TIMEOUT_MS,MAX_AHEAD_TRACKS,MIN_AHEAD_TRACKS,bufferedTargetSeconds,estimatedAudioSeconds,canStartAhead} from './audio-buffer-policy';

type Position = ReturnType<typeof narrationGroups>[number] & { chapter: number; envelope?: SpeechEnvelope;marks?:SpeechMark[];key?:string };
type PlaybackLayout = { startOffset: number; paused?: boolean };
export type ReadingCursor = { chapter: number; position: number; offset: number; start: number; end: number };
type State = { active: boolean; paused: boolean; buffering: boolean; chapter: number; position: number; cursor?: ReadingCursor; error: string;timingNotice?:string };
type PlayerStatus = Omit<State, 'cursor'>;
// Tingye: extended via native patches in tools/patch-audio-events.cjs.
type PlaylistStatus = import('expo-audio').AudioPlaylistStatus & { externalPause?: boolean; externalResume?: boolean; itemFailed?: boolean };
// A 30 s MiniMax clip is ~1 MB of hex. Regex splitting plus parseInt allocates
// one string per byte and stalls the JS thread that services the audio queue.
export function hexBytes(hex:string){
  const out=new Uint8Array(hex.length>>1);
  for(let i=0,j=0;i<out.length;i++,j+=2){const a=hex.charCodeAt(j),b=hex.charCodeAt(j+1);out[i]=(((a&15)+(a>>6)*9)<<4)|((b&15)+(b>>6)*9);}
  return out;
}
const OSS_HOST=/^minimax-algeng-chat-tts\.oss-cn-[a-z0-9-]+\.aliyuncs\.com$/;
export function providerFileUrl(value:unknown){
  if(typeof value!=='string'||value.length>4096)return undefined;
  const match=/^https:\/\/([^/?#@:]+)\//.exec(value);
  return match&&OSS_HOST.test(match[1])?value:undefined;
}
export function minimaxSubtitleWords(segments:unknown){
  const words:TimedWord[]=[];
  if(!Array.isArray(segments))return words;
  for(const segment of segments){
    let previous:{begin:number;end:number;text:string}|undefined;
    for(const w of Array.isArray(segment?.timestamped_words)?segment.timestamped_words:[]){
      if(typeof w?.word!=='string'||w.word.length>=300||!Number.isFinite(w.time_begin)||!Number.isFinite(w.time_end)||w.time_begin<0||w.time_end<=w.time_begin)continue;
      const repeated=previous&&Number.isInteger(w.word_begin)&&w.word_begin===previous.begin&&w.word_end===previous.end&&w.word===previous.text;
      if(repeated)words[words.length-1].endTime=Math.max(words[words.length-1].endTime,w.time_end/1000);
      else words.push({text:w.word,startTime:w.time_begin/1000,endTime:w.time_end/1000});
      previous={begin:w.word_begin,end:w.word_end,text:w.word};
      if(words.length>4000)return [];
    }
  }
  return words;
}
// MiniMax files live in mainland storage next to most listeners; fetching them
// directly avoids relaying every clip through the overseas server twice.
const DIRECT_AUDIO_TIMEOUT_MS=15000;
async function directMinimaxAudio(data:{url?:unknown;subtitleUrl?:unknown},parent:AbortSignal){
  const url=providerFileUrl(data.url),subtitleUrl=providerFileUrl(data.subtitleUrl);
  if(!url)throw Error('语音地址无效');
  // A slow storage link must leave enough of the request budget for the relay fallback.
  const controller=new AbortController(),cancel=()=>controller.abort(),timer=setTimeout(cancel,DIRECT_AUDIO_TIMEOUT_MS);
  if(parent.aborted)controller.abort();else parent.addEventListener('abort',cancel,{once:true});
  const signal=controller.signal;
  try{
    const subtitles=subtitleUrl?fetch(subtitleUrl,{signal,redirect:'error'}).then(r=>r.ok?r.json():[]).then(minimaxSubtitleWords,()=>[] as TimedWord[]):Promise.resolve([] as TimedWord[]);
    const response=await fetch(url,{signal,redirect:'error'});
    if(!response.ok)throw Error('语音下载失败');
    const bytes=new Uint8Array(await response.arrayBuffer());
    return {bytes,words:await subtitles};
  }finally{clearTimeout(timer);parent.removeEventListener('abort',cancel);}
}
class ReaderPlayer {
  private listeners = new Set<() => void>();
  private playbackListeners = new Set<() => void>();
  private generation = 0;
  private abort: AbortController | null = null;
  private playlist: ReturnType<typeof createAudioPlaylist> | null = null;
  private cache = new AudioCache();
  private leases: AudioLease[] = [];
  private refill: (()=>void)|null = null;
  private recentLatency = 12;
  private system = false;
  private speaking = false;
  private externalPaused = false;
  private speechStopped: Promise<void> = Promise.resolve();
  private rate = 1;
  private state: State = { active: false, paused: false, buffering: false, chapter: 0, position: 0, error: '' };
  private status: PlayerStatus = this.state;
  onPosition: ((chapter: number, position: number, offset: number) => void) | null = null;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  subscribePlayback = (callback: () => void) => { this.playbackListeners.add(callback); return () => { this.playbackListeners.delete(callback); }; };
  snapshot = () => this.state;
  statusSnapshot = () => this.status;
  private update(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    const {cursor, ...status} = this.state;
    if ((Object.keys(status) as (keyof PlayerStatus)[]).some(key => status[key] !== this.status[key])) this.status = status;
    this.playbackListeners.forEach(f=>f());
    this.listeners.forEach(f=>f());
  }
  stop() {
    this.generation++;
    this.refill=null;
    this.abort?.abort(); this.abort = null;
    const playlist=this.playlist; this.playlist=null;
    // Android SDK 57 destroy() only removes the registry entry. Explicitly
    // silence and empty the native player before releasing its shared object.
    if(playlist){
      playlist.pause();
      playlist.clear();
      playlist.removeAllListeners('playlistStatusUpdate');
      playlist.destroy();
      playlist.release();
    }
    if (this.system) this.stopSpeech();
    this.system=false;
    this.speaking = false;
    this.externalPaused = false;
    this.leases.forEach(lease=>lease.release());this.leases=[];
    this.update({active:false,paused:false,buffering:false});
  }
  clearCache(){this.stop();this.cache.clear();}
  private stopSpeech() {
    this.speechStopped=this.speechStopped.catch(()=>{}).then(()=>Speech.stop());
    void this.speechStopped.catch(()=>{});
  }
  togglePause() {
    if (!this.state.active) return;
    const paused = !this.state.paused;
    if (this.system) {
      if (Platform.OS === 'android') {
        // Android has no TTS pause API. Stop this utterance and resume it
        // from its latest word boundary inside the narration loop.
        this.update({paused});
        if(paused&&this.speaking)this.stopSpeech();
        return;
      }
      if(this.speaking)void (paused ? Speech.pause() : Speech.resume()).catch(()=>this.stop());
    }
    else {
      // Resuming can fail while an audio interruption still owns the session;
      // stay paused instead of claiming playback that is not happening.
      try { if (paused) this.playlist?.pause(); else this.playlist?.play(); }
      catch { return; }
    }
    this.externalPaused=false;
    this.update({paused});
  }
  setRate(rate: number) {
    if(!Number.isFinite(rate))return;
    this.rate=Math.max(.5,Math.min(2,rate));
    if(this.playlist)this.playlist.playbackRate=this.rate;
    this.refill?.();
    if(this.system&&this.speaking&&!this.state.paused)this.stopSpeech();
  }
  private waitUntilResumed(generation: number) {
    if(!this.state.paused || generation!==this.generation)return Promise.resolve();
    return new Promise<void>(resolve=>{
      const unsubscribe=this.subscribe(()=>{if(!this.state.paused || generation!==this.generation){unsubscribe();resolve();}});
    });
  }
  async start(book: Book, chapter: number, position: number, config: VoiceConfig, layout?: PlaybackLayout) {
    this.stop();
    this.setRate(config.rate);
    const generation = this.generation;
    const items: Position[] = [];
    const chapterSentences=new Map<number,ReturnType<typeof sentenceRanges>>();
    let nextChapter = chapter;
    this.abort = new AbortController(); const signal = this.abort.signal;
    this.system = config.provider==='system';
    this.update({active:true,paused:layout?.paused??false,buffering:true,error:'',timingNotice:'',chapter,position,cursor:undefined});
    let lastMove='';
    const move = (item: Position, offset = item.start) => {
      if(generation!==this.generation)return;
      // Keep the last spoken character selected until the next clip starts.
      // An end offset is exclusive and can otherwise select a different page.
      offset=Math.max(item.start,Math.min(item.end-1,offset));
      const anchor=item.anchors.find(a=>a.end>offset)??item.anchors.at(-1)!;
      // Whitespace between sentences is not part of either highlighted range.
      // Follow the selected sentence's first character, not an empty prior page.
      offset=Math.max(anchor.start,offset);
      const range=chapterSentences.get(item.chapter)?.[anchor.position]??anchor;
      const position=anchor.position,key=`${item.chapter}:${position}:${offset}`;
      if(key===lastMove)return;lastMove=key;
      // Always paint the whole original sentence, including punctuation and a
      // clipped opening on resume. Only the within-sentence page anchor moves.
      const cursor={chapter:item.chapter,position,offset,start:range.start,end:range.end};
      this.update({chapter:item.chapter,position,cursor});
      this.onPosition?.(item.chapter,position,offset);
    };
    const ensureItems = async (count: number) => {
      while(items.length<count && nextChapter<book.chapters.length && generation===this.generation) {
        const ci=nextChapter++,text=book.chapters[ci].text;
        chapterSentences.set(ci,sentenceRanges(text));
        const limit=config.provider==='system'?400:CLOUD_GROUP_CHARS,first=config.provider!=='system'&&ci===chapter?CLOUD_FIRST_GROUP_CHARS:limit;
        for(const segment of narrationGroups(text,ci===chapter?(layout?.startOffset??0):0,ci===chapter?position:0,limit,first)) {
          items.push({...segment,chapter:ci});
        }
      }
    };
    try {
      await this.speechStopped;
      if(generation!==this.generation)return;
      await setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:true,interruptionMode:'doNotMix'});
      await ensureItems(2);
      if (generation!==this.generation) return;
      if(!items.length){this.stop();return;}
      if (this.system) {
        this.update({buffering:false});
        for (let index=0; ; index++) {
          await ensureItems(index+1);
          await this.waitUntilResumed(generation);
          if(generation!==this.generation)return;
          const item=items[index];if(!item)break;
          move(item);
          let cursor=0,finished=false;
          while(!finished&&generation===this.generation){
            await this.waitUntilResumed(generation);
            await this.speechStopped;
            if(generation!==this.generation)return;
            const base=cursor;
            this.speaking=true;
            finished=await new Promise<boolean>((resolve,reject)=>Speech.speak(speakableText(item.text).slice(base),{language:'zh-CN',voice:config.voice||undefined,rate:this.rate,useApplicationAudioSession:true,onBoundary:(event:{charIndex:number;charLength?:number})=>{if(generation===this.generation&&!this.state.paused&&'charIndex' in event){cursor=Math.min(item.text.length-1,base+event.charIndex);move(item,item.start+cursor);}},onDone:()=>resolve(true),onStopped:()=>resolve(false),onError:()=>reject(new Error('系统语音无法播放，请更换音色。'))}));
            if(generation===this.generation)this.speaking=false;
          }
          if(generation!==this.generation)return;
          this.speaking=false;
          move(item,item.end);
        }
        if(generation===this.generation)this.stop();
        return;
      }
      // Optional recognition must never sit on the synthesis/playback critical path.
      // One background job at a time; stale queued work is skipped after a track
      // ends, and a separate cache pin protects the file while native code reads.
      const alignmentReady=config.provider==='glm'?prepareSpeechAlignment(signal).catch(()=>false):Promise.resolve(false);
      let alignmentChain=Promise.resolve(),playedThrough=-1;
      const alignments=new Map<Position,AbortController>();
      const backgroundAlign=(item:Position,key:string)=>{
        if(config.provider!=='glm'||item.marks?.length)return;
        alignmentChain=alignmentChain.then(async()=>{
          if(!await alignmentReady||signal.aborted||items.indexOf(item)<=playedThrough)return;
          const held=this.cache.acquire(key);if(!held)return;
          const controller=new AbortController(),cancel=()=>controller.abort();
          alignments.set(item,controller);signal.addEventListener('abort',cancel,{once:true});
          try{
            const marks=await alignSpeechFile(held.audio.file.uri,speakableText(item.text),controller.signal);
            if(!signal.aborted&&!controller.signal.aborted&&generation===this.generation&&items.indexOf(item)>playedThrough&&marks.length){item.marks=marks;held.audio.marks=marks;}
          }finally{signal.removeEventListener('abort',cancel);alignments.delete(item);held.release();}
        }).catch(()=>{/* Alignment failure cannot stop otherwise valid audio. */});
      };
      const synth = async (item: Position) => {
        const key=JSON.stringify(['word-timing-v1',book.id,config.provider,config.model,config.voice,speakableText(item.text)]);
        item.key=key;
        const hit=this.cache.acquire(key);
        if(hit){
          this.leases.push(hit);item.envelope=hit.audio.envelope;item.marks=hit.audio.marks;
          backgroundAlign(item,key);
          return hit;
        }
        const requestedAt=Date.now();
        const bytes=await withTtsRetry(async requestSignal=>{
          let bytes:Uint8Array;
          const direct=config.provider==='minimax';
          const fetchClip=(delivery?:'url')=>request('/api/tts',{method:'POST',body:JSON.stringify({provider:config.provider,model:config.model,voice:config.voice,key:config.apiKey||'',groupId:config.groupId||'',input:speakableText(item.text),timing:true,...(delivery?{delivery}:{})}),signal:requestSignal});
          let response = await fetchClip(direct?'url':undefined);
          if(response.headers?.get('content-type')?.includes('application/json')){
            let data=await response.json() as {audio?:string;words?:TimedWord[];delivery?:string;url?:string;subtitleUrl?:string};
            if(data.delivery==='url'){
              try{const file=await directMinimaxAudio(data,requestSignal);item.marks=mapTimedWords(item.text,file.words);return file.bytes;}
              catch(error){
                if(requestSignal.aborted)throw error;
                // Storage unreachable from this network: fall back to the server relay.
                response=await fetchClip();
                if(!response.headers?.get('content-type')?.includes('application/json'))return new Uint8Array(await response.arrayBuffer());
                data=await response.json() as typeof data;
              }
            }
            if(typeof data.audio!=='string'||!data.audio.length||data.audio.length>16*1024*1024||data.audio.length%2||!/^[0-9a-f]+$/i.test(data.audio))throw Error('语音返回格式异常');
            bytes=hexBytes(data.audio);
            item.marks=mapTimedWords(item.text,Array.isArray(data.words)?data.words:[]);
          }else bytes = new Uint8Array(await response.arrayBuffer());
          return bytes;
        },signal);
        if(generation!==this.generation)throw new Error('已停止');
        if(!bytes.length || bytes.length>8*1024*1024)throw new Error('语音文件大小异常，请重试。');
        item.envelope=wavEnvelope(bytes);
        const lease=this.cache.store(key,bytes,config.provider==='glm'?'wav':'mp3',item.envelope);
        this.leases.push(lease);
        lease.audio.marks=item.marks;
        backgroundAlign(item,key);
        this.recentLatency=Math.max((Date.now()-requestedAt)/1000,this.recentLatency*.85);
        return lease;
      };
      const prepared=new Map<number,AudioLease>(),failed=new Map<number,unknown>(),deadlines=new Map<number,number>();
      let playlist:ReturnType<typeof createAudioPlaylist>|null=null;
      let queued=0,next=0,current=0,running=0,pumping=false,ended=false,currentTime=0;
      let resolveStartup!:()=>void;
      const startup=new Promise<void>(resolve=>{resolveStartup=resolve;});
      const finishStartup=()=>{signal.removeEventListener('abort',finishStartup);resolveStartup();};
      signal.addEventListener('abort',finishStartup,{once:true});
      const fatal=(error:unknown)=>{if(generation===this.generation){this.stop();this.update({error:error instanceof Error?error.message:'语音预合成失败，请重试。'});}finishStartup();};
      const duration=(index:number)=>prepared.get(index)?.audio.duration??estimatedAudioSeconds(items[index].text);
      const remaining=(until:number)=>{
        let seconds=-currentTime;for(let i=current;i<until;i++)seconds+=duration(i);
        return Math.max(0,seconds)/this.rate;
      };
      const append=()=>{
        if(generation!==this.generation)return;
        let contiguous=queued;while(prepared.has(contiguous))contiguous++;
        if(!playlist){
          const complete=contiguous===items.length&&nextChapter===book.chapters.length;
          const remainingDeadline=Math.max(0,((deadlines.get(1)??(Date.now()+SYNTH_TIMEOUT_MS))-Date.now())/1000);
          const safeFirst=canStartAhead(prepared.get(0)?.audio.duration,remainingDeadline);
          if(!contiguous||(!complete&&contiguous<2&&!safeFirst)){
            if(failed.has(contiguous))fatal(failed.get(contiguous));return;
          }
          playlist=createAudioPlaylist({sources:Array.from({length:contiguous},(_,i)=>({uri:prepared.get(i)!.audio.file.uri})),updateInterval:50});
          this.playlist=playlist;playlist.playbackRate=this.rate;queued=contiguous;
          playlist.addListener('playlistStatusUpdate',(status: PlaylistStatus)=>{
            if(generation!==this.generation||!playlist)return;
            // System audio events: interruptions, route changes, or failed items.
            if(status.externalPause&&this.state.active&&!this.state.paused){
              this.externalPaused=true;this.update({paused:true,buffering:false});
              return;
            }
            if(status.externalResume&&this.state.active&&this.state.paused&&this.externalPaused){
              this.externalPaused=false;this.update({paused:false});
              return;
            }
            if(status.itemFailed){
              // A corrupt clip poisons the replay cache; drop it so the next
              // start re-synthesizes instead of failing on the same bytes.
              const item=items[current];if(item?.key)this.cache.evict(item.key);
              fatal(new Error('语音片段损坏，请重新播放。'));
              return;
            }
            const index=status.currentIndex;
            if(!Number.isInteger(index)||index<current||!items[index])return;
            if(index!==current&&items[index]){
              playedThrough=index-1;
              for(let i=current;i<index;i++){
                alignments.get(items[i])?.abort();
                const lease=prepared.get(i);if(lease){lease.release();this.leases=this.leases.filter(owned=>owned!==lease);prepared.delete(i);}
                if(items[i])items[i].envelope=undefined;
              }
              current=index;currentTime=0;move(items[index]);
            }
            if(Number.isFinite(status.currentTime))currentTime=status.currentTime;
            const audio=prepared.get(index)?.audio;
            if(audio&&Number.isFinite(status.duration)&&status.duration>0)audio.duration=status.duration;
            if(items[index]&&status.playing&&!status.isBuffering&&!this.state.paused){
              if(typeof status.playbackRate==='number'&&Math.abs(status.playbackRate-this.rate)>.01)playlist.playbackRate=this.rate;
              const item=items[index],mark=speechMarkAt(item.marks||[],currentTime);
              if(mark){
                const previous=this.state.cursor;
                const floor=previous?.chapter===item.chapter&&previous.offset>=item.start&&previous.offset<item.end?previous.offset:item.start;
                move(item,Math.max(floor,item.start+pageOffsetWithinMark(item.text,mark,currentTime)));
              }
              else if(!item.marks?.length){
                // Missing timestamps must not freeze page following. Use only the
                // native audio clock (already rate-adjusted), never a wall timer.
                // This is sentence-level estimation, NOT precise word timing.
                const estimated=estimatedSpeechOffset(item.text,item.start,currentTime,audio?.duration??0,item.envelope);
                const previous=this.state.cursor;
                const floor=previous?.chapter===item.chapter&&previous.offset>=item.start&&previous.offset<item.end?previous.offset:item.start;
                const offset=Math.min(item.end-1,Math.max(floor,estimated));
                move(item,offset);
              }
              const timingNotice=item.marks?.length?'':'整句高亮 · 进度估算，当前音频暂无可用时间戳。';
              if(this.state.timingNotice!==timingNotice)this.update({timingNotice});
            }
            if(status.didJustFinish&&index===queued-1){
              if(items[index])move(items[index],items[index].end);
              if(queued===items.length&&nextChapter===book.chapters.length){this.stop();return;}
              ended=true;
              if(failed.has(queued)){fatal(failed.get(queued));return;}
            }
            const buffering=ended||status.isBuffering;
            if(this.state.buffering!==buffering)this.update({buffering});
            void pump();
          });
          this.update({buffering:false});move(items[0]);if(!this.state.paused)playlist.play();finishStartup();
        }else if(contiguous>queued){
          const resumeIndex=queued;
          // Commit each completed clip in order; a slower later request must
          // never hold an already-ready next clip outside the native queue.
          while(queued<contiguous){playlist.add({uri:prepared.get(queued)!.audio.file.uri});queued++;}
          if(ended){ended=false;playlist.skipTo(resumeIndex);if(!this.state.paused)playlist.play();}
        }
        // A speculative failure does not interrupt audio already playing.
        if(ended&&failed.has(queued))fatal(failed.get(queued));
      };
      const refresh=()=>{try{append();}catch(error){fatal(error);}};
      const pump=async()=>{
        if(pumping||generation!==this.generation||failed.size)return;
        pumping=true;
        try {
          while(running<2&&next<current+MAX_AHEAD_TRACKS&&generation===this.generation&&!failed.size){
            await ensureItems(next+1);
            if(generation!==this.generation||next>=items.length)break;
            if(next>=current+MIN_AHEAD_TRACKS&&remaining(next)>=bufferedTargetSeconds(this.recentLatency))break;
            const index=next++;running++;deadlines.set(index,Date.now()+SYNTH_TIMEOUT_MS);
            void synth(items[index]).then(lease=>{
              if(generation!==this.generation){lease.release();return;}
              prepared.set(index,lease);refresh();
            }).catch(error=>{if(generation===this.generation){failed.set(index,error);refresh();}}).finally(()=>{running--;deadlines.delete(index);void pump();});
          }
        }catch(error){fatal(error);}finally{pumping=false;}
      };
      this.refill=()=>{void pump();};void pump();await startup;
    } catch(error) {
      if(generation===this.generation){this.stop();this.update({error:error instanceof Error?error.message:'播放失败，请重试。'});}
    }
  }
}
export const readerPlayer=new ReaderPlayer();
// Controls need sentence/state changes; per-character positions go straight to
// the WebView through connectPlayback instead of rendering the entire library.
export function usePlayer(){return useSyncExternalStore(readerPlayer.subscribe,readerPlayer.statusSnapshot);}

