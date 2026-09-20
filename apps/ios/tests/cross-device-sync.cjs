const assert=require('node:assert/strict'),path=require('node:path'),load=require('./load-ts.cjs');
const androidRoot=process.env.TINGYE_ANDROID_ROOT||path.resolve(__dirname,'../../android');
const ios=load('src/tingye/library.ts'),android=load(path.join(androidRoot,'src/tingye/library.ts'));
const clone=x=>JSON.parse(JSON.stringify(x));
function disk(){let rows=[];const files=new Map();return{load:async()=>clone(rows),save:async v=>rows=clone(v),read:async id=>files.get(id),write:async b=>files.set(b.id,clone(b)),remove:async id=>files.delete(id)};}
(async()=>{
 let online=true,failPut=false,cancelled=0,sequence=0;const cloud=new Map(),files=new Map(),uploads=new Map();
 const remote=async(path,opt={})=>{
  if(!online)throw Error('offline');const b=opt.body?JSON.parse(opt.body):undefined,id=new URL(path,'https://test').searchParams.get('id');
  if(opt.method==='POST'){
   if(b.action==='backup-start'){assert.ok(b.bytes>0);const key='upload'+(++sequence);uploads.set(key,b.id);return{uploadId:key,url:'https://test/'+key};}
   if(b.action==='backup-complete'){const bookId=uploads.get(b.uploadId);cloud.get(bookId).backedUp=true;uploads.delete(b.uploadId);return{ok:true};}
   if(b.action==='backup-cancel'){uploads.delete(b.uploadId);cancelled++;return{ok:true};}
   cloud.set(b.id,{...cloud.get(b.id),...b});return{ok:true};
  }
  if(opt.method==='PATCH'){const old=cloud.get(b.id);if(!old.updatedAt||b.updatedAt>old.updatedAt)Object.assign(old,b);return{ok:true};}
  if(opt.method==='DELETE'){cloud.delete(id);files.delete(id);return{ok:true};}
  return id?{...cloud.get(id),downloadUrl:files.has(id)?'https://test/book/'+id:undefined}:{books:[...cloud.values()].map(b=>({...b,chapters:[]}))};
 };
 const transfer=async(url,opt)=>{if(opt?.method==='PUT'){if(failPut)return{ok:false};files.set(uploads.get(url.split('/').pop()),JSON.parse(opt.body));return{ok:true};}return{ok:true,json:async()=>clone(files.get(url.split('/').pop()))};};
 const a=android.createLibrary(disk(),remote,transfer),b=ios.createLibrary(disk(),remote,transfer);
 const book={id:'cross',title:'跨端原书',author:'测试',format:'EPUB',chapters:[{title:'一',text:'第一句。第二句。'},{title:'二',text:'继续读。继续翻页。'}]};
 for(let i=0;i<5;i++)await a.importBook({...book,id:'cross'+i});
 await a.progress({...book,id:'cross0'},1,1);const sent=await a.synchronize();assert.equal(sent.uploaded,5);assert.equal(sent.errors.length,0);assert.equal(uploads.size,0);
 const received=await b.synchronize();assert.equal(received.downloaded,5);assert.equal(received.errors.length,0);assert.equal(received.missing.length,0);
 const opened=await b.open('cross0');assert.equal(opened.chapter,1);assert.equal(opened.position,1);assert.equal(opened.chapters[1].text,book.chapters[1].text);assert.equal(received.books.find(x=>x.id==='cross0').chapterCount,2);
 const timestamp=cloud.get('cross0').updatedAt;await b.progress(opened,1,1);await b.flush();assert.equal(cloud.get('cross0').updatedAt,timestamp,'merely opening a book cannot stamp stale progress as new');
 await new Promise(r=>setTimeout(r,5));await b.progress(opened,1,0);await b.flush();await a.synchronize();assert.equal((await a.open('cross0')).position,0,'iOS newer progress returns to Android');
 await a.importBook({...book,id:'cross0',chapters:[{title:'修复',text:'替换后的正文。'}]});await a.synchronize();assert.equal(files.get('cross0').chapters[0].text,'替换后的正文。','old cloud backedUp flag cannot suppress uploading a new body');
 cloud.set('only-meta',{id:'only-meta',title:'旧安卓尚未上传',chapter:0,position:0,updatedAt:1,backedUp:false});assert.ok((await b.synchronize()).missing.includes('旧安卓尚未上传'));
 online=false;await assert.rejects(b.synchronize(),/offline/);assert.ok((await b.open('cross1')).chapters.length,'offline failure never destroys local books');online=true;
 await a.importBook({...book,id:'failed'});failPut=true;const failed=await a.synchronize();assert.ok(failed.errors.some(e=>e.includes('正文上传失败')));assert.equal(cancelled,1);assert.equal(uploads.size,0);failPut=false;assert.equal((await a.synchronize()).uploaded,1);
 const isolated=ios.createLibrary(disk(),async()=>({books:[]}),transfer);assert.equal((await isolated.synchronize()).books.filter(x=>!x.sample).length,0);
 console.log('PASS: actual Android/iOS library modules: five-book explicit body sync, automatic download, bidirectional progress, no-op save, replaced body, missing-body notice, offline/error visibility, failed-upload cleanup and account isolation.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
