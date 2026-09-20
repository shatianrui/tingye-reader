import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
import certificates from '../db/supabase-ca.json' with {type:'json'};
Object.assign(process.env,parseEnv(fs.readFileSync('.env.local','utf8')));
const origin=process.argv[2];if(!origin||!['127.0.0.1','tingye-reader.vercel.app'].includes(new URL(origin).hostname))throw Error('Supply the local test server or production alias.');
const sql=postgres(process.env.DATABASE_URL||process.env.POSTGRES_URL,{ssl:{rejectUnauthorized:true,ca:certificates.ca},max:1,prepare:false});
const files=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY).storage.from('tingye-books');
const load=createRequire(new URL('../../ios/tests/load-ts.cjs',import.meta.url))('./load-ts.cjs');
const android=load(fileURLToPath(new URL('../../android/src/tingye/library.ts',import.meta.url)));
const ios=load(fileURLToPath(new URL('../../ios/src/tingye/library.ts',import.meta.url)));
const ids=[randomUUID(),randomUUID()],tokens=ids.map(()=>randomBytes(32).toString('hex'));
const remote=token=>async(path,options={})=>{const r=await fetch(origin+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Tingye-Client':'native'},signal:AbortSignal.timeout(120000)});const body=await r.json();if(!r.ok)throw Error(`HTTP ${r.status}: ${body.error}`);return body;};
const transfer=(url,options)=>{assert.equal(new URL(url).hostname,new URL(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL).hostname);return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});};
const disk=()=>{let rows=[];const bodies=new Map();return {load:async()=>structuredClone(rows),save:async r=>rows=structuredClone(r),read:async id=>bodies.get(id),write:async b=>bodies.set(b.id,structuredClone(b)),remove:async id=>bodies.delete(id)};};
const fixture={id:randomUUID(),title:'临时跨设备完整备份测试',author:'测试',format:'EPUB',cover:'r0',resources:{r0:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>').toString('base64')},chapters:[{title:'封面',text:'',document:{html:'<img src="tingye-resource:r0">',css:'',path:'cover.xhtml'}},{title:'正文',text:'第一句。第二句。第三句。',document:{html:'<p>第一句。第二句。第三句。</p>',css:'',path:'text.xhtml'}}]};
try{
 for(let i=0;i<ids.length;i++){await sql`insert into tingye.accounts(id,username,password_hash,recovery_hash) values(${ids[i]},${'backup_test_'+randomBytes(5).toString('hex')},'disabled','disabled')`;await sql`insert into tingye.sessions(digest,user_id,expires_at) values(${createHash('sha256').update(tokens[i]).digest('hex')},${ids[i]},now()+interval '30 minutes')`;}
 const a=android.createLibrary(disk(),remote(tokens[0]),transfer),b=ios.createLibrary(disk(),remote(tokens[0]),transfer),c=android.createLibrary(disk(),remote(tokens[0]),transfer),other=ios.createLibrary(disk(),remote(tokens[1]),transfer);
 await a.importBook(fixture);await a.progress(fixture,1,2,100);await a.backup(fixture.id);
 for(const device of [b,c]){const result=await device.synchronize();assert.deepEqual(Array.from(result.errors),[]);assert.equal(result.downloaded,1);const book=await device.open(fixture.id);assert.equal(book.position,2);assert.equal(book.chapter,1);assert.equal(book.cover,'r0');assert.equal(book.resources.r0,fixture.resources.r0);assert.equal(book.chapters.length,2);assert.ok(book.chapters[0].document.html.includes('img'));}
 await b.progress(fixture,1,0,200);await b.backup(fixture.id);
 await assert.rejects(a.backup(fixture.id),/409/);await a.restore(fixture.id);assert.equal((await a.open(fixture.id)).position,0);
 await a.progress(fixture,1,1,300);await a.backup(fixture.id);await b.restore(fixture.id);assert.equal((await b.open(fixture.id)).position,1);
 assert.equal((await other.synchronize()).downloaded,0);await assert.rejects(other.restore(fixture.id),/404/);
 const current=(await remote(tokens[0])('/api/backups')).books[0];
 // An interrupted new upload does not replace the last complete snapshot.
 const abandoned=await remote(tokens[0])('/api/backups',{method:'POST',body:JSON.stringify({action:'start',id:fixture.id,bytes:10,sha256:'0'.repeat(64),expectedRevision:current.revision})});
 assert.equal((await remote(tokens[0])('/api/backups')).books[0].revision,current.revision);
 await assert.rejects(remote(tokens[1])('/api/backups',{method:'POST',body:JSON.stringify({action:'complete',uploadId:abandoned.uploadId})}),/400/);
 await remote(tokens[0])('/api/backups',{method:'POST',body:JSON.stringify({action:'cancel',uploadId:abandoned.uploadId})});
 const legacy=await fetch(origin+'/api/books',{method:'POST',headers:{Authorization:'Bearer '+tokens[0],'Content-Type':'application/json'},body:'{}'});assert.equal(legacy.status,426);
 const report={origin,protocol:2,actualAndroidAndIosModules:true,realDatabaseAndPrivateStorage:true,threeDevicesRestore:true,imagesCoverAndOriginalLayout:true,readingProgressBothDirections:true,restoreExistingLocalBook:true,staleUploadRejected:true,interruptedUploadKeepsPrevious:true,accountIsolation:true,legacyWritesDisabled:true,deviceFilesystemAndUI:'mocked',testedAt:new Date().toISOString()};
 fs.mkdirSync('.reports',{recursive:true});fs.writeFileSync('.reports/backup-v2-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{
 for(const uid of ids){const objects=await sql`select name from storage.objects where bucket_id='tingye-books' and name like ${uid+'/%'}`;if(objects.length){const result=await files.remove(objects.map(r=>r.name));if(result.error)throw result.error;}await sql`delete from tingye.accounts where id=${uid}`;await sql`delete from tingye.rate_limits where key=${'backup-v2:'+uid}`;}
 await sql.end();
}
