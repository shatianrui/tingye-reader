const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=require('./load-ts.cjs');
const {originalChapter}=load('src/tingye/original-document.ts');
const {originalPage}=load('src/tingye/original-page.ts');
const {sentenceRanges}=load('src/tingye/pagination.ts');
const {defaultTypography}=load('src/tingye/typesetting.ts');
const {readingTheme}=load('src/tingye/themes.ts');
(async()=>{
 const out=path.resolve('.verify-ios/sync171');fs.mkdirSync(out,{recursive:true});
 const chapter=await originalChapter('<h1>跟读同步</h1><p>'+('山路安静，<strong>风吹过树林</strong>，阳光照在书页上。下一句仍在继续。'.repeat(75))+'</p>','跟读同步');
 const config={fontSize:22,typography:defaultTypography,colors:readingTheme('paper'),original:true,spread:false};
 const file=path.join(out,'page.html');fs.writeFileSync(file,originalPage(chapter,config,0));
 const browser=await require('playwright').webkit.launch({executablePath:path.resolve('releases/webkit2359-runtime/Playwright.exe'),headless:true});
 try{
  const page=await browser.newPage({viewport:{width:396,height:760}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.messages=[];window.ReactNativeWebView={postMessage:s=>window.messages.push(JSON.parse(s))};});
  await page.goto('file:///'+file.replaceAll('\\','/'));await page.waitForFunction(()=>window.messages.some(m=>m.type==='ready'));
  const ranges=sentenceRanges(chapter.text);
  const inspect=()=>page.evaluate(()=>{
   const mark=CSS.highlights.get('reading'),page=window.messages.filter(m=>m.type==='page').at(-1);
   return {page,text:[...(mark||[])].map(r=>r.toString()).join(''),visible:[...(mark||[])].flatMap(r=>[...r.getClientRects()]).some(r=>r.width>0&&r.left>=-1&&r.left<innerWidth&&r.top>=-1&&r.top<innerHeight)};
  });
  let cursor;
  for(let offset=0;offset<chapter.text.length;offset+=29){
   const range=ranges.find(r=>r.end>offset);if(!range)break;
   cursor={chapter:0,position:range.index,offset:Math.max(range.start,offset),start:range.start,end:range.end};
   await page.evaluate(cursor=>window.readerCommand({type:'playback',cursor}),cursor);
   const got=await inspect();assert.equal(got.page.anchor,cursor.offset);assert.equal(got.text,chapter.text.slice(range.start,range.end).replaceAll('\n',''));assert.ok(got.visible,'highlight must remain on the followed page at '+offset);
  }
  await page.evaluate(c=>window.readerCommand({type:'config',value:{...c,fontSize:27,original:false,typography:{...c.typography,lineHeight:2}}}),config);
  await page.setViewportSize({width:370,height:680});await page.waitForTimeout(350);
  assert.equal((await inspect()).page.anchor,cursor.offset);assert.ok((await inspect()).visible,'settings reflow must retain active highlight');
  const before=await inspect(),count=await page.evaluate(()=>window.messages.length);
  const span=page.locator('[data-pos]').last();
  await span.dispatchEvent('click');await span.dispatchEvent('contextmenu');
  const events=await page.evaluate(n=>window.messages.slice(n),count);
  assert.deepEqual(events.map(e=>e.type),['toggle'],'tap only opens controls; long press must not emit playback selection');
  assert.deepEqual(await inspect(),before,'text gestures cannot move the cursor or clear highlight');
  await page.screenshot({path:path.join(out,'follow-highlight.png')});
  await page.evaluate(()=>window.readerCommand({type:'playback',cursor:null}));
  assert.equal((await inspect()).text,'');assert.equal((await inspect()).page.anchor,cursor.offset,'stop clears highlight without page jump');
  assert.deepEqual(errors,[]);
  const fallback=await browser.newPage({viewport:{width:396,height:760}});
  await fallback.addInitScript(()=>{Object.defineProperty(window,'Highlight',{value:undefined});window.messages=[];window.ReactNativeWebView={postMessage:s=>window.messages.push(JSON.parse(s))};});
  await fallback.goto('file:///'+file.replaceAll('\\','/'));await fallback.waitForFunction(()=>window.messages.some(m=>m.type==='ready'));
  const original=await fallback.locator('#ty-reader-book').innerHTML();
  await fallback.evaluate(()=>window.readerCommand({type:'playback',cursor:{offset:20,start:20,end:21}}));
  const rects=await fallback.locator('#ty-word-highlight-overlay > div').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  assert.ok(rects.length&&rects.every(r=>r.width<=32),'older WebKit must highlight one character, not the enclosing paragraph');
  assert.equal(await fallback.locator('#ty-reader-book').innerHTML(),original,'highlighting must never wrap or rewrite the EPUB DOM');
  await fallback.close();
  console.log('PASS: WebKit multi-node EPUB highlights follow every page, settings/resize retain cursor, tap/long-press never select playback, stop clears only highlight.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
