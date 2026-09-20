const assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {createLibrary}=load('src/tingye/library.ts'),clone=v=>JSON.parse(JSON.stringify(v));
const book=i=>({id:'cloud'+i,title:'云端书 '+i,author:'测试',format:'EPUB',chapters:[{title:'正文',text:'第一句。第二句。'}]});
async function scenario(pending=false,failDownloads=false){
 let rows=Array.from({length:6},(_,i)=>({...book(i),chapters:[],local:i===0,backedUp:i!==0,deleted:i!==0,dirty:pending&&i===1,updatedAt:1}));
 const files=new Map([[book(0).id,book(0)]]),cloud=new Map(Array.from({length:6},(_,i)=>[book(i).id,{...book(i),chapters:[],backedUp:i!==0,updatedAt:2}]));
 let puts=0,gets=0;const updates=[];
 const storage={load:async()=>clone(rows),save:async v=>{rows=clone(v);},read:async id=>files.get(id),write:async b=>files.set(b.id,clone(b)),remove:async id=>files.delete(id)};
 const remote=async(path,options={})=>{
  const id=new URL(path,'https://test').searchParams.get('id'),body=options.body&&JSON.parse(options.body);
  if(options.method==='DELETE')throw Error('Deletion still pending');
  if(options.method==='PATCH')return{ok:true};
  if(options.method==='POST'){
   if(body.action==='backup-start')return{uploadId:body.id,url:'https://test/'+body.id};
   if(body.action==='backup-complete')cloud.get(body.uploadId).backedUp=true;
   return{ok:true};
  }
  return id?{...cloud.get(id),downloadUrl:'https://test/'+id}:{books:[...cloud.values()]};
 };
 const transfer=async(url,options)=>{if(options?.method==='PUT'){puts++;return{ok:true};}gets++;if(failDownloads)throw Error('Storage unreachable');const id=url.split('/').at(-1);return{ok:true,json:async()=>clone(book(Number(id.replace('cloud',''))))};};
 const library=createLibrary(storage,remote,transfer);
 const result=await library.synchronize(state=>updates.push({count:state.books.filter(b=>!b.sample).length,downloads:gets}));
 return{result,updates,puts,gets,rows};
}
(async()=>{
 const normal=await scenario();assert.equal(normal.result.books.filter(b=>!b.sample).length,6,'acknowledged old deletion flags must not permanently hide books restored to the cloud by iOS');assert.equal(normal.result.downloaded,5);assert.equal(normal.result.cloudCount,6);assert.equal(normal.result.restored,5);assert.equal(normal.puts,1);assert.equal(normal.result.errors.length,0);assert.ok(normal.updates.some(s=>s.count===6&&s.downloads===0),'publish cloud shelf before downloading large bodies');
 const failed=await scenario(false,true);assert.equal(failed.result.books.filter(b=>!b.sample).length,6);assert.equal(failed.result.downloaded,0);assert.equal(failed.result.errors.length,5,'download errors stay visible instead of losing the shelf');
 const pending=await scenario(true);assert.ok(!pending.result.books.some(b=>b.id==='cloud1'),'do not revive a deletion that has not synced successfully');assert.equal(pending.result.downloaded,4);assert.ok(pending.result.errors.length>0);
 console.log('PASS: six cloud records / one local file, clean tombstones reappear, pending deletion stays pending, cloud shelf visible before downloads.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
