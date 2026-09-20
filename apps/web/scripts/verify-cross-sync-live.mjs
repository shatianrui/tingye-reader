import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import postgres from 'postgres';
import certificates from '../db/supabase-ca.json' with {type:'json'};
const origin=process.argv[2];if(!origin||!['127.0.0.1','tingye-reader.vercel.app'].includes(new URL(origin).hostname))throw Error('Use the local test server or the production alias.');
const load=createRequire(new URL('../../ios/tests/load-ts.cjs',import.meta.url))('./load-ts.cjs');
const ios=load(fileURLToPath(new URL('../../ios/src/tingye/library.ts',import.meta.url)));
const android=load(fileURLToPath(new URL('../../android/src/tingye/library.ts',import.meta.url)));
const sql=postgres(process.env.DATABASE_URL||process.env.POSTGRES_URL,{ssl:{rejectUnauthorized:true,ca:certificates.ca},prepare:false,max:1});
const ids=[randomUUID(),randomUUID()],tokens=[randomBytes(32).toString('hex'),randomBytes(32).toString('hex'),randomBytes(32).toString('hex')];
const remote=token=>async(path,options={})=>{const r=await fetch(origin+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Tingye-Client':'native'},signal:AbortSignal.timeout(45000)});const data=await r.json();if(!r.ok)throw Error(`HTTP ${r.status}: ${data.error}`);return data;};
const transfer=(url,options)=>{assert.equal(new URL(url).hostname,new URL(process.env.SUPABASE_URL).hostname);return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});};
const disk=()=>{let rows=[];const files=new Map();return{load:async()=>structuredClone(rows),save:async v=>rows=structuredClone(v),read:async id=>files.get(id),write:async b=>files.set(b.id,structuredClone(b)),remove:async id=>files.delete(id)};};
const book={id:'',title:'跨端同步临时书籍',author:'验证',format:'EPUB',chapters:[{title:'第一章',text:'第一句。第二句。'},{title:'第二章',text:'新的章节。继续阅读。'}],resources:{r0:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="green"/></svg>').toString('base64')}};
const imagePages=process.argv.includes('--image-pages'),staleShelf=process.argv.includes('--stale-shelf'),verifyOwner=process.argv.includes('--verify-owner');
if(imagePages)book.chapters.unshift({title:'图片封面',text:'',document:{html:'<img src="tingye-resource:r0">',css:'',path:'cover.xhtml'}});
const bookIds=Array.from({length:5},()=>randomUUID());
try{
 for(const id of ids)await sql`insert into tingye.accounts(id,username,password_hash,recovery_hash) values(${id},${'sync_'+randomBytes(6).toString('hex')},'disabled','disabled')`;
 for(let i=0;i<tokens.length;i++)await sql`insert into tingye.sessions(digest,user_id,expires_at) values(${createHash('sha256').update(tokens[i]).digest('hex')},${i===2?ids[1]:ids[0]},now()+interval '15 minutes')`;
 const iosDisk=disk();
 if(staleShelf)await iosDisk.save(bookIds.map(id=>({...book,id,chapters:[],local:false,deleted:true,dirty:false,updatedAt:1})));
 const a=android.createLibrary(disk(),remote(tokens[0]),transfer),b=ios.createLibrary(iosDisk,remote(tokens[1]),transfer);
 for(const id of bookIds)await a.importBook({...book,id});
 assert.equal(await a.flush(),true);
 for(let i=0;i<4;i++){const expired=randomUUID();await sql`insert into tingye.uploads(id,user_id,book_id,object_path,expires_at) values(${expired},${ids[0]},${bookIds[0]},${ids[0]+'/'+bookIds[0]+'/'+expired+'.json'},now()-interval '1 minute')`;}
 await a.progress({...book,id:bookIds[0]},1,1);
 const upload=await a.synchronize();assert.deepEqual(Array.from(upload.errors),[]);assert.equal(upload.uploaded,5,'batch sync must not stop after three uploads');
 const updates=[];
 const download=await b.synchronize(s=>updates.push({books:s.books.filter(b=>!b.sample).length,downloaded:s.downloaded,phase:s.phase}));assert.deepEqual(Array.from(download.errors),[]);assert.equal(download.downloaded,5);
 if(staleShelf){assert.equal(download.restored,5);assert.equal(download.cloudCount,5);assert.equal(updates[0].books,5);assert.equal(updates[0].downloaded,0);}
 const opened=await b.open(bookIds[0]);assert.equal(opened.chapter,1);assert.equal(opened.position,1);assert.equal(opened.chapters[1].text,book.chapters[1].text);assert.equal(opened.resources.r0,book.resources.r0);
 await new Promise(r=>setTimeout(r,5));const returnChapter=imagePages?2:0,returnPosition=imagePages?0:1;await b.progress(opened,returnChapter,returnPosition);assert.equal(await b.flush(),true);await a.synchronize();const returned=await a.open(bookIds[0]);assert.equal(returned.chapter,returnChapter);assert.equal(returned.position,returnPosition);
 if(imagePages){assert.equal(opened.chapters.length,3);assert.equal(opened.chapters[0].text,'');assert.equal(opened.chapters[0].document.html,book.chapters[0].document.html);}
 const other=await remote(tokens[2])('/api/books');assert.equal(other.books.length,0);
 if(verifyOwner){const own=await remote(tokens[0])('/api/books?_sync='+Date.now());assert.equal(own.account.userId,ids[0]);assert.equal(other.account.userId,ids[1]);assert.ok(Number.isSafeInteger(own.snapshotAt));}
 // A failed upload's reservation can be canceled only by its owning account.
 const pending=await remote(tokens[0])('/api/books',{method:'POST',body:JSON.stringify({action:'backup-start',id:bookIds[0],bytes:1024})});
 await remote(tokens[2])('/api/books',{method:'POST',body:JSON.stringify({action:'backup-cancel',uploadId:pending.uploadId})});
 assert.equal(Number((await sql`select count(*) from tingye.uploads where id=${pending.uploadId} and user_id=${ids[0]}`)[0].count),1);
 await remote(tokens[0])('/api/books',{method:'POST',body:JSON.stringify({action:'backup-cancel',uploadId:pending.uploadId})});
 assert.equal(Number((await sql`select count(*) from tingye.uploads where user_id=${ids[0]} and expires_at>now()`)[0].count),0);
 const config=await remote(tokens[0])('/api/tts');assert.equal(config.limits.dailyCharacters,0);assert.equal(config.limits.requestsPerMinute,60);
 const report={endpoint:origin,androidSourceVersion:'1.6.4',iosSourceVersion:JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../ios/app.json',import.meta.url)),'utf8')).expo.version,restoredStaleShelfEntries:staleShelf?download.restored:undefined,shelfVisibleBeforeDownloads:staleShelf?updates[0].books===5&&updates[0].downloaded===0:undefined,uploaded:5,downloaded:5,originalResourcesPreserved:true,androidToIosProgress:true,iosToAndroidProgress:true,accountIsolation:true,cloudOwnerVerified:verifyOwner||undefined,cancelOwnershipVerified:true,expiredUploadReservationsIgnored:true,imageOnlyCoverPreserved:imagePages,chapterIndicesPreserved:true,ttsLimits:config.limits,note:'Actual client library modules + real HTTP/database/private storage; device filesystem/UI are mocked. Temporary accounts and objects cleaned in finally.'};
 fs.mkdirSync('.reports',{recursive:true});fs.writeFileSync('.reports/'+(origin.includes('127.0.0.1')?'local':'live')+(staleShelf?'-shelf176.json':imagePages?'-image-page-sync175.json':'-cross-sync175.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{
 try{
  for(const id of bookIds)try{await remote(tokens[0])('/api/books?id='+id,{method:'DELETE'});}catch{}
  await sql`delete from tingye.rate_limits where key in (${'uploads:'+ids[0]},${'uploads:'+ids[1]})`;
  await sql`delete from tingye.accounts where id in ${sql(ids)}`;
 }finally{await sql.end();}
}
