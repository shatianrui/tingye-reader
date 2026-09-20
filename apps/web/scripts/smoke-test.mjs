import assert from 'node:assert/strict';
const origin='http://localhost:5173';
const signIn=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=signIn.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
async function call(path,method='GET',body){const response=await fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();return {response,data};}
const home=await fetch(origin);assert.equal(home.status,200);
const id=crypto.randomUUID();const book={id,title:'导入验证',author:'Smoke test',format:'TXT',color:'green',chapters:[{title:'第一章',text:'第一句话。第二句话！第三句话？'},{title:'第二章',text:'下一章的句子。'}]};
try{
 let r=await call('/api/books','POST',book);assert.equal(r.response.status,200,JSON.stringify(r.data));
 r=await call('/api/books');assert.ok(r.data.books.some(b=>b.id===id&&b.title===book.title));
 r=await call('/api/books?id='+id);assert.deepEqual(r.data.chapters,book.chapters);
 r=await call('/api/books','PATCH',{id,chapter:1,position:0});assert.equal(r.response.status,200);
 r=await call('/api/books?id='+id);assert.equal(r.data.chapter,1);assert.equal(r.data.position,0);
 r=await call('/api/books','PATCH',{id,chapter:99,position:0});assert.equal(r.response.status,400);
 r=await call('/api/books','POST',{...book,id:'../bad'});assert.equal(r.response.status,400);
 r=await call('/api/tts','POST',{provider:'openai',key:'',model:'gpt-4o-mini-tts',voice:'coral',input:'测试'});assert.equal(r.response.status,400);
 r=await call('/api/tts','POST',{provider:'http://localhost',key:'invalid',model:'model',voice:'voice',input:'测试'});assert.equal(r.response.status,400);
 const cross=await fetch(origin+'/api/books',{method:'POST',headers:{Origin:'https://untrusted.example',Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(book)});assert.equal(cross.status,403);
 console.log('PASS: page, book import/list/read, durable progress, validation, TTS missing-key/endpoint checks, cross-origin rejection.');
} finally {const r=await call('/api/books?id='+id,'DELETE');assert.equal(r.response.status,200);const missing=await call('/api/books?id='+id);assert.equal(missing.response.status,404);console.log('PASS: deletion and test-data cleanup.');}
