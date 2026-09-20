import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import postgres from 'postgres';
import certificates from '../db/supabase-ca.json' with {type:'json'};
const [fixtureFile,outputDir]=process.argv.slice(2);
if(!fixtureFile||!outputDir)throw Error('Provide fixture JSON and a new evidence output directory.');
const fixture=JSON.parse(fs.readFileSync(fixtureFile,'utf8'));
const origin='https://tingye-reader.vercel.app';
const sql=postgres(process.env.DATABASE_URL||process.env.POSTGRES_URL,{ssl:{rejectUnauthorized:true,ca:certificates.ca},prepare:false,max:1});
const id=randomUUID(),token=randomBytes(32).toString('hex');
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json','X-Tingye-Client':'native'};
const report={endpoint:origin+'/api/tts',provider:'glm',voice:'tongtong',capturedAt:new Date().toISOString(),tracks:[]};
fs.mkdirSync(outputDir,{recursive:true});
try{
 await sql`insert into tingye.accounts(id,username,password_hash,recovery_hash) values(${id},${'evidence_'+randomBytes(4).toString('hex')},'disabled','disabled')`;
 await sql`insert into tingye.sessions(digest,user_id,expires_at) values(${createHash('sha256').update(token).digest('hex')},${id},now()+interval '10 minutes')`;
 for(const [index,input] of fixture.paragraphs.entries()){
  assert.ok(typeof input==='string'&&input.length>0&&input.length<=400);
  const started=performance.now();
  const r=await fetch(origin+'/api/tts',{method:'POST',headers,body:JSON.stringify({provider:'glm',voice:'tongtong',input,timing:true}),signal:AbortSignal.timeout(65000)});
  assert.equal(r.status,200,'GLM HTTP '+r.status);assert.match(r.headers.get('content-type'),/audio\/wav/);
  const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.ok(bytes.length>1000);
  const file=`glm-${index+1}.wav`;fs.writeFileSync(path.join(outputDir,file),bytes);
  report.tracks.push({file,input,bytes:bytes.length,requestMilliseconds:Math.round(performance.now()-started),sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 fs.writeFileSync(path.join(outputDir,'capture.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{
 try{await sql`delete from tingye.rate_limits where key in (${'tts:'+id},${'tts-minute:'+id})`;await sql`delete from tingye.accounts where id=${id}`;}finally{await sql.end();}
}
