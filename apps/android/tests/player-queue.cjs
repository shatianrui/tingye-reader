const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const tick=()=>new Promise(r=>setImmediate(r));
function harness(blockPrefetch=false,androidSpeech=false,control={}){
 const utterances=[];
 const pending=[],requests=[],playlists=[],files=new Map();
 const compile=file=>ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/tingye',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const books={exports:{}};vm.runInNewContext(compile('books.ts'),{exports:books.exports,module:books});
 const pagination={exports:{}};vm.runInNewContext(compile('pagination.ts'),{exports:pagination.exports,module:pagination,require:()=>books.exports});
 const progress={exports:{}};vm.runInNewContext(compile('speech-progress.ts'),{exports:progress.exports,module:progress});
 const filesystem={Paths:{cache:'file:///cache'},File:class{constructor(base,name){this.uri=(typeof base==='string'?base:base.uri)+(name?'/'+name:'');}get exists(){return files.has(this.uri);}write(bytes){files.set(this.uri,bytes);}delete(){files.delete(this.uri);}},Directory:class{constructor(base,name){this.uri=base+'/'+name;}create(){}list(){return [...files.keys()].filter(uri=>uri.startsWith(this.uri+'/')).map(uri=>new filesystem.File(uri));}}};
 const cache={exports:{}};vm.runInNewContext(compile('audio-cache.ts'),{exports:cache.exports,module:cache,require:()=>filesystem});
 const policy={exports:{}};vm.runInNewContext(compile('audio-buffer-policy.ts'),{exports:policy.exports,module:policy});
 const retry={exports:{}};vm.runInNewContext(compile('tts-retry.ts'),{exports:retry.exports,module:retry,AbortController,setTimeout,clearTimeout,require:()=>policy.exports});
 const result={exports:{}};
 // Native AudioSource is an Expo Record. The factory normalizes strings;
 // SDK 57's imperative add() goes straight to Swift and requires the object.
 const validate=source=>{if(!source||typeof source!=='object'||typeof source.uri!=='string')throw new Error('Native AudioSource requires a uri record');return source;};
 vm.runInNewContext(compile('player.ts'),{exports:result.exports,module:result,AbortController,Uint8Array,Error,setTimeout,clearTimeout,console,
  require:id=>{
   if(id==='./books')return books.exports;
   if(id==='./pagination')return pagination.exports;
   if(id==='./speech-progress')return progress.exports;
   if(id==='./audio-cache')return cache.exports;
   if(id==='./audio-buffer-policy')return policy.exports;
   if(id==='./tts-retry')return retry.exports;
   if(id==='react')return {useSyncExternalStore:()=>{}};
   if(id==='react-native')return {Platform:{OS:androidSpeech?'android':'ios'}};
   if(id==='expo-secure-store')return {getItemAsync:async()=>null};
   if(id==='expo-speech')return {stop:async()=>{if(androidSpeech)utterances.at(-1)?.onStopped();},speak:(text,options)=>{requests.push(text);utterances.push(options);if(!androidSpeech)setImmediate(()=>{options.onBoundary?.({charIndex:3,charLength:1});options.onBoundary?.({charIndex:6,charLength:1});options.onDone();});}};
   if(id==='expo-file-system')return filesystem;
   if(id==='./client')return {request:async(_,options)=>{const text=JSON.parse(options.body).input,index=requests.length;requests.push(text);await control.gate?.(index,text);if(blockPrefetch&&requests.length>2)await new Promise(resolve=>pending.push(resolve));return {arrayBuffer:async()=>(control.bytes?.(text,index)??new Uint8Array([1,2,3])).buffer};}};
   if(id==='expo-audio')return {setAudioModeAsync:async()=>{},createAudioPlaylist:({sources})=>{
    const p={sources:sources.map(s=>validate(typeof s==='string'?{uri:s}:s)),skips:[],plays:0,pauses:0,destroyed:false,playing:false,
     add(s){validate(s);assert.equal(this.destroyed,false);this.sources.push(s);},
     addListener(_,fn){this.emit=fn;},play(){this.playing=true;this.plays++;},pause(){this.playing=false;this.pauses++;},
     skipTo(i){this.skips.push(i);},clear(){this.sources=[];this.playing=false;},removeAllListeners(){},destroy(){this.destroyed=true;},release(){this.released=true;}};
    playlists.push(p);return p;
   }};
   throw new Error('Unexpected dependency '+id);
  }
 });
 return {player:result.exports.readerPlayer,requests,playlists,files,utterances,pagination:pagination.exports,progress:progress.exports,Cache:cache.exports.AudioCache,policy:policy.exports,release(){blockPrefetch=false;pending.splice(0).forEach(r=>r());}};
}
const book={id:'test',chapters:[{title:'一',text:'甲。\n乙。\n丙。\n丁。\n戊。\n己。\n庚。\n辛。\n壬。'}]};
const voice={provider:'glm',model:'glm-tts',voice:'tongtong',rate:1.25};
(async()=>{
 const h=harness();await h.player.start(book,0,0,voice);await tick();
 assert.equal(h.player.snapshot().error,'','prefetched audio must cross the native add() boundary');
 const p=h.playlists[0];assert.equal(p.sources.length,9);assert.equal(p.playbackRate,1.25);assert.equal(p.playing,true);
 h.player.setRate(1.5);assert.equal(p.playbackRate,1.5);assert.equal(p.plays,1);assert.equal(p.destroyed,false);
 h.player.togglePause();h.player.setRate(.75);assert.equal(p.playbackRate,.75);assert.equal(p.playing,false);assert.equal(h.player.snapshot().paused,true);
 h.player.togglePause();assert.equal(p.playing,true);assert.equal(p.playbackRate,.75);
 p.emit({currentIndex:3,isBuffering:false,didJustFinish:false});await tick();assert.equal(p.sources.length,9);
 p.emit({currentIndex:6,isBuffering:false,didJustFinish:false});await tick();assert.equal(p.sources.length,9);
 assert.deepEqual(h.requests,['甲。','乙。','丙。','丁。','戊。','己。','庚。','辛。','壬。']);
 p.sources.forEach(s=>assert.ok(s.uri.endsWith('.wav')));
 p.emit({currentIndex:8,isBuffering:false,didJustFinish:true});assert.equal(h.player.snapshot().active,false);assert.equal(h.files.size,9,'stop retains bounded replay cache');h.player.clearCache();assert.equal(h.files.size,0);
 const switching=harness();
 await switching.player.start(book,0,0,voice);const old=switching.playlists[0];
 await switching.player.start(book,0,0,{...voice,voice:'chuichui'});await tick();
 assert.equal(old.playing,false,'destroy alone does not stop Android audio');assert.equal(old.sources.length,0);assert.equal(old.released,true);
 assert.equal(switching.playlists.filter(p=>p.playing).length,1,'only the new voice may play');
 switching.player.stop();assert.equal(switching.playlists.filter(p=>p.playing).length,0);
 const racing=harness();await Promise.all([racing.player.start(book,0,0,voice),racing.player.start(book,0,0,{...voice,voice:'xiaochen'})]);await tick();assert.equal(racing.playlists.filter(p=>p.playing).length,1);racing.player.stop();
 const slow=harness(true);await slow.player.start(book,0,0,voice);const q=slow.playlists[0];
 q.emit({currentIndex:1,isBuffering:false,didJustFinish:true});assert.equal(slow.player.snapshot().buffering,true);
 slow.release();await tick();assert.deepEqual(q.skips,[2],'resume at first newly synthesized sentence');assert.equal(slow.player.snapshot().error,'');slow.player.stop();
 const canceled=harness(true);await canceled.player.start(book,0,0,voice);const r=canceled.playlists[0];canceled.player.stop();canceled.release();await tick();
 assert.equal(r.sources.length,0);assert.equal(r.playing,false);assert.equal(r.released,true);assert.equal(canceled.files.size,2,'late canceled requests cannot populate cache');assert.equal(canceled.player.snapshot().active,false);canceled.player.clearCache();assert.equal(canceled.files.size,0);
 const loading=harness();const preparing=loading.player.start(book,0,0,voice);loading.player.setRate(1.5);loading.player.togglePause();await preparing;await tick();
 assert.equal(loading.playlists[0].playbackRate,1.5,'latest rate survives initial synthesis');
 assert.equal(loading.playlists[0].plays,0,'pausing during initial synthesis must prevent autoplay');
 loading.player.togglePause();assert.equal(loading.playlists[0].plays,1);loading.player.stop();
 const paused=harness();await paused.player.start(book,0,0,voice,{startOffset:0,paused:true});await tick();
 assert.equal(paused.playlists[0].plays,0,'changing voice preserves pause');paused.player.stop();
 const grouped=harness(),positions=[];grouped.player.onPosition=(_,si)=>positions.push(si);
 await grouped.player.start({id:'context',chapters:[{title:'一',text:'甲乙丙。丁戊己。庚辛壬。\n下一段。'}]},0,0,voice);
 assert.deepEqual(grouped.requests,['甲乙丙。丁戊己。庚辛壬。','下一段。'],'same paragraph shares prosody without crossing paragraph breaks');
 grouped.playlists[0].emit({currentIndex:0,currentTime:5,duration:9,isBuffering:false,playing:true});
 assert.equal(positions.at(-1),1,'grouped narration keeps original sentence highlight IDs');grouped.player.stop();
 const midSentence=harness();await midSentence.player.start({id:'resume-context',chapters:[{title:'一',text:'甲。乙。丙。'}]},0,1,voice);
 assert.equal(midSentence.requests[0],'乙。丙。','resuming must not replay earlier sentences in the same paragraph');midSentence.player.stop();
 const limit=grouped.pagination.narrationGroups('甲乙丙丁。'.repeat(180));
 assert.ok(limit.every(item=>item.text.length<=400));assert.equal(limit.map(item=>item.text).join(''),'甲乙丙丁。'.repeat(180));
 // A sentence spans three pages but stays in one audio track. Page turns
 // update the cursor only: no second TTS request, pause, seek or restart.
 const paged=harness(),moves=[];paged.player.onPosition=(ci,si,offset)=>moves.push({ci,si,offset});
 const long={id:'pages',chapters:[{title:'一',text:'甲乙丙丁戊己庚辛。'},{title:'二',text:'壬癸。'}]};
 await paged.player.start(long,0,0,voice,{startOffset:0});await tick();
 const queue=paged.playlists[0];assert.deepEqual(paged.requests,['甲乙丙丁戊己庚辛。','壬癸。']);
 const status={currentIndex:0,isBuffering:false,playing:true,didJustFinish:false,duration:8.7};
 queue.emit({...status,currentTime:3.01});
 assert.deepEqual(moves.at(-1),{ci:0,si:0,offset:3});
 assert.equal(paged.pagination.pageForOffset([3,6,9],moves.at(-1).offset),1,'flip before the full sentence finishes');
 queue.emit({...status,currentTime:6.01});assert.equal(moves.at(-1).offset,6);
 assert.equal(queue.sources.length,2);assert.equal(queue.plays,1);assert.equal(queue.pauses,0);assert.equal(queue.skips.length,0);
 queue.emit({...status,currentTime:7,isBuffering:true});assert.equal(moves.at(-1).offset,6,'buffering must not advance pages');
 paged.player.togglePause();queue.emit({...status,currentTime:8});assert.equal(moves.at(-1).offset,6,'paused playback must not advance pages');
 paged.player.togglePause();queue.emit({...status,currentTime:6.1});assert.equal(moves.at(-1).offset,6);
 paged.player.stop();queue.emit({...status,currentTime:8});assert.equal(moves.at(-1).offset,6,'stale playback events are ignored');
 const resume=harness();await resume.player.start(long,0,0,voice,{startOffset:3});await tick();
 assert.equal(resume.requests[0],'丁戊己庚辛。','manual-page start keeps the entire remaining sentence');resume.player.stop();
 const system=harness(),boundaries=[];system.player.onPosition=(_,__,offset)=>boundaries.push(offset);
 await system.player.start({id:'system',chapters:[long.chapters[0]]},0,0,{...voice,provider:'system'},{startOffset:0});
 assert.deepEqual(system.requests,['甲乙丙丁戊己庚辛。']);assert.ok(boundaries.includes(3)&&boundaries.includes(6),'system voice follows real native word callbacks');
 const wav=Buffer.alloc(44+4800*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(9600,40);
 for(let i=800;i<4000;i++)wav.writeInt16LE(i%2?8000:-8000,44+i*2);
 const original=Buffer.from(wav),envelope=paged.progress.wavEnvelope(wav);
 assert.ok(envelope);assert.equal(paged.progress.estimatedSpeechOffset('甲乙丙丁',0,.1,.6,envelope),0);
 assert.equal(paged.progress.estimatedSpeechOffset('甲乙丙丁',0,.3,.6,envelope),2);
 assert.equal(paged.progress.estimatedSpeechOffset('甲乙丙丁',0,.5,.6,envelope),4);
 // The native player's reported duration can diverge from the WAV header's
 // (envelope.duration, always .6 here); the native-domain fraction currentTime/duration
 // must drive the estimate, never currentTime/envelope.duration.
 assert.equal(paged.progress.estimatedSpeechOffset('甲乙丙丁',0,.2,1.2,envelope),0,'same ratio as .1/.6 must give the same offset even though duration diverges from envelope.duration');
 assert.equal(paged.progress.estimatedSpeechOffset('甲乙丙丁',0,.6,1.2,envelope),2,'same ratio as .3/.6 must give the same offset even though duration diverges from envelope.duration');
 assert.deepEqual(wav,original,'audio must never be trimmed or rewritten');
 assert.equal(paged.progress.wavEnvelope(new Uint8Array([1,2,3])),undefined);
 assert.deepEqual(Array.from(paged.pagination.measuredPageEnds('甲乙\n丙丁\n戊己',[{text:'甲乙',height:20},{text:'丙丁',height:20},{text:'戊己',height:20}],40)),[6,8]);
 console.log('PASS: native AudioSource boundary, sequential prefetch, 1.25x playback, queue refill, starvation recovery, stop cancellation and cache cleanup.');
 console.log('PASS: whole-sentence synthesis, within-track page turns without audio operations, pause/buffer guards, manual start, native speech boundaries and read-only WAV envelope.');
 console.log('PASS: paragraph prosody groups, original sentence IDs, request size limits, live rate changes, initial-buffer pause and paused voice replacement.');
 const android=harness(false,true);
 const narrating=android.player.start({id:'android',chapters:[{title:'一',text:'甲乙丙丁戊己。\n下一段。'}]},0,0,{...voice,provider:'system'});
 await tick();android.utterances[0].onBoundary({charIndex:3});android.player.togglePause();await tick();
 assert.equal(android.player.snapshot().active,true);assert.equal(android.player.snapshot().paused,true);assert.equal(android.requests.length,1,'pause must not advance to next paragraph');
 android.player.togglePause();await tick();assert.equal(android.requests[1],'丁戊己。','Android resumes at latest word boundary');
 android.utterances[1].onBoundary({charIndex:1});android.player.setRate(1.75);await tick();assert.equal(android.utterances.at(-1).rate,1.75);assert.equal(android.requests.at(-1),'戊己。');
 android.utterances.at(-1).onDone();await tick();assert.equal(android.requests.at(-1),'下一段。');
 android.player.stop();await narrating;assert.equal(android.player.snapshot().active,false);
 console.log('PASS: Android system TTS pause/resume retains position and stop cancels narration.');
 // New buffering policy: measure actual unmodified WAV duration, keep long
 // first clips playing while the second is outstanding, never rush short clips.
 const wavFor=seconds=>{
  const data=Buffer.alloc(44+Math.round(seconds*8000)*2);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(8000,24);data.writeUInt32LE(16000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);for(let n=44;n<data.length;n+=2)data.writeInt16LE(8000,n);return new Uint8Array(data);
 };
 let releaseSecond;const waitSecond=new Promise(r=>releaseSecond=r);
 const early=harness(false,false,{bytes:()=>wavFor(110),gate:i=>i===1?waitSecond:undefined});
 const earlyStart=early.player.start(book,0,0,voice);await tick();await tick();
 assert.equal(early.playlists.length,1,'long measured first clip can start before second request completes');
 assert.equal(early.playlists[0].sources.length,1,'out-of-order later results must not skip the missing clip');
 assert.equal(early.playlists[0].playing,true);assert.equal(early.playlists[0].skips.length,0);
 await earlyStart;releaseSecond();await tick();assert.ok(early.playlists[0].sources.length>=5);assert.equal(early.playlists[0].plays,1);early.player.clearCache();
 let releaseShort;const waitShort=new Promise(r=>releaseShort=r);
 const short=harness(false,false,{bytes:()=>wavFor(3),gate:i=>i===1?waitShort:undefined});
 const shortStart=short.player.start(book,0,0,voice);await tick();await tick();assert.equal(short.playlists.length,0,'short first clip must wait for continuity buffer');
 short.player.togglePause();releaseShort();await shortStart;await tick();assert.equal(short.playlists[0].plays,0,'initial pause still wins when delayed buffer arrives');short.player.clearCache();
 let releaseFourth;const waitFourth=new Promise(r=>releaseFourth=r);
 const ordered=harness(false,false,{bytes:(_,i)=>new Uint8Array([i+1,2,3]),gate:i=>i===3?waitFourth:undefined});
 await ordered.player.start(book,0,0,voice);await tick();
 assert.equal(ordered.playlists[0].sources.length,3,'third ready clip must be queued without waiting for slow fourth');
 releaseFourth();await tick();
 ordered.playlists[0].sources.forEach((source,i)=>assert.equal(ordered.files.get(source.uri)[0],i+1,'queue preserves exact original order'));
 const beforeReplay=ordered.requests.length;ordered.player.stop();await ordered.player.start(book,0,0,{...voice,rate:2});await tick();
 assert.equal(ordered.requests.length,beforeReplay,'same voice/text reuses audio even after speed changes');
 ordered.files.clear();ordered.player.stop();await ordered.player.start(book,0,0,voice);await tick();assert.ok(ordered.requests.length>beforeReplay,'OS cache deletion safely triggers new synthesis');
 ordered.player.clearCache();const afterLogout=ordered.requests.length;await ordered.player.start(book,0,0,voice);await tick();assert.ok(ordered.requests.length>afterLogout,'account cache reset does not reuse prior audio');ordered.player.clearCache();
 const many={id:'many',chapters:[{title:'一',text:Array.from({length:30},(_,i)=>`段落${i}。`).join('\n')}]};
 const seconds=harness(false,false,{bytes:()=>wavFor(20)});await seconds.player.start(many,0,0,{...voice,rate:1});await tick();assert.equal(seconds.playlists[0].sources.length,5);
 seconds.player.setRate(2);await tick();assert.ok(seconds.playlists[0].sources.length>5,'2x extends lookahead using playback seconds');assert.ok(seconds.playlists[0].sources.length<=12);
 assert.equal(seconds.playlists[0].plays,1);assert.equal(seconds.playlists[0].pauses,0);seconds.player.clearCache();
 const failing=harness(false,false,{gate:i=>{if(i===2)throw Error('offline-next');}});await failing.player.start(book,0,0,voice);await tick();
 assert.equal(failing.playlists[0].playing,true);assert.equal(failing.player.snapshot().error,'','prefetch failure must not cut current audio');
 failing.playlists[0].emit({currentIndex:1,currentTime:1,duration:1,isBuffering:false,didJustFinish:true});
 assert.equal(failing.player.snapshot().active,false);assert.equal(failing.player.snapshot().error,'offline-next');failing.player.clearCache();
 const cacheHarness=harness(),cache=new cacheHarness.Cache(8,2),a=cache.store('a',new Uint8Array(4),'wav'),b=cache.store('b',new Uint8Array(4),'wav');
 a.release();const c=cache.store('c',new Uint8Array(4),'wav');assert.equal(a.audio.file.exists,false,'LRU entry evicted to enforce byte/entry bounds');assert.ok(b.audio.file.exists&&c.audio.file.exists,'queued audio must stay pinned');b.release();c.release();cache.clear();assert.equal(cacheHarness.files.size,0);
 assert.equal(cacheHarness.policy.canStartAhead(30,20),false);assert.equal(cacheHarness.policy.canStartAhead(110,45),true);
 console.log('PASS: safe early start with full timeout margin at 2x; short-clip guard; ordered independent completions; replay cache, cache deletion and logout isolation; time-based prefetch; no audio truncation on speculative failures; bounded pinned LRU cache.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
