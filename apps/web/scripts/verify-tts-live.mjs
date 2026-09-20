import postgres from 'postgres';
import certificates from '../db/supabase-ca.json' with {type:'json'};
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const origin=process.argv[2];if(!origin)throw Error('Provide deployment URL');
const sql=postgres(process.env.DATABASE_URL||process.env.POSTGRES_URL,{ssl:{rejectUnauthorized:true,ca:certificates.ca},prepare:false,max:1});
const id=randomUUID(),token=randomBytes(32).toString('hex'),key='tts:'+id,minute='tts-minute:'+id;
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const input='你好，欢迎使用听页。';
const post=(provider,voice)=>fetch(origin+'/api/tts',{method:'POST',headers,body:JSON.stringify({provider,voice,input})});
try{
  await sql`insert into tingye.accounts(id,username,password_hash,recovery_hash) values(${id},${'tts_'+randomBytes(4).toString('hex')},'disabled','disabled')`;
  await sql`insert into tingye.sessions(digest,user_id,expires_at) values(${createHash('sha256').update(token).digest('hex')},${id},now()+interval '10 minutes')`;
  const limit=Number(process.env.TTS_DAILY_CHARACTERS||50000);
  if(limit>0){
    await sql`insert into tingye.rate_limits(key,count,expires_at) values(${key},${limit},now()+interval '1 hour')`;
    for(let i=0;i<2;i++){
      const r=await post('glm','tongtong');const body=await r.json();
      assert.equal(r.status,429,JSON.stringify(body));assert.equal(body.code,'TTS_DAILY_LIMIT');
      assert.ok(Number(r.headers.get('Retry-After'))>0);
    }
    assert.equal((await sql`select count from tingye.rate_limits where key=${key}`)[0].count,limit);
    await sql`delete from tingye.rate_limits where key=${key}`;
    console.log('PASS: live daily cap has reset time; denied retries do not add characters.');
  }
  await sql`delete from tingye.rate_limits where key=${minute}`;
  await sql`insert into tingye.rate_limits(key,count,expires_at) values(${minute},60,now()+interval '1 minute')`;
  const fast=await post('glm','tongtong');assert.equal(fast.status,429);assert.equal((await fast.json()).code,'TTS_RATE_LIMIT');
  await sql`delete from tingye.rate_limits where key=${minute}`;
  const bad=await post('minimax','');assert.equal(bad.status,400);
  assert.equal((await sql`select count from tingye.rate_limits where key=${key}`).length,0);
  console.log('PASS: separate frequency error; invalid request does not charge quota.');
  if(limit===0)await sql`insert into tingye.rate_limits(key,count,expires_at) values(${key},1000000,now()+interval '1 hour')`;
  for(const [provider,voice] of [['glm','tongtong'],['minimax','male-qn-qingse']]){
    const r=await post(provider,voice);assert.equal(r.status,200,r.ok?'':await r.text());
    assert.match(r.headers.get('content-type'),/^audio\//);
    const data=Buffer.from(await r.arrayBuffer());assert.ok(data.length>1000);
    if(provider==='glm')assert.equal(data.toString('ascii',0,4),'RIFF');
    console.log('PASS:',provider,'audio',data.length,'bytes');
  }
  if(limit>0)assert.equal((await sql`select count from tingye.rate_limits where key=${key}`)[0].count,input.length*2);
  else {
    assert.equal((await sql`select count from tingye.rate_limits where key=${key}`)[0].count,1000000);
    console.log('PASS: unlimited mode ignores pre-existing over-limit usage and does not charge a daily counter.');
  }
}finally{
  await sql`delete from tingye.rate_limits where key in (${key},${minute})`;
  await sql`delete from tingye.accounts where id=${id}`;await sql.end();
}
