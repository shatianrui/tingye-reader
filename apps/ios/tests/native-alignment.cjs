const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {tick}=require('./player-queue.cjs');
function load(native){
 const timers=new Map();let id=0;const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('src/tingye/native-speech-alignment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,AbortController,console,
  setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  require:id=>id==='expo'?{requireOptionalNativeModule:()=>native}:id==='react-native'?{Platform:{OS:'ios'}}:require('./load-ts.cjs')('src/tingye/speech-timing.ts')});
 return{...module.exports,timers,expire(ms){const found=[...timers.values()].find(t=>t.ms===ms);assert.ok(found);found.fn();}};
}
(async()=>{
 let complete,cancels=0,calls=0;
 const h=load({requestSpeechAlignment:()=>new Promise(()=>{}),alignSpeech:()=>{calls++;return new Promise(r=>complete=r);},cancelSpeechAlignment:async()=>{cancels++;}});
 const permission=h.prepareSpeechAlignment();await tick();h.expire(10000);assert.equal(await permission,false);assert.equal(h.timers.size,0);
 const signal=new AbortController();const task=h.alignSpeechFile('file:///speech.wav','你好。',signal.signal);await tick();h.expire(25000);assert.equal((await task).length,0);await tick();assert.equal(cancels,1);assert.equal(h.timers.size,0);
 complete({status:'aligned',words:[{text:'你好',startTime:0,endTime:1}]});await tick();assert.equal(cancels,1,'late completion cannot settle twice');
 const aborted=new AbortController();const canceled=h.alignSpeechFile('file:///speech.wav','你好。',aborted.signal);await tick();aborted.abort();assert.equal((await canceled).length,0);await tick();assert.equal(cancels,2);assert.equal(h.timers.size,0);
 const before=calls;await h.alignSpeechFile('file:///speech.wav','你好。',aborted.signal);assert.equal(calls,before,'already canceled work must not reach native code');
 const success=load({requestSpeechAlignment:async()=>true,alignSpeech:async()=>({status:'aligned',words:[{text:'你好',startTime:.1,endTime:.8}]}),cancelSpeechAlignment:async()=>{throw Error('should not cancel completed work');}});
 assert.equal(await success.prepareSpeechAlignment(),true);const marks=await success.alignSpeechFile('file:///speech.wav','你好。',new AbortController().signal);assert.equal(marks.length,1);assert.equal(marks[0].start,0);assert.equal(success.timers.size,0);
 console.log('PASS: native alignment/permission timeout, cancellation, late callbacks and successful timestamps; no retained timers.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
