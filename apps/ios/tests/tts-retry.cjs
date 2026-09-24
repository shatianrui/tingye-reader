const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/tingye/tts-retry.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,ms===45000?1000:5),clearTimeout,require:()=>({SYNTH_TIMEOUT_MS:45000})});
const rate=()=>Object.assign(Error('rate'),{status:429,code:'TTS_RATE_LIMIT',retryAfter:60});
(async()=>{
 let attempts=0;const value=await m.exports.withTtsRetry(async()=>{if(++attempts<3)throw rate();return 'audio';},new AbortController().signal);assert.equal(value,'audio');assert.equal(attempts,3);
 attempts=0;await assert.rejects(m.exports.withTtsRetry(async()=>{attempts++;throw rate();},new AbortController().signal),/rate/);assert.equal(attempts,3);
 for(const error of [Object.assign(Error('daily'),{status:429,code:'TTS_DAILY_LIMIT',retryAfter:60}),Object.assign(Error('balance'),{status:502}),Object.assign(rate(),{retryAfter:999})]){attempts=0;await assert.rejects(m.exports.withTtsRetry(async()=>{attempts++;throw error;},new AbortController().signal));assert.equal(attempts,1);}
 for(const error of [Object.assign(Error('offline'),{status:0}),Object.assign(Error('gateway'),{status:504})]){
  attempts=0;assert.equal(await m.exports.withTtsRetry(async()=>{if(++attempts<3)throw error;return 'audio';},new AbortController().signal),'audio');assert.equal(attempts,3,'transient transport failures are retried');
  attempts=0;await assert.rejects(m.exports.withTtsRetry(async()=>{attempts++;throw error;},new AbortController().signal));assert.equal(attempts,3,'transient retries are bounded');
 }
 attempts=0;assert.equal(await m.exports.withTtsRetry(async signal=>{if(++attempts===1)await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('AbortError'))));return 'audio';},new AbortController().signal),'audio');assert.equal(attempts,2,'a request that hits its own timeout is retried');
 attempts=0;await assert.rejects(m.exports.withTtsRetry(async()=>{attempts++;throw Object.assign(Error('unconfigured'),{status:503});},new AbortController().signal));assert.equal(attempts,1);
 const cancel=new AbortController();attempts=0;const pending=m.exports.withTtsRetry(async()=>{attempts++;throw rate();},cancel.signal);await Promise.resolve();await Promise.resolve();cancel.abort();await assert.rejects(pending,/已停止/);assert.equal(attempts,1);
 console.log('PASS: Retry-After frequency backoff, fresh request timeout, bounded retries, abort, no retry of daily/balance/invalid waits; bounded retry of dropped connections, timeouts and 504.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
