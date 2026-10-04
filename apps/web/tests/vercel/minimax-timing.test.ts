import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {minimaxAudio,minimaxAudioUrl,minimaxFileUrl,minimaxWords} from '../../lib/minimax';

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

function sse(events:unknown[],splitAt=7){
 const text=events.map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join('');
 const bytes=new TextEncoder().encode(text);
 return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=splitAt)c.enqueue(bytes.slice(i,i+splitAt));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
}

test('streams audio chunks, keeps inline word timing, and rejects provider or truncated streams',async()=>{
 const originalFetch=globalThis.fetch,oldKey=process.env.MINIMAX_API_KEY;
 process.env.MINIMAX_API_KEY='fixture-key';
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/minimax-word-timing.json','utf8'));
 const bodies:Record<string,unknown>[]=[];let next:()=>Response;
 globalThis.fetch=async(input,options)=>{assert.match(String(input),/\/v1\/t2a_v2$/,'no subtitle file download when timing is inline');bodies.push(JSON.parse(options!.body as string));return next();};
 try{
  next=()=>sse([{data:{audio:'494433',status:1}},{data:{audio:'0102',status:1,subtitle:fixture.subtitles[0]}},{data:{audio:'',status:2,subtitles:fixture.subtitles},base_resp:{status_code:0}}]);
  const timed=await(await minimaxAudio(fixture.text,'male-qn-qingse',true)).json();
  assert.equal(timed.audio,'4944330102');assert.equal(timed.words.length,minimaxWords(fixture.subtitles).length);
  assert.equal(bodies[0].stream,true);assert.deepEqual(bodies[0].stream_options,{exclude_aggregated_audio:true});assert.equal(bodies[0].subtitle_enable,true);
  next=()=>sse([{data:{audio:'4944',status:1}},{data:{audio:'330102',status:1}},{data:{status:2},base_resp:{status_code:0}}],3);
  const plain=await minimaxAudio('你好','male-qn-qingse');
  assert.equal(plain.headers.get('content-type'),'audio/mpeg');assert.equal(Buffer.from(await plain.arrayBuffer()).toString('hex'),'4944330102');
  assert.equal(bodies[1].subtitle_enable,undefined);
  next=()=>sse([{data:{audio:'4944',status:1}},{base_resp:{status_code:1008,status_msg:'insufficient balance'}}]);
  await assert.rejects(minimaxAudio('你好','male-qn-qingse'),/额度不足/);
  next=()=>sse([{data:{audio:'4944',status:1}}]);
  await assert.rejects(minimaxAudio('你好','male-qn-qingse'),/意外中断/,'a partial clip must never be played as complete audio');
  next=()=>Response.json({base_resp:{status_code:1004}});
  await assert.rejects(minimaxAudio('你好','male-qn-qingse'),/参数无效/);
  next=()=>Response.json({base_resp:{status_code:2049,status_msg:'invalid api key'}});
  await assert.rejects(minimaxAudio('你好','male-qn-qingse'),/密钥无效.*invalid api key/);
  next=()=>Response.json({base_resp:{status_code:1002,status_msg:'rpm limit'}});
  await assert.rejects(minimaxAudio('你好','male-qn-qingse'),(e:Error&{status?:number;code?:string;retryAfter?:number})=>{assert.match(e.message,/频率超限.*rpm limit/);assert.equal(e.status,429);assert.equal(e.code,'TTS_RATE_LIMIT');assert.ok(e.retryAfter!>0&&e.retryAfter!<=120);return true;});
  next=()=>sse([{data:{audio:'4944',status:1}},{base_resp:{status_code:1039,status_msg:'tpm limit'}}]);
  await assert.rejects(minimaxAudio('你好','male-qn-qingse'),(e:Error&{status?:number})=>{assert.match(e.message,/每分钟文本量超限.*tpm limit/);assert.equal(e.status,429);return true;});
 }finally{globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.MINIMAX_API_KEY;else process.env.MINIMAX_API_KEY=oldKey;}
});

test('url delivery returns only provider-signed OSS links and uses high quality audio',async()=>{
 const originalFetch=globalThis.fetch,oldKey=process.env.MINIMAX_API_KEY;
 process.env.MINIMAX_API_KEY='fixture-key';
 const bodies:Record<string,unknown>[]=[];let data:Record<string,unknown>={};
 globalThis.fetch=async(input,options)=>{assert.match(String(input),/\/v1\/t2a_v2/);bodies.push(JSON.parse(options!.body as string));return Response.json({base_resp:{status_code:0},data});};
 try{
  const oss='https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/a.mp3?Expires=1&Signature=x';
  data={audio:oss,subtitle_file:'https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/a.json'};
  const r=(await minimaxAudioUrl('hello','male-qn-qingse',true))!;const json=await r.json();
  assert.deepEqual(json,{format:'mp3',delivery:'url',url:oss,subtitleUrl:data.subtitle_file});
  assert.equal(bodies[0].output_format,'url');assert.equal(bodies[0].stream,false);assert.equal(bodies[0].subtitle_enable,true);
  assert.deepEqual(bodies[0].audio_setting,{format:'mp3',sample_rate:32000,bitrate:128000,channel:1});
  data={audio:oss,subtitle_file:'https://evil.example/a.json'};
  assert.equal((await(await minimaxAudioUrl('hello','male-qn-qingse',true))!.json()).subtitleUrl,undefined);
  for(const audio of ['http://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/a.mp3','https://127.0.0.1/a.mp3','https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com:8443/a.mp3','https://u:p@minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/a.mp3','4944'])
   {data={audio};assert.equal(await minimaxAudioUrl('hello','male-qn-qingse'),undefined,audio);}
  assert.equal(minimaxFileUrl('https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com.evil.example/a'),undefined);
 }finally{globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.MINIMAX_API_KEY;else process.env.MINIMAX_API_KEY=oldKey;}
});

test('proxied audio uses the compact 64 kbps stream',async()=>{
 const originalFetch=globalThis.fetch,oldKey=process.env.MINIMAX_API_KEY;
 process.env.MINIMAX_API_KEY='fixture-key';let body:Record<string,unknown>={};
 globalThis.fetch=async(_input,options)=>{body=JSON.parse(options!.body as string);return sse([{data:{audio:'4944',status:1}},{data:{status:2},base_resp:{status_code:0}}]);};
 try{await minimaxAudio('hello','male-qn-qingse');assert.deepEqual(body.audio_setting,{format:'mp3',sample_rate:24000,bitrate:64000,channel:1});}
 finally{globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.MINIMAX_API_KEY;else process.env.MINIMAX_API_KEY=oldKey;}
});