import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base='http://localhost:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
const config=await fetch(base+'/api/tts',{headers:{Cookie:cookie}}).then(r=>r.json());
assert.equal(config.glm.configured,true,'GLM server environment was not loaded');
assert.ok(!JSON.stringify(config).includes('GLM_TTS_API_KEY'));
const selectedVoice=process.argv[2]||'tongtong';
const start=Date.now();
const response=await fetch(base+'/api/tts',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({provider:'glm',input:'你好，让我们一起听一本好书。',key:'ignored-client-key',model:'ignored-client-model',voice:selectedVoice})});
if(!response.ok){console.log(JSON.stringify({status:response.status,result:await response.json()}));process.exit(1)}
const bytes=Buffer.from(await response.arrayBuffer());
assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
let rate=0,channels=0,bits=0,data;
for(let at=12;at+8<=bytes.length;){const id=bytes.toString('ascii',at,at+4),size=bytes.readUInt32LE(at+4);if(id==='fmt '){channels=bytes.readUInt16LE(at+10);rate=bytes.readUInt32LE(at+12);bits=bytes.readUInt16LE(at+22);}if(id==='data')data=bytes.subarray(at+8,Math.min(bytes.length,at+8+size));at+=8+size+(size%2);}
assert.ok(rate>0&&bits===16&&data?.length>1000,'Expected decodable PCM16 audio');
let peak=0,sum=0;for(let i=0;i+1<data.length;i+=2){const sample=data.readInt16LE(i);peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}
assert.ok(peak>200,'Audio must not be silent');
await mkdir('.sites-runtime',{recursive:true});await writeFile('.sites-runtime/glm-test.wav',bytes);
console.log(JSON.stringify({passed:true,voice:selectedVoice,http:response.status,type:response.headers.get('content-type'),bytes:bytes.length,seconds:Number((data.length/(rate*channels*bits/8)).toFixed(2)),sampleRate:rate,peak,rms:Math.round(Math.sqrt(sum/(data.length/2))),elapsedMs:Date.now()-start,clientKeyAndModelIgnored:true}));
