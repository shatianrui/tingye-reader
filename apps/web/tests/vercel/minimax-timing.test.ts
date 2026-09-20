import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {minimaxAudio,minimaxWords} from '../../lib/minimax';

test('dates and numbers keep one original word with all its measured phoneme times',()=>{
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/minimax-numbers-timing.json','utf8'));
 const words=minimaxWords(fixture.subtitles);
 assert.equal(words.map(w=>w.text).join(''),fixture.text.replace('Hello, world','Hello,world'));
 assert.equal(words.filter(w=>w.text==='2026年9月18日').length,1);
 const date=words.find(w=>w.text==='2026年9月18日')!;
 const phonemes=fixture.subtitles[0].timestamped_words.filter((w:{word:string})=>w.word==='2026年9月18日');
 assert.equal(date.startTime,phonemes[0].time_begin/1000);assert.equal(date.endTime,phonemes.at(-1).time_end/1000);
});

test('real provider subtitle format, measured seconds, legacy binary and private fetch boundaries',async()=>{
 const originalFetch=globalThis.fetch,oldKey=process.env.MINIMAX_API_KEY;
 process.env.MINIMAX_API_KEY='fixture-key';
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/minimax-word-timing.json','utf8'));
 const calls:{url:string;options:RequestInit|undefined}[]=[];
 let subtitle='https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/test.json';
 globalThis.fetch=async(input,options)=>{
  const url=String(input);calls.push({url,options});
  if(url.includes('/t2a_v2'))return Response.json({base_resp:{status_code:0},data:{audio:'4944330102',subtitle_file:subtitle}});
  assert.equal(options?.headers,undefined,'credentials must never be forwarded to subtitle storage');
  assert.equal(options?.redirect,'manual');
  return Response.json(fixture.subtitles);
 };
 try{
  const r=await minimaxAudio(fixture.text,'male-qn-qingse',true),data=await r.json();
  assert.equal(data.audio,'4944330102');assert.ok(data.words.length>30);
  assert.equal(data.words[0].startTime,fixture.subtitles[0].timestamped_words[0].time_begin/1000);
  const body=JSON.parse(calls[0].options!.body as string);assert.equal(body.subtitle_type,'word');assert.equal(body.subtitle_enable,true);
  const legacy=await minimaxAudio('你好','male-qn-qingse');assert.equal(legacy.headers.get('content-type'),'audio/mpeg');assert.equal(Buffer.from(await legacy.arrayBuffer()).toString('hex'),'4944330102');
  subtitle='http://127.0.0.1/private';const count=calls.length;
  const missing=await(await minimaxAudio('你好','male-qn-qingse',true)).json();assert.deepEqual(missing.words,[]);assert.equal(calls.length,count+1,'reject foreign subtitle hosts without fetching');
 }finally{globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.MINIMAX_API_KEY;else process.env.MINIMAX_API_KEY=oldKey;}
});
