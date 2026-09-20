import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createLibrary} from '../../lib/local-library';
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
