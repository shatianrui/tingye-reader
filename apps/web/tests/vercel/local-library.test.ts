import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLibrary} from '../../lib/local-library';
const book={id:'12345678-1234-1234-1234-123456789abc',title:'测试',author:'作者',format:'TXT',chapters:[{title:'第一章',text:'第一句。第二句。'}]};
test('Offline books and progress survive reconnect, remain isolated per account',async()=>{
 const original=globalThis.fetch;let online=false;const requests:{method:string;body?:Record<string,unknown>}[]=[];
 globalThis.fetch=async(url,init)=>{if(!online)throw new TypeError('network failed');requests.push({method:init?.method||'GET',body:init?.body?JSON.parse(String(init.body)):undefined});if(!init?.method)return Response.json(String(url).includes('?id=')?{...book,chapter:0,position:0,updatedAt:0}:{books:[]});return Response.json({ok:true});};
 try{
  const first=createLibrary('one'),other=createLibrary('two');
  await first.request('/api/books',{method:'POST',body:JSON.stringify(book)});
  await first.request('/api/books',{method:'PATCH',body:JSON.stringify({id:book.id,chapter:0,position:1})});
  await first.flush();const reopened=createLibrary('one');
  assert.equal((await reopened.request<{position:number}>('/api/books?id='+book.id)).position,1);
  assert.equal((await other.request<{books:unknown[]}>('/api/books')).books.length,0);
  online=true;await reopened.flush();assert.equal(requests.findLast(r=>r.method==='PATCH')?.body?.position,1);
  assert.equal((await reopened.request<{position:number}>('/api/books?id='+book.id)).position,1);
  online=false;await reopened.request('/api/books?id='+book.id,{method:'DELETE'});assert.equal((await reopened.request<{books:unknown[]}>('/api/books')).books.length,0);
  await reopened.flush();online=true;await reopened.flush();assert.ok(requests.some(r=>r.method==='DELETE'));
 }finally{globalThis.fetch=original;}
});
