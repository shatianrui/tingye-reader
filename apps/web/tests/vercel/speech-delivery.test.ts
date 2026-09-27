import test from 'node:test';
import assert from 'node:assert/strict';
import {speechBlob,defaultConfig} from '../../lib/speech';

test('browser MiniMax clips download from provider storage and fall back to the relay',async()=>{
 const originalFetch=globalThis.fetch;
 const calls:{url:string;body?:Record<string,unknown>;options?:RequestInit}[]=[];
 let url='https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/a.mp3?Signature=x',storageOk=true;
 globalThis.fetch=async(input,options)=>{
  const target=String(input);calls.push({url:target,body:options?.body?JSON.parse(options.body as string):undefined,options});
  if(target==='/api/tts'){
   const body=JSON.parse(options!.body as string);
   return body.delivery==='url'?Response.json({format:'mp3',delivery:'url',url}):new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'audio/mpeg'}});
  }
  return storageOk?new Response(new Uint8Array([7,8,9]),{headers:{'Content-Type':'audio/mpeg'}}):new Response('denied',{status:403});
 };
 const config={...defaultConfig,provider:'minimax' as const,voice:'male-qn-qingse'};
 try{
  const direct=await speechBlob('hi',config,new AbortController().signal);
  assert.deepEqual([...new Uint8Array(await direct.arrayBuffer())],[7,8,9]);
  assert.equal(calls[0].body?.delivery,'url');assert.equal(calls[1].url,url);assert.equal(calls[1].options?.credentials,'omit');assert.equal(calls.length,2);
  storageOk=false;calls.length=0;
  assert.deepEqual([...new Uint8Array(await(await speechBlob('hi',config,new AbortController().signal)).arrayBuffer())],[1,2]);
  assert.equal(calls.at(-1)?.body?.delivery,undefined);
  url='https://evil.example/a.mp3';calls.length=0;
  await speechBlob('hi',config,new AbortController().signal);
  assert.ok(!calls.some(c=>c.url.includes('evil')),'never fetch foreign hosts');
  calls.length=0;await speechBlob('hi',{...defaultConfig},new AbortController().signal);
  assert.equal(calls.length,1);assert.equal(calls[0].body?.delivery,undefined,'GLM keeps the relayed WAV');
 }finally{globalThis.fetch=originalFetch;}
});
