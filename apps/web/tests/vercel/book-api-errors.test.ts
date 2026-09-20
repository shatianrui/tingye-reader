import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import {transformSync} from 'esbuild';
import * as validation from '../../lib/book-validation';
const id='12345678-1234-1234-1234-123456789abc';
function handler(){
 const messages:unknown[]=[];
 class AuthError extends Error{constructor(message:string,public status=400){super(message);}}
 const sql=Object.assign(async(parts:TemplateStringsArray)=>parts.join('').includes('tingye.uploads')?[{book_id:id,object_path:'private-object'}]:[{object_path:'private-object'}],{begin:async()=>{throw Error('Unexpected database write in rejected request');}});
 const m={exports:{} as {handle:(req:Request)=>Promise<Response>}};
 const compiled=transformSync(fs.readFileSync('lib/book-api.ts','utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
 vm.runInNewContext(compiled,{module:m,exports:m.exports,Response,URL,console:{warn:(...args:unknown[])=>messages.push(args)},require:(name:string)=>{
  if(name==='node:crypto')return crypto;
  if(name==='./book-validation')return validation;
  if(name==='./books')return{samples:[]};
  if(name==='./db')return{db:()=>sql};
  if(name==='./auth')return{AuthError,requestUser:async()=>({userId:'isolated-test',username:'test-user'}),sameOrigin:()=>{},rateLimit:async()=>{}};
  if(name==='./storage')return{storage:()=>({
   download:async()=>({data:new Blob([JSON.stringify({id,title:'书',author:'作者',format:'EPUB',chapters:[{title:'正文',text:7}]})])}),
   createSignedUrl:async()=>{throw Error('PRIVATE_TOKEN_AND_SIGNED_URL_MUST_NOT_LEAK');},
  })};
  throw Error('Unexpected module: '+name);
 }});
 return{handle:m.exports.handle,messages};
}
test('fresh cloud listings identify the authenticated owner and forbid cache storage',async()=>{
 const r=await handler().handle(new Request('https://test/api/books?_sync=1'));assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');const data=await r.json();assert.deepEqual(data.account,{userId:'isolated-test',username:'test-user'});assert.ok(Number.isSafeInteger(data.snapshotAt));assert.ok(Array.isArray(data.books));
});
test('book validation failures return actionable 422 rather than misleading network 503',async()=>{
 const h=handler();
 for(const [body,code] of [[{action:'backup-complete',uploadId:id},'BOOK_INVALID_CONTENT'],[{},'BOOK_INVALID_METADATA']] as const){
  const r=await h.handle(new Request('https://test/api/books',{method:'POST',body:JSON.stringify(body)}));assert.equal(r.status,422);const data=await r.json();assert.equal(data.code,code);assert.ok(!data.error.includes('连接不上'));
 }
 assert.equal(h.messages.length,0);
});
test('a completing upload is only rejected when it is provably older than content already landed',()=>{
 assert.equal(validation.staleUpload(5,3),true);
 assert.equal(validation.staleUpload(3,5),false);
 assert.equal(validation.staleUpload(3,3),false);
 assert.equal(validation.staleUpload(null,3),false,'a book with no recorded version must never block completion');
 assert.equal(validation.staleUpload(5,null),false,'an unversioned upload (older app build) must never be rejected');
 assert.equal(validation.staleUpload(null,null),false);
});
test('invalid JSON is 400; unexpected storage failures disclose only the stage, not raw errors',async()=>{
 const h=handler();const invalid=await h.handle(new Request('https://test/api/books',{method:'POST',body:'{'}));assert.equal(invalid.status,400);assert.equal((await invalid.json()).code,'BOOK_INVALID_JSON');
 const response=await h.handle(new Request('https://test/api/books?id='+id));assert.equal(response.status,503);const data=await response.json();assert.equal(data.stage,'download');assert.equal(data.code,'BOOK_DOWNLOAD_FAILED');assert.ok(!JSON.stringify([data,h.messages]).includes('PRIVATE_TOKEN'));
});
