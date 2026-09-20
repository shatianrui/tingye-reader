const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let user=true,reply={base_resp:{status_code:0},data:{audio:'4944330102'}},calls=[],upstreamStatus=200;
const env={MINIMAX_API_KEY:'test-server-secret',MINIMAX_MODEL:'speech-2.8-hd',MINIMAX_REGION:'cn'};
const modules=new Map();
function load(file){if(modules.has(file))return modules.get(file);const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>id==='cloudflare:workers'?{env}:id==='@/lib/mobile-auth'?{requestUser:async()=>user}:load('lib/minimax.ts'),Response,Request,URL,Uint8Array,AbortSignal,Error,console,fetch:async(url,options)=>{if(!["manual","follow"].includes(options.redirect))throw new TypeError("Invalid redirect value in Workers");calls.push({url,...options});return upstreamStatus===200?Response.json(reply):new Response(null,{status:upstreamStatus,headers:{Location:"https://unexpected.example/"}});}});
 modules.set(file,module.exports);return module.exports;
}
const tts=load('app/api/tts/route.ts'),voices=load('app/api/tts/voices/route.ts');
const req=body=>new Request('https://example.test/api/tts',{method:'POST',body:JSON.stringify(body)});
(async()=>{
 const audio=await tts.POST(req({provider:'minimax',input:'测试。',voice:'male-qn-qingse',key:'client-must-not-override',model:'invalid'}));
 assert.equal(audio.status,200);assert.equal(audio.headers.get('content-type'),'audio/mpeg');assert.deepEqual(Buffer.from(await audio.arrayBuffer()),Buffer.from('4944330102','hex'));
 assert.equal(calls[0].url,'https://api.minimax.cn/v1/t2a_v2');assert.equal(calls[0].headers.Authorization,'Bearer test-server-secret');assert.equal(JSON.parse(calls[0].body).model,'speech-2.8-hd');assert.equal(JSON.parse(calls[0].body).voice_setting.speed,1);
 reply={base_resp:{status_code:0},system_voice:[{voice_id:'one',voice_name:'一'}],voice_cloning:[{voice_id:'two'}],voice_generation:[{voice_id:'three'},{voice_id:'one'}]};
 const list=await voices.POST(req({provider:'minimax'}));assert.equal((await list.json()).voices.length,3);assert.equal(JSON.parse(calls.at(-1).body).voice_type,'all');
 for(const code of [1004,1008,1002]){reply={base_resp:{status_code:code}};assert.equal((await tts.POST(req({provider:'minimax',input:'测试',voice:'one'}))).status,502);}
 for(const audio of ['', 'abc', 'zz']){reply={base_resp:{status_code:0},data:{audio}};assert.equal((await tts.POST(req({provider:'minimax',input:'测试',voice:'one'}))).status,502);}
 for(const provider of ['openai','siliconflow','custom'])assert.equal((await tts.POST(req({provider,input:'测试',voice:'one'}))).status,400);
 for(const status of [301,302,307,308]){upstreamStatus=status;const before=calls.length;const result=await voices.POST(req({provider:"minimax"}));assert.equal(result.status,502);assert.match((await result.json()).error,/跳转/);assert.equal(calls.length,before+1);assert.equal(calls.at(-1).redirect,"manual");}upstreamStatus=200;
 const count=calls.length;user=false;assert.equal((await tts.POST(req({provider:'minimax',input:'测试',voice:'one'}))).status,401);assert.equal((await voices.POST(req({provider:'minimax'}))).status,401);assert.equal(calls.length,count);
 console.log('PASS: China endpoint, server-only credentials/model, MP3 decoding, all voice categories, provider errors, malformed audio and access protection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
