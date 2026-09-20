import fs from 'node:fs';
import {parseEnv} from 'node:util';
import postgres from 'postgres';
import certificates from '../db/supabase-ca.json' with {type:'json'};
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const env=parseEnv(fs.readFileSync('.env.local','utf8'));
const origin='https://tingye-reader.vercel.app';
const sql=postgres(env.DATABASE_URL||env.POSTGRES_URL,{ssl:{rejectUnauthorized:true,ca:certificates.ca},prepare:false,max:1});
const id=randomUUID(),token=randomBytes(32).toString('hex');
const input='今天是2026年9月18日。先读18页，再休息3分钟。';
try{
 await sql`insert into tingye.accounts(id,username,password_hash,recovery_hash) values(${id},${'timing_'+randomBytes(4).toString('hex')},'disabled','disabled')`;
 await sql`insert into tingye.sessions(digest,user_id,expires_at) values(${createHash('sha256').update(token).digest('hex')},${id},now()+interval '10 minutes')`;
 const r=await fetch(origin+'/api/tts',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({provider:'minimax',voice:'male-qn-qingse',input,timing:true}),signal:AbortSignal.timeout(90000)});
 assert.equal(r.status,200,`TTS HTTP ${r.status}`);assert.match(r.headers.get('content-type'),/application\/json/);
 const data=await r.json();assert.equal(data.encoding,'hex');assert.equal(data.format,'mp3');assert.ok(data.audio.length>1000);assert.ok(data.words.length>5);
 assert.equal(data.words.map(w=>w.text).join(''),input);
 assert.equal(data.words.filter(w=>w.text==='2026年9月18日').length,1);
 let last=0;for(const w of data.words){assert.ok(w.startTime>=last&&w.endTime>w.startTime);last=w.startTime;}
 const report={endpoint:origin+'/api/tts',version:'1.7.2',timedResponse:true,audioBytes:data.audio.length/2,wordCount:data.words.length,numberDateOriginalTextMatches:true,temporaryTestAccountRemovedOnExit:true};
 fs.writeFileSync('ios172-live-api-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 await sql`delete from tingye.rate_limits where key in (${'tts:'+id},${'tts-minute:'+id})`;
 await sql`delete from tingye.accounts where id=${id}`;await sql.end();
}
