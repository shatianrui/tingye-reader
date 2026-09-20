const assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {createLibrary}=load('src/tingye/library.ts'),{createReadingProgress}=load('src/tingye/reading-progress.ts');
const clone=v=>structuredClone(v);
(async()=>{
 const t=Date.now(),body={id:'progress-book',title:'进度回归',author:'测试',format:'EPUB',chapters:Array.from({length:8},(_,i)=>({title:String(i+1),text:'第一句。第二句。第三句。第四句。'}))};
 let rows=[{...body,chapters:[],local:true,backedUp:true,chapter:0,position:0,updatedAt:t-1000}],cloud={...rows[0],local:undefined,chapter:6,position:2,updatedAt:t},online=true;
 const writes=[];
 const remote=async(path,opt={})=>{
  if(!online)throw Error('offline');
  const b=opt.body&&JSON.parse(opt.body);
  if(opt.method==='POST')return{ok:true};
  if(opt.method==='PATCH'){writes.push(b);if(b.updatedAt>cloud.updatedAt)cloud={...cloud,...b};return{ok:true};}
  return{books:[clone(cloud)]};
 };
 const storage={load:async()=>clone(rows),save:async r=>rows=clone(r),read:async()=>clone(body),write:async()=>{},remove:async()=>{}};
 const library=createLibrary(storage,remote,async()=>{throw Error('Progress sync must not download the book again');});
 const reader=createReadingProgress(()=>t+100);
 reader.restore(await library.open(body.id),0,0);
 const result=await library.synchronize();assert.equal(result.downloaded,0);
 assert.equal((await library.open(body.id)).chapter,6);assert.equal((await library.open(body.id)).position,2);
 assert.equal(reader.take(),undefined,'restoring or background-saving an idle old reader must not publish stale progress');
 reader.restore(await library.open(body.id),6,2);reader.move(6,2);assert.equal(reader.take(),undefined,'same boundary and repeated layout cannot make reading newer');
 assert.equal(writes.length,0,'sync and opening the book are read-only for its progress');

 // A genuinely queued old reading event finishes after another device's newer sync.
 await library.progress(body,1,1,t-100);await library.flush();
 assert.equal((await library.open(body.id)).chapter,6,'delayed local event cannot overwrite newer imported progress');
 assert.equal(cloud.chapter,6);

 // Dirty local progress must yield to the newer cloud event before the first UI update.
 rows=[{...rows[0],chapter:2,position:1,updatedAt:t-50,dirty:true}];
 const restarted=createLibrary(storage,remote,async()=>{throw Error('Unexpected body transfer');});
 const updates=[];await restarted.synchronize(state=>updates.push(state.books.find(b=>b.id===body.id).chapter));
 assert.equal(updates[0],6,'first published catalog must already have the newer Android progress');
 assert.equal(cloud.chapter,6);

 // Actual backwards navigation is valid and wins when it happened later.
 reader.restore(await restarted.open(body.id),6,2);reader.move(3,1);
 const change=reader.take();assert.equal(change.updatedAt,t+100);assert.equal(reader.take(),undefined);
 await restarted.progress(change.book,change.chapter,change.position,change.updatedAt);await restarted.flush();
 assert.equal(cloud.chapter,3);assert.equal(cloud.position,1);
 // Repeated layout, pause/resume and leaving the reader do not create writes.
 reader.move(3,1);assert.equal(reader.take(),undefined);reader.clear();reader.move(0,0);assert.equal(reader.take(),undefined);
 online=false;const offline=createLibrary(storage,remote,async()=>{throw Error('Unexpected transfer');});
 assert.equal((await offline.open(body.id)).chapter,3);
 console.log('PASS: Android cloud progress wins, iOS restore creates no writes, delayed saves retain event time, dirty older state merges before UI update, genuine backwards reading uploads, offline restart preserves progress.');
})().catch(e=>{console.error(e);process.exitCode=1});
