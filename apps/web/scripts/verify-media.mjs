import certificates from '../db/supabase-ca.json' with {type:'json'};
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
const origin=process.argv[2];if(!origin)throw Error('Provide the new deployment URL');
const sql=postgres(process.env.POSTGRES_URL,{ssl:{rejectUnauthorized:true,ca:certificates.ca},prepare:false,max:1});
const bucket=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY).storage.from('tingye-books');
const id=randomUUID(),token=randomBytes(32).toString('hex');
const book={id:randomUUID(),title:'备份恢复测试',author:'测试',format:'TXT',chapters:[{title:'第一章',text:'这是一次听页迁移测试。'}]};
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function call(body){const r=await fetch(origin+'/api/books',{method:'POST',headers,body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
try{
 await sql`insert into tingye.accounts(id,username,password_hash,recovery_hash) values(${id},${'media_'+randomBytes(4).toString('hex')},'disabled','disabled')`;
 await sql`insert into tingye.sessions(digest,user_id,expires_at) values(${createHash('sha256').update(token).digest('hex')},${id},now()+interval '10 minutes')`;
 await call({...book,chapters:undefined});
 const signed=await call({action:'backup-start',id:book.id});
 const upload=await fetch(signed.url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(book)});assert.equal(upload.status,200,await upload.text());
 await call({action:'backup-complete',uploadId:signed.uploadId});
 const download=await fetch(origin+'/api/books?id='+book.id,{headers});const meta=await download.json();assert.equal(download.status,200);
 const restored=await fetch(meta.downloadUrl);assert.deepEqual(await restored.json(),book);
 console.log('PASS: private signed upload, backup completion, signed download and exact book restoration.');
 const voices=await fetch(origin+'/api/tts/voices',{method:'POST',headers,body:JSON.stringify({provider:'minimax'})});const voiceData=await voices.json();assert.equal(voices.status,200,JSON.stringify(voiceData));assert.ok(voiceData.voices.length>1);console.log('MiniMax voices:',voiceData.voices.length);
 for(const provider of ['glm','minimax']){
  const r=await fetch(origin+'/api/tts',{method:'POST',headers,body:JSON.stringify({provider,input:'你好，欢迎使用听页。',voice:provider==='glm'?'tongtong':'male-qn-qingse'})});
  assert.equal(r.status,200,r.status===200?'':await r.text());assert.match(r.headers.get('content-type'),/^audio\//);const bytes=(await r.arrayBuffer()).byteLength;assert.ok(bytes>1000);console.log(provider,'audio verified:',bytes,'bytes');
 }
}finally{
 const rows=await sql`select object_path from tingye.books where user_id=${id} and object_path is not null union select object_path from tingye.uploads where user_id=${id}`;
 if(rows.length){const removed=await bucket.remove(rows.map(x=>x.object_path));if(removed.error)console.error('Test upload cleanup needs retry');}
 await sql`delete from tingye.accounts where id=${id}`;await sql.end();
}
