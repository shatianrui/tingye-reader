const assert=require('node:assert/strict');
const {harness,tick}=require('./player-queue.cjs');
const {connectPlayback}=require('./load-ts.cjs')('src/tingye/playback-bridge.ts');
const text='甲乙丙丁。戊己庚辛。';
const book={id:'bridge-sync',chapters:[{title:'一',text},{title:'二',text:'下一章。'}]};
const voice={provider:'glm',model:'glm-tts',voice:'tongtong',rate:1.5};
(async()=>{
 for(const provider of ['glm','minimax','system']){
  // Hold system speech so the test controls real boundary callback delivery.
  const h=harness(false,false,{manualSpeech:provider==='system',response:provider==='minimax'?()=>({headers:{get:()=> 'application/json'},json:async()=>({audio:'010203',words:[{text:'甲乙丙丁',startTime:0,endTime:4},{text:'戊己庚辛',startTime:4.7,endTime:8.7}]})}):undefined});
  const sent=[];
  // Register the React/status observer first: playback must still be delivered first.
  const offStatus=h.player.subscribe(()=>{const s=h.player.snapshot();assert.equal(sent.at(-1),s.active&&s.cursor?.chapter===0?s.cursor:null,'paint must be dispatched before controls are notified');});
  const off=connectPlayback(h.player,0,cursor=>sent.push(cursor));
  const start=h.player.start(book,0,0,{...voice,provider});
  await tick();if(provider!=='system')await start;await tick();
  const queue=h.playlists[0];
  if(queue)assert.equal(queue.updateInterval,50);
  const emit=seconds=>provider==='system'?h.utterances[0].onBoundary({charIndex:Math.floor(seconds),charLength:1}):queue.emit({currentIndex:0,currentTime:seconds,duration:9.4,playing:true,isBuffering:false,playbackRate:1.5});
  emit(1.01);const status=h.player.statusSnapshot();
  emit(2.01);
  assert.equal(sent.at(-1),h.player.snapshot().cursor,provider+': cursor reaches bridge within the callback, without a React render');
  assert.equal(sent.at(-1).offset,2,provider+': native media seconds/boundaries are not multiplied by 1.5 again');
  assert.equal(h.player.statusSnapshot(),status,provider+': controls/library must not render on each character');
  if(queue){const before=sent.length;queue.emit({currentIndex:0,currentTime:3.5,duration:9.4,playing:true,isBuffering:true});assert.equal(sent.length,before,'buffering must not advance the displayed position');}
  const count=sent.length;h.player.togglePause();emit(3.01);assert.equal(sent.length,count,provider+': pause freezes the displayed position');
  h.player.togglePause();emit(5.01);assert.equal(sent.at(-1).position,1);assert.notEqual(h.player.statusSnapshot(),status);
  const restored=[];const detach=connectPlayback(h.player,0,c=>restored.push(c));assert.equal(restored[0],h.player.snapshot().cursor,'reload starts from the latest native event');detach();
  const other=[];const detachOther=connectPlayback(h.player,1,c=>other.push(c));assert.equal(other[0],null,'never paint another chapter cursor on the old page');
  if(queue){queue.emit({currentIndex:1,currentTime:0,duration:5,playing:true,isBuffering:false});assert.equal(sent.at(-1),null);assert.equal(other.at(-1).chapter,1);}
  h.player.stop();assert.equal(sent.at(-1),null);assert.equal(other.at(-1),null);off();detachOther();offStatus();
  const ended=sent.length;emit(8);assert.equal(sent.length,ended,'stopped events and unmounted readers cannot paint');await start;
 }
 console.log('PASS: direct GLM/MiniMax/system cursor delivery at 1.5x; stable controls between sentence boundaries, pause, resume, reload, chapter isolation and stop. Simulated native events; no physical device claim.');
})().catch(e=>{console.error(e);process.exitCode=1;});
