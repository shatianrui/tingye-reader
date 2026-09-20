// Run via: node scripts/with-local-env.mjs scripts/verify-speech-config.mjs
// Uses an isolated short-lived account; never touches a real user's data.
import postgres from 'postgres';
import certificates from '../db/supabase-ca.json' with {type:'json'};
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const origin='https://tingye-reader.vercel.app';
const sql=postgres(process.env.DATABASE_URL||process.env.POSTGRES_URL,{ssl:{rejectUnauthorized:true,ca:certificates.ca},prepare:false,max:1});
const id=randomUUID(),token=randomBytes(32).toString('hex');
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json','X-Tingye-Client':'native'};
const input='你好，欢迎使用听页。';
try {
  await sql`insert into tingye.accounts(id,username,password_hash,recovery_hash) values(${id},${'config_'+randomBytes(4).toString('hex')},'disabled','disabled')`;
  await sql`insert into tingye.sessions(digest,user_id,expires_at) values(${createHash('sha256').update(token).digest('hex')},${id},now()+interval '10 minutes')`;
  const response=await fetch(origin+'/api/tts',{headers,signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200);
  const config=await response.json();
  const results={};
  for(const [provider,voice] of [['glm','tongtong'],['minimax','male-qn-qingse']]) {
    assert.equal(config[provider].configured,true,provider+' missing server configuration');
    const r=await fetch(origin+'/api/tts',{method:'POST',headers,body:JSON.stringify({provider,voice,input,timing:true}),signal:AbortSignal.timeout(90000)});
    assert.equal(r.status,200,provider+' synthesis HTTP '+r.status);
    let audio,words=[];
    if(r.headers.get('content-type')?.includes('application/json')) {
      const body=await r.json();
      assert.equal(body.encoding,'hex');
      assert.match(body.audio,/^[0-9a-f]+$/i);
      audio=Buffer.from(body.audio,'hex');words=body.words;
      assert.ok(Array.isArray(words)&&words.length>0,'MiniMax word timestamps missing');
      let previous=-1;
      for(const w of words) { assert.ok(Number.isFinite(w.startTime)&&w.startTime>=previous&&w.endTime>w.startTime);previous=w.startTime; }
    } else {
      assert.match(r.headers.get('content-type'),/^audio\//);
      audio=Buffer.from(await r.arrayBuffer());
    }
    assert.ok(audio.length>1000);
    if(provider==='glm'){assert.equal(audio.toString('ascii',0,4),'RIFF');assert.equal(audio.readUInt32LE(4),audio.length-8,'GLM RIFF length must describe the entire audio');}
    results[provider]={configured:true,model:config[provider].model,audioBytes:audio.length,wordCount:words.length,...(provider==='glm'?{riffLengthValid:true}:{})};
  }
  console.log(JSON.stringify({endpoint:origin+'/api/tts',...results,note:'GLM audio-only response uses on-device alignment or labelled sentence estimates in App.'},null,2));
} finally {
  try {
    await sql`delete from tingye.rate_limits where key in (${'tts:'+id},${'tts-minute:'+id})`;
    await sql`delete from tingye.accounts where id=${id}`;
  } finally { await sql.end(); }
}
