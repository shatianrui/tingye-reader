const assert=require('node:assert/strict');
const {harness,tick}=require('./player-queue.cjs');
const voice={provider:'glm',model:'glm-tts',voice:'tongtong',rate:1};
const book={id:'glm-blocking',chapters:[{title:'测试',text:['甲乙丙丁。戊己庚辛','下一段仍然继续','最后一段'].map(p=>p+'字'.repeat(60)+'。').join('\n')}]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
(async()=>{
 // Speech authorization/recognition are optional helpers, not audio decoders.
 for(const phase of ['permission','recognition']){
  const held=deferred();let calls=0;
  const h=harness(false,false,phase==='permission'?{permission:()=>held.promise}:{align:()=>{calls++;return held.promise;}});
  try{
   let started=false;const start=h.player.start(book,0,0,voice).then(()=>started=true);
   await wait(80);
   assert.equal(started,true,`GLM audio blocked by pending ${phase}`);
   assert.equal(h.playlists[0].playing,true);assert.equal(h.playlists[0].sources.length,3);
   if(phase==='recognition')assert.equal(calls,1,'only one optional alignment may run at once');
   const p=h.playlists[0];p.emit({currentIndex:0,currentTime:4,duration:8,playing:true,isBuffering:false});
   const cursor=h.player.snapshot().cursor;assert.ok(cursor.offset>0);assert.ok(cursor.end>cursor.start);
   h.player.togglePause();p.emit({currentIndex:0,currentTime:6,duration:8,playing:true,isBuffering:false});assert.equal(h.player.snapshot().cursor,cursor);
   h.player.stop();held.resolve(phase==='permission'?true:[]);await start;await tick();
   assert.equal(h.player.snapshot().active,false);assert.equal(p.playing,false);assert.equal(h.player.snapshot().cursor,cursor);
  }finally{h.player.stop();held.resolve(phase==='permission'?false:[]);}
 }
 const failed=harness(false,false,{align:async()=>{throw Error('recognizer unavailable');}});
 try{await failed.player.start(book,0,0,voice);await tick();assert.equal(failed.player.snapshot().error,'');assert.equal(failed.playlists[0].playing,true);}finally{failed.player.stop();}
 console.log('PASS: GLM starts/queues/advances with unresolved permission or recognition; one background alignment, pause/cancellation, optional failure cannot break audio.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
