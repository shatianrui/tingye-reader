const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/tingye/tts-retry.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,ms===45000?1000:5),clearTimeout,require:()=>({SYNTH_TIMEOUT_MS:45000})});
const rate=()=>Object.assign(Error('rate'),{status:429,code:'TTS_RATE_LIMIT',retryAfter:60});
(async()=>{
 let attempts=0;const value=await m.exports.withTtsRetry(async()=>{if(++attempts<3)throw rate();return 'audio';},new AbortController().signal);assert.equal(value,'audio');assert.equal(attempts,3);
 attempts=0;await assert.rejects(m.exports.withTtsRetry(async()=>{attempts++;throw rate();},new AbortController().signal),/rate/);assert.equal(attempts,3);
 for(const error of [Object.assign(Error('daily'),{status:429,code:'TTS_DAILY_LIMIT',retryAfter:60}),Object.assign(Error('balance'),{status:502}),Object.assign(rate(),{retryAfter:999})]){attempts=0;await assert.rejects(m.exports.withTtsRetry(async()=>{attempts++;throw error;},new AbortController().signal));assert.equal(attempts,1);}
 const cancel=new AbortController();attempts=0;const pending=m.exports.withTtsRetry(async()=>{attempts++;throw rate();},cancel.signal);await Promise.resolve();await Promise.resolve();cancel.abort();await assert.rejects(pending,/已停止/);assert.equal(attempts,1);
 attempts=0;const timed=await m.exports.withTtsRetry(signal=>{attempts++;if(attempts>1)return Promise.resolve('late');return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('FetchRequestCanceledException: Fetch request has been canceled'))));},new AbortController().signal);assert.equal(timed,'late');assert.equal(attempts,2);
 attempts=0;await assert.rejects(m.exports.withTtsRetry(async()=>{attempts++;throw TypeError('fetch failed');},new AbortController().signal),e=>e.message===m.exports.TTS_NETWORK_MESSAGE&&e.status===0);assert.equal(attempts,3);
 attempts=0;assert.equal(await m.exports.withTtsRetry(async()=>{attempts++;if(attempts===1)throw Object.assign(Error('offline'),{status:0});if(attempts===2)throw rate();return 'mixed';},new AbortController().signal),'mixed');assert.equal(attempts,3);
 console.log('PASS: Retry-After frequency backoff, timeout/network retry, fresh request timeout, bounded retries, abort, no retry of daily/balance/invalid waits.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
