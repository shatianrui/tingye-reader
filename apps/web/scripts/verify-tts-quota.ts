import postgres from 'postgres';
import certificates from '../db/supabase-ca.json' with {type:'json'};
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {reserveTtsBudget,TtsQuotaError} from '../lib/tts-quota';
const sql=postgres(process.env.DATABASE_URL||process.env.POSTGRES_URL!,{ssl:{rejectUnauthorized:true,ca:certificates.ca},prepare:false,max:3});
const key='tts-test:'+randomUUID();
try{
  const attempts=await Promise.allSettled(Array.from({length:8},()=>reserveTtsBudget(sql,key,1000,60,400,'daily')));
  const accepted=attempts.filter(x=>x.status==='fulfilled');
  assert.equal(accepted.length,2);
  assert.equal((await sql`select count from tingye.rate_limits where key=${key}`)[0].count,800);
  assert.ok(attempts.filter(x=>x.status==='rejected').every(x=>x.reason instanceof TtsQuotaError));
  await accepted[0].value();await accepted[0].value();
  assert.equal((await sql`select count from tingye.rate_limits where key=${key}`)[0].count,400);
  await sql`update tingye.rate_limits set expires_at=now()-interval '1 second' where key=${key}`;
  await reserveTtsBudget(sql,key,1000,60,200,'daily');
  await accepted[1].value();
  assert.equal((await sql`select count from tingye.rate_limits where key=${key}`)[0].count,200);
  console.log('PASS: parallel reservations respect cap; rejected attempts do not count; failed synthesis refunds once; late refund cannot alter next window.');
}finally{await sql`delete from tingye.rate_limits where key=${key}`;await sql.end();}
