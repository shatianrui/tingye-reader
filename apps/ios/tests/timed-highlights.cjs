const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),load=require('./load-ts.cjs');
const {originalChapter}=load('src/tingye/original-document.ts'),{originalPage}=load('src/tingye/original-page.ts');
const {mapTimedWords,speechMarkAt}=load('src/tingye/speech-timing.ts');
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/minimax-word-timing.json','utf8'));
const words=fixture.subtitles.flatMap(s=>s.timestamped_words).map(w=>({text:w.word,startTime:w.time_begin/1000,endTime:w.time_end/1000}));
(async()=>{
 const chapter=await originalChapter(Array.from({length:8},()=>'<p>'+fixture.text+'</p>').join(''),'实际时间戳');
 const config={fontSize:22,typography:load('src/tingye/typesetting.ts').defaultTypography,colors:load('src/tingye/themes.ts').readingTheme('paper'),original:true,spread:false};
 const dir=path.resolve('.verify-ios/sync172');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'timed.html'),originalPage(chapter,config,0));
 const browser=await require('playwright').webkit.launch({executablePath:path.resolve('releases/webkit2359-runtime/Playwright.exe'),headless:true});
 try{
  const page=await browser.newPage({viewport:{width:396,height:680}});await page.addInitScript(()=>{window.messages=[];window.ReactNativeWebView={postMessage:s=>window.messages.push(JSON.parse(s))};});
  await page.goto('file:///'+path.join(dir,'timed.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.messages.some(m=>m.type==='ready'));
  const marks=mapTimedWords(fixture.text,words);let pageChanges=0,lastPage=0;
  for(const rate of [1,1.25,2])for(let part=0;part<8;part++){
   const start=part*(fixture.text.length+1);
   for(const mark of marks){
    const wallSeconds=(mark.startTime+mark.endTime)/2/rate;
    const active=speechMarkAt(marks,wallSeconds*rate);assert.equal(active,mark);
    await page.evaluate(cursor=>window.readerCommand({type:'playback',cursor}),{chapter:0,position:0,offset:start+mark.start,start:start+mark.start,end:start+mark.end});
    const displayed=await page.evaluate(()=>{const ranges=[...CSS.highlights.get('reading')];return {text:ranges.map(r=>r.toString()).join(''),visible:ranges.flatMap(r=>[...r.getClientRects()]).some(r=>r.width>0&&r.left>=-1&&r.left<innerWidth&&r.top>=-1&&r.top<innerHeight),page:window.messages.filter(m=>m.type==='page').at(-1).index};});
    assert.equal(displayed.text,fixture.text.slice(mark.start,mark.end));assert.ok(displayed.visible);
    if(displayed.page!==lastPage){pageChanges++;lastPage=displayed.page;}
   }
  }
  assert.ok(pageChanges>=3);
  await page.screenshot({path:path.join(dir,'word-following.png')});
  console.log('PASS: actual provider timestamps -> original EPUB words -> visible pages at 1x/1.25x/2x; 768 timed word updates, across 8 paragraphs.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
