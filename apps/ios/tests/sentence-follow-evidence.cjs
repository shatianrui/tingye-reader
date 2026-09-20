// Uses real GLM WAV playback in Chromium and WebKit EPUB rendering, with the
// actual ReaderPlayer. Windows WebKit has no working WAV media backend here. The Expo native I/O is mocked; this is NOT an iPhone device test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {harness}=require('./player-queue.cjs'),load=require('./load-ts.cjs');
const {originalChapter}=load('src/tingye/original-document.ts'),{originalPage}=load('src/tingye/original-page.ts');
const {sentenceRanges}=load('src/tingye/pagination.ts');
const out=path.resolve('releases/ios174-evidence'),capture=JSON.parse(fs.readFileSync(path.join(out,'capture.json'),'utf8'));
const config={fontSize:25,typography:load('src/tingye/typesetting.ts').defaultTypography,colors:load('src/tingye/themes.ts').readingTheme('paper'),original:false,spread:false};
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{
 const chapter=await originalChapter(capture.tracks.map(t=>'<p>'+escape(t.input)+'</p>').join(''),'整句跟读验证');
 const ranges=sentenceRanges(chapter.text),html=originalPage(chapter,config,0);
 const data=capture.tracks.map(t=>new Uint8Array(fs.readFileSync(path.join(out,t.file))));
 const h=harness(false,false,{nativeAlignment:false,bytes:text=>{const i=capture.tracks.findIndex(t=>t.input===text);assert.ok(i>=0,'fixture must match actual request text');return data[i];}});
 const server=http.createServer((req,res)=>{
  const index=capture.tracks.findIndex(t=>req.url==='/'+t.file);
  if(index>=0){res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':data[index].length});res.end(data[index]);}
  else if(req.url==='/clock'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Audio clock</title>');}
  else if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);}
  else{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await require('playwright').webkit.launch({executablePath:path.resolve('releases/webkit2359-runtime/Playwright.exe'),headless:true});
 const mediaBrowser=await require('playwright').chromium.launch({channel:'chrome',headless:true});
 const trace=[],shots=[],pageErrors=[];
 try{
  const audioPage=await mediaBrowser.newPage();await audioPage.goto(`http://127.0.0.1:${server.address().port}/clock`);
  const page=await browser.newPage({viewport:{width:396,height:300}});page.on('pageerror',e=>pageErrors.push(e.message));
  await page.addInitScript(()=>{window.messages=[];window.ReactNativeWebView={postMessage:s=>window.messages.push(JSON.parse(s))};});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.messages.some(m=>m.type==='ready'));
  await h.player.start({id:'glm-evidence',chapters:[chapter]},0,0,{provider:'glm',model:'glm-tts',voice:'tongtong',rate:2});
  const queue=h.playlists[0];assert.equal(queue.sources.length,2);assert.equal(queue.playing,true);
  await audioPage.evaluate(files=>{
   window.media={index:0,done:false,error:null};const a=window.evidenceAudio=new Audio();a.muted=true;
   const play=()=>{a.src='/'+files[window.media.index];a.playbackRate=2;return a.play().catch(e=>{window.media.error=String(e);});};
   a.onerror=()=>window.media.error='WebKit audio decode/load failed';
   a.onended=()=>{if(window.media.index+1<files.length){window.media.index++;void play();}else window.media.done=true;};
   return play();
  },capture.tracks.map(t=>t.file));
  let paused=false,lastShotPage=-1,lastSentence=-1,transitions=0,decodedTracks=new Set();const deadline=Date.now()+95000;
  while(Date.now()<deadline){
   const s=await audioPage.evaluate(()=>({currentIndex:window.media.index,currentTime:evidenceAudio.currentTime,duration:evidenceAudio.duration,playing:!evidenceAudio.paused&&!evidenceAudio.ended,isBuffering:evidenceAudio.readyState<3,didJustFinish:window.media.done,error:window.media.error}));
   assert.equal(s.error,null);
   if(!Number.isFinite(s.duration)||s.duration<=0){await page.waitForTimeout(100);continue;}
   decodedTracks.add(s.currentIndex);queue.emit(s);
   if(s.didJustFinish)break;
   const cursor=h.player.snapshot().cursor;assert.ok(cursor);
   const expected=ranges[cursor.position];assert.equal(cursor.start,expected.start);assert.equal(cursor.end,expected.end);
   await page.evaluate(cursor=>window.readerCommand({type:'playback',cursor}),cursor);
   const got=await page.evaluate(offset=>{
    const selected=[...(CSS.highlights.get('reading')||[])],current=window.messages.filter(m=>m.type==='page').at(-1);
    const span=[...document.querySelectorAll('[data-pos]')].find(n=>Number(n.dataset.pos)<=offset&&Number(n.dataset.pos)+n.textContent.length>offset);
    let anchorVisible=false;if(span){const r=document.createRange(),i=offset-Number(span.dataset.pos);r.setStart(span.firstChild,i);r.setEnd(span.firstChild,Math.min(span.firstChild.length,i+1));const b=r.getBoundingClientRect();anchorVisible=b.width>0&&b.left>=-1&&b.left<innerWidth&&b.top>=-1&&b.top<innerHeight;}
    return{page:current.index,anchor:current.anchor,text:selected.map(r=>r.toString()).join(''),anchorVisible};
   },cursor.offset);
   assert.equal(got.text,chapter.text.slice(cursor.start,cursor.end).replaceAll('\n',''));assert.equal(got.anchor,cursor.offset);assert.ok(got.anchorVisible,'current spoken anchor must be visible');
   if(cursor.position!==lastSentence){transitions++;lastSentence=cursor.position;}
   const entry={audioTrack:s.currentIndex,audioSeconds:Number(s.currentTime.toFixed(3)),duration:s.duration,page:got.page+1,sentence:cursor.position+1,offset:cursor.offset,highlight:got.text,anchorVisible:got.anchorVisible};trace.push(entry);
   if(got.page!==lastShotPage){lastShotPage=got.page;const file=`follow-${String(shots.length+1).padStart(2,'0')}.png`;await page.screenshot({path:path.join(out,file)});shots.push({...entry,file});}
   if(!paused&&s.currentTime>=3){
    paused=true;h.player.togglePause();await audioPage.evaluate(()=>evidenceAudio.pause());const before=h.player.snapshot().cursor;
    const time=await audioPage.evaluate(()=>evidenceAudio.currentTime);await page.waitForTimeout(350);assert.ok(Math.abs(await audioPage.evaluate(()=>evidenceAudio.currentTime)-time)<.05);
    queue.emit({...s,playing:false});assert.equal(h.player.snapshot().cursor,before);h.player.togglePause();await audioPage.evaluate(()=>evidenceAudio.play());
   }
   await page.waitForTimeout(120);
  }
  assert.equal(h.player.snapshot().active,false,'both audio tracks must finish before deadline');assert.equal(decodedTracks.size,2);assert.ok(shots.length>=3);assert.ok(transitions>=8);assert.equal(queue.plays,2,'only initial play and explicit resume; automatic page changes must not restart audio');assert.equal(queue.skips.length,0);assert.deepEqual(pageErrors,[]);
  const report={version:'1.7.4',evidence:'Actual GLM WAV playback clock in Chromium -> production ReaderPlayer -> production EPUB renderer in WebKit',physicalIPhoneTest:false,nativeAudioMocked:true,alignment:'GLM without device recognition: estimated position, whole-sentence highlight',audioTracks:decodedTracks.size,sentenceTransitions:transitions,visiblePageScreenshots:shots.length,pauseResumeVerified:paused,automaticPageTurnsDoNotRestartAudio:true,samples:trace.length,screenshots:shots};
  fs.writeFileSync(path.join(out,'follow-trace.json'),JSON.stringify(trace,null,2));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  const rows=shots.map(s=>`<section><p>音频 ${s.audioTrack+1} · ${s.audioSeconds}s · 第 ${s.page} 页 · 第 ${s.sentence} 句</p><img src="${s.file}" width="396"/><p>${escape(s.highlight)}</p></section>`).join('');
  fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>整句高亮与 GLM 播放验证</title><style>body{max-width:900px;margin:30px auto;padding:16px;font:16px/1.7 sans-serif;background:#f9f6ed;color:#283c31}section{display:inline-block;vertical-align:top;width:420px;max-width:100%;margin-bottom:24px}img{max-width:100%;border:1px solid #ccc}audio{max-width:100%}</style><h1>1.7.4 整句跟读验证</h1><p>真实 GLM 音频在 Windows Chromium 中播放，音频时钟驱动实际播放器逻辑与 WebKit 中的原书渲染代码。Windows WebKit 的音频后端在本机不支持 WAV，因此只用它检查分页和绘制。Expo 原生音频接口使用测试替身；不是 iPhone 真机录像，也不能据此证明语音识别或估算位置与实际发音逐字一致。</p><p>验证了 ${transitions} 次句子切换、${shots.length} 个可见页截图、暂停/继续及连续两段播放。此例无设备时间戳，采用进度估算；高亮范围始终为整句。</p>${capture.tracks.map(t=>`<p>${escape(t.file)}</p><audio controls src="${t.file}"></audio>`).join('')}<h2>GLM WAV 容器修复</h2><p>两份原始音频的 RIFF 长度少报 4 字节。服务端修正容器长度，不改变声音采样或来源标记。<a href="container-repair.json">逐字节对比</a> · <a href="audio-decode.json">严格读取与解码结果</a></p><audio controls src="glm-1-repaired.wav"></audio><audio controls src="glm-2-repaired.wav"></audio><p><a href="report.json">验证摘要</a> · <a href="follow-trace.json">完整时钟/游标日志</a> · <a href="capture.json">API 音频来源及哈希</a></p>${rows}</html>`);
  console.log(JSON.stringify({...report,screenshots:shots.map(s=>s.file)},null,2));
 }finally{h.player.stop();await browser.close();await mediaBrowser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
