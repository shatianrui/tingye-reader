const assert=require('node:assert/strict'),{createHash,randomUUID}=require('node:crypto');
const clone=x=>JSON.parse(JSON.stringify(x));
function server(){
 const snapshots=new Map(),pending=new Map(),objects=new Map();let failUpload=false,corrupt=false,failCompleteOnce=false;
 const key=(u,id)=>u+'/'+id;
 const remote=user=>async(path,opt={})=>{
  assert.ok(path.startsWith('/api/backups'));const id=new URL(path,'https://test').searchParams.get('id');
  if(!opt.method){if(!id)return {protocol:2,account:{userId:user},books:[...snapshots.values()].filter(b=>b.user===user).map(clone)};const r=snapshots.get(key(user,id));if(!r)throw Error('missing');return {...clone(r),downloadUrl:'https://storage/'+r.revision};}
  if(opt.method==='DELETE'){snapshots.delete(key(user,id));return {ok:true};}
  const b=JSON.parse(opt.body);
  if(b.action==='start'){const current=snapshots.get(key(user,b.id));if(current&&current.revision!==b.expectedRevision)throw Error('conflict');const uploadId=randomUUID();pending.set(uploadId,{...b,user});return {uploadId,url:'https://storage/'+uploadId};}
  if(b.action==='cancel'){pending.delete(b.uploadId);return {ok:true};}
  if(b.action==='complete'){
   const done=[...snapshots.values()].find(s=>s.user===user&&s.revision===b.uploadId);if(done)return clone(done);
   const p=pending.get(b.uploadId);assert.equal(p.user,user);const payload=objects.get(b.uploadId);assert.equal(Buffer.byteLength(payload),p.bytes);assert.equal(createHash('sha256').update(payload).digest('hex'),p.sha256);
   const {book,progress}=JSON.parse(payload),current=snapshots.get(key(user,p.id));if(current&&current.revision!==p.expectedRevision)throw Error('conflict');
   const r={...book,chapters:[],...progress,revision:b.uploadId,bytes:p.bytes,sha256:p.sha256,backedUp:true,backupAt:Date.now(),user};snapshots.set(key(user,p.id),r);pending.delete(b.uploadId);
   if(failCompleteOnce){failCompleteOnce=false;throw Error('response lost after commit');}return clone(r);
  }throw Error('unsupported action');
 };
 const transfer=async(url,opt)=>{const id=url.split('/').pop();if(opt?.method==='PUT'){if(failUpload)throw Error('offline');objects.set(id,opt.body);return new Response('');}return new Response(corrupt?'corrupt':objects.get(id),{status:objects.has(id)?200:404});};
 return {remote,transfer,snapshots,reset:()=>snapshots.clear(),uploadFailure:v=>failUpload=v,corrupt:v=>corrupt=v,loseComplete:()=>failCompleteOnce=true};
}
function disk(){let rows=[];const files=new Map();return {load:async()=>clone(rows),save:async v=>rows=clone(v),read:async id=>files.has(id)?clone(files.get(id)):undefined,write:async b=>files.set(b.id,clone(b)),remove:async id=>files.delete(id)};}
async function run(load){
 const {createLibrary}=load('src/tingye/library.ts'),{sha256}=load('src/tingye/backup-sha256.ts');
 for(const text of ['', 'abc','你好，世界😀','a'.repeat(1000000)])assert.equal(sha256(text),createHash('sha256').update(text).digest('hex'));
 const cloud=server(),device=(owner='account-a')=>createLibrary(disk(),cloud.remote(owner),cloud.transfer);
 const a=device(),b=device(),c=device(),other=device('account-b');
 const book={id:randomUUID(),title:'原书图文',author:'测试',format:'EPUB',cover:'r0',resources:{r0:'data:image/png;base64,aGVsbG8='},chapters:[{title:'封面',text:'',document:{html:'<img src="tingye-resource:r0">',css:'',path:'cover.xhtml'}},{title:'正文',text:'第一句。第二句。第三句。',document:{html:'<p>第一句。第二句。第三句。</p>',css:'p{color:red}',path:'text.xhtml'}}]};
 await a.importBook(book);await a.progress(book,1,2,100);await a.flush();assert.equal(cloud.snapshots.size,0,'passive saves cannot publish incomplete books');
 cloud.loseComplete();const uploaded=await a.uploadAll();assert.equal(uploaded.cloudCount,1);assert.equal(uploaded.uploaded,1);assert.equal(cloud.snapshots.size,1,'lost response completion is idempotent');
 for(const target of [b,c]){const result=await target.synchronize();assert.equal(result.downloaded,1);assert.deepEqual(Array.from(result.errors),[]);const restored=await target.open(book.id);assert.equal(restored.chapter,1);assert.equal(restored.position,2);assert.equal(restored.resources.r0,book.resources.r0);assert.equal(restored.cover,'r0');assert.equal(restored.chapters[0].text,'');assert.ok(restored.chapters[1].document.html.includes('第三句'));}
 assert.equal((await other.synchronize()).downloaded,0);await assert.rejects(other.restore(book.id));
 await b.progress(book,1,0,200);await b.flush();assert.equal([...cloud.snapshots.values()][0].position,2,'reading does not silently overwrite cloud');await b.backup(book.id);
 await a.list(true);assert.equal((await a.open(book.id)).position,2,'catalog refresh is not restore');await assert.rejects(a.backup(book.id),/conflict/);
 await a.restore(book.id);assert.equal((await a.open(book.id)).position,0,'explicit restore wins even on existing local book');
 await a.progress(book,1,1,300);cloud.uploadFailure(true);await assert.rejects(a.backup(book.id));assert.equal([...cloud.snapshots.values()][0].position,0);cloud.uploadFailure(false);await a.backup(book.id);
 cloud.corrupt(true);await assert.rejects(c.restore(book.id),/校验/);assert.equal((await c.open(book.id)).position,2,'failed validation cannot modify local copy');cloud.corrupt(false);await c.restore(book.id);assert.equal((await c.open(book.id)).position,1);
 cloud.reset();await a.list(true);assert.equal((await a.list()).find(x=>x.id===book.id).backedUp,false);await a.flush();assert.equal(cloud.snapshots.size,0,'cleared cloud remains cleared until explicit upload');await a.backup(book.id);assert.equal(cloud.snapshots.size,1);
 await a.progress(book,1,2,400);await a.progress(book,1,0,350);assert.equal((await a.open(book.id)).position,2,'delayed old events cannot move reading backwards');
 await a.progress(book,1,0,9999999999999);await a.backup(book.id);await b.restore(book.id);await b.progress(book,1,1,Date.now());assert.equal((await b.open(book.id)).position,1,'restoring a different device clock cannot block local reading');
 console.log('PASS v2: full EPUB/images/cover/layout + progress across three devices; explicit upload/restore; account isolation; stale-device conflict; lost-response recovery; corrupt/interrupted transfer; existing-local replacement; cloud reset; delayed progress; SHA-256 vectors.');
}
module.exports={run,server,disk};
