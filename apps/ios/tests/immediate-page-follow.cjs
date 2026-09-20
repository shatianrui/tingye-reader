const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),load=require('./load-ts.cjs'),{harness}=require('./player-queue.cjs');
(async()=>{
 const {originalChapter}=load('src/tingye/original-document.ts'),{originalPage}=load('src/tingye/original-page.ts');
 const text='沿着山间的小路慢慢向前走，听见风吹过树叶发出轻轻的声音，'.repeat(6)+'直到远处的灯火渐渐亮起。';
 assert.ok(text.length<260);
 const chapter=await originalChapter('<p>'+text+'</p>','一句跨页');
 const config={fontSize:26,typography:load('src/tingye/typesetting.ts').defaultTypography,colors:load('src/tingye/themes.ts').readingTheme('paper'),original:false,spread:false};
 const out=path.resolve('releases/ios175-evidence');fs.mkdirSync(out,{recursive:true});const file=path.join(out,'reader.html');fs.writeFileSync(file,originalPage(chapter,config,0));
 const h=harness(false,false,{response:()=>({headers:{get:()=> 'application/json'},json:async()=>({audio:'010203',words:[{text,startTime:0,endTime:30}]})})});
 const browser=await require('playwright').webkit.launch({executablePath:path.resolve('releases/webkit2359-runtime/Playwright.exe'),headless:true});
 try{
  const page=await browser.newPage({viewport:{width:396,height:220}});await page.addInitScript(()=>{window.messages=[];window.ReactNativeWebView={postMessage:s=>window.messages.push(JSON.parse(s))};});await page.goto('file:///'+file.replaceAll('\\','/'));await page.waitForFunction(()=>window.messages.some(m=>m.type==='ready'));
  await h.player.start({id:'immediate',chapters:[chapter]},0,0,{provider:'minimax',model:'speech-2.8-hd',voice:'male-qn-qingse',rate:1});
  const queue=h.playlists[0],rows=[];
  for(const seconds of [0,10,20,29]){
   queue.emit({currentIndex:0,currentTime:seconds,duration:30,playing:true,isBuffering:false});const cursor=h.player.snapshot().cursor;assert.equal(cursor.position,0);assert.equal(cursor.start,0);assert.equal(cursor.end,text.length);
   await page.evaluate(cursor=>window.readerCommand({type:'playback',cursor}),cursor);
   const got=await page.evaluate(()=>({page:window.messages.filter(m=>m.type==='page').at(-1),highlight:[...CSS.highlights.get('reading')].map(r=>r.toString()).join('')}));
   assert.equal(got.highlight,text);assert.equal(got.page.anchor,cursor.offset);rows.push({seconds,sentenceEndSeconds:30,page:got.page.index+1,offset:cursor.offset});await page.screenshot({path:path.join(out,'follow-'+seconds+'s.png')});
  }
  assert.ok(rows[1].page>rows[0].page,'must turn before sentence end: '+JSON.stringify(rows));assert.ok(rows[2].page>rows[1].page);assert.equal(queue.plays,1);assert.equal(queue.skips.length,0);
  const report={simulatedNativeClock:true,physicalDeviceTest:false,singleSentenceEndSeconds:30,allHighlightRangesAreFullSentence:true,automaticPageTurnsDoNotRestartAudio:true,rows};fs.writeFileSync(path.join(out,'page-follow.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{h.player.stop();await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
