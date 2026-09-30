import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createLibrary} from '../../lib/local-library';
import type {Book} from '../../lib/books';
const {server}=createRequire(import.meta.url)('../../../../packages/backup-core/test.cjs');
const book={id:'12345678-1234-1234-1234-123456789abc',title:'测试',author:'作者',format:'EPUB',cover:'r0',resources:{r0:'data:image/png;base64,aGVsbG8='},chapters:[{title:'封面',text:'',document:{html:'<img src="tingye-resource:r0">',css:'',path:'cover.xhtml'}},{title:'正文',text:'第一句。第二句。'}]};
test('web v2 backup preserves original resources and progress, restores existing copies, stays isolated and offline',async()=>{
 const previous=globalThis.fetch,cloud=server();let online=false,owner='one';
 globalThis.fetch=async(url,options)=>{if(!online)throw Error('offline');return String(url).startsWith('https://storage/')?cloud.transfer(String(url),options):Response.json(await cloud.remote(owner)(String(url),options));};
 try{
  const first=createLibrary('one');await first.request('/api/books',{method:'POST',body:JSON.stringify(book)});await first.request('/api/books',{method:'PATCH',body:JSON.stringify({id:book.id,chapter:1,position:1})});await first.flush();
  const restarted=createLibrary('one');assert.equal((await restarted.request<{position:number}>('/api/books?id='+book.id)).position,1);
  online=true;await restarted.backup(book.id);assert.equal(cloud.snapshots.size,1);await restarted.request('/api/books',{method:'PATCH',body:JSON.stringify({id:book.id,chapter:1,position:0})});
  const restored=await restarted.restore(book.id) as typeof book&{position:number};assert.equal(restored.position,1);assert.deepEqual(restored.resources,book.resources);assert.deepEqual(restored.chapters,book.chapters);
  owner='two';const other=createLibrary('two');assert.equal((await other.restoreAll()).downloaded,0);await assert.rejects(other.restore(book.id));
  owner='one';cloud.corrupt(true);await assert.rejects(restarted.restore(book.id),/校验/);cloud.corrupt(false);
  online=false;assert.equal((await restarted.request<{position:number}>('/api/books?id='+book.id)).position,1);await assert.rejects(restarted.backup(book.id));
 }finally{globalThis.fetch=previous;}
});

test('independent tabs retain simultaneous imports and reject stale progress writes',async()=>{
 const previous=globalThis.fetch,cloud=server(),owner='parallel-tabs';
 globalThis.fetch=async(url,options)=>Response.json(await cloud.remote(owner)(String(url),options));
 try{
  const first=createLibrary(owner),second=createLibrary(owner);
  await Promise.all([first.request('/api/books'),second.request('/api/books')]);
  const other={...book,id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'Second book'};
  await Promise.all([book,other].map((value,index)=>[first,second][index].request('/api/books',{method:'POST',body:JSON.stringify(value)})));
  const fresh=createLibrary(owner);
  assert.deepEqual(new Set((await fresh.request<{books:Book[]}>('/api/books')).books.map(b=>b.id)),new Set([book.id,other.id]));
  const progress=(library:ReturnType<typeof createLibrary>,position:number,updatedAt:number)=>library.request('/api/books',{method:'PATCH',body:JSON.stringify({id:book.id,chapter:1,position,updatedAt})});
  await progress(first,1,200);
  await second.request('/api/books');
  await progress(second,0,100);
  assert.equal((await fresh.request<Book>('/api/books?id='+book.id)).position,1);
  await progress(second,0,300);
  assert.equal((await first.request<Book>('/api/books?id='+book.id)).position,0);
  await progress(second,0,500);
  await progress(first,1,400);
  assert.equal((await fresh.request<Book>('/api/books?id='+book.id)).position,0);
 }finally{globalThis.fetch=previous;}
});

test('batch uploads reuse one catalog while preserving server conflict checks',async()=>{
 const previous=globalThis.fetch,cloud=server(),owner='batch-upload';let catalogs=0;
 globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('https://storage/'))return cloud.transfer(String(url),options);
  if(String(url)==='/api/backups'&&!options?.method)catalogs++;
  return Response.json(await cloud.remote(owner)(String(url),options));
 };
 try{
  const library=createLibrary(owner);
  for(let i=0;i<4;i++)await library.request('/api/books',{method:'POST',body:JSON.stringify({...book,id:`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`})});
  const result=await library.uploadAll();
  assert.equal(result.uploaded,4);assert.equal(result.errors.length,0);assert.equal(catalogs,1);
 }finally{globalThis.fetch=previous;}
});
