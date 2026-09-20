const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const load=require('./load-ts.cjs');
const {bookCover}=load('src/tingye/book-cover.ts');
const {createLibrary,validateBook}=load('src/tingye/library.ts');
const bytes=Buffer.from([137,80,78,71,13,10,26,10]),files=new Map();
class File{
 constructor(dir,name){this.uri=dir.uri+'/'+name;}
 get exists(){return files.has(this.uri);}
 write(data,options){assert.equal(options.encoding,'base64');files.set(this.uri,Buffer.from(data,'base64'));}
 delete(){files.delete(this.uri);}
}
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/tingye/cover-cache.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:id=>id==='expo-file-system'?{File}:load('src/tingye/'+id.slice(2)+'.ts')});
const old={id:'legacy',title:'旧书',author:'作者',format:'EPUB',chapters:[{title:'封面',text:'',document:{html:'<svg><image xlink:href="tingye-resource:r1"/></svg>',css:'',path:'OPS/cover.xhtml'}},{title:'正文',text:'正文。'}],resources:{r0:'data:font/ttf;base64,YQ==',r1:'data:image/png;base64,'+bytes.toString('base64')}};
(async()=>{
 assert.equal(bookCover(old),'r1');assert.equal(bookCover({...old,cover:'r0'}),'r1');assert.equal(validateBook(old).cover,'r1');
 const noCover={...old,id:'text',resources:{},chapters:[{title:'正文',text:'纯文字。'}]};
 assert.equal(bookCover(noCover),undefined);
 assert.equal(bookCover({...old,chapters:[{title:'文',text:'',document:{html:'<img src="https://x/cover.png">'}}]}),undefined);
 let reads=0;
 const cache=mod.exports.createCoverCache({uri:'file:///books/account-a'},async id=>{reads++;if(id==='broken')throw Error('damaged');return id==='legacy'?old:noCover;});
 const rows=[{...old,resources:undefined,chapters:[],chapter:1,position:17},{...noCover,chapters:[]},{id:'broken',chapters:[]}];
 await cache.migrate(rows);assert.equal(rows[0].cover,'r1');assert.equal(rows[0].position,17);assert.equal(rows[0].chapter,1);assert.equal(rows[0].coverUri,'file:///books/account-a/legacy.cover.png');assert.deepEqual(files.get(rows[0].coverUri),bytes);assert.equal(rows[1].coverUri,undefined);assert.equal(rows[1].coverChecked,true);
 const firstReads=reads;await cache.migrate(rows.slice(0,2));assert.equal(reads,firstReads,'Do not reopen large book JSON files after migration');
 files.delete(rows[0].coverUri);await cache.migrate(rows.slice(0,1));assert.ok(files.has(rows[0].coverUri),'Recover deleted cache files');
 const other=mod.exports.createCoverCache({uri:'file:///books/account-b'},async()=>old);assert.notEqual(await other.prepare(old),rows[0].coverUri);
 cache.remove(old.id);assert.ok(!files.has(rows[0].coverUri));assert.ok(files.has('file:///books/account-b/legacy.cover.png'));
 let catalog=[];const bodies=new Map();const storage={load:async()=>catalog,save:async rows=>{catalog=rows;},read:async id=>bodies.get(id),write:async b=>{bodies.set(b.id,b);},remove:async id=>{bodies.delete(id);cache.remove(id);},cover:cache.prepare};
 const offline=async()=>{throw Error('offline');};const library=createLibrary(storage,offline,offline);await library.importBook(old);
 const entry=(await library.list()).find(b=>b.id===old.id);assert.ok(entry.coverUri);assert.equal(entry.resources,undefined);assert.ok(JSON.stringify(entry).length<600,'Catalog should not contain cover base64 or chapter markup');
 await library.progress(old,1,12);assert.equal((await library.list()).find(b=>b.id===old.id).coverUri,entry.coverUri);
 const clean=validateBook({...await library.open(old.id),coverUri:'file:///must-not-upload'});assert.equal(clean.cover,'r1');assert.equal(clean.coverUri,undefined);assert.equal(JSON.stringify(clean.resources),JSON.stringify(old.resources));
 const failed=createLibrary({...storage,cover:async()=>undefined},offline,offline);await failed.importBook(old);assert.equal((await failed.list()).find(b=>b.id===old.id).coverChecked,false,'Failed extraction must be retried');
 console.log('PASS: old-book cover migration, offline file bytes, missing-cache recovery, no-art/corrupt-book fallback, account isolation, deletion, small catalog, progress preservation and portable backup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
