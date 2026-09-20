const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const load=require('./load-ts.cjs'),{adaptiveReaderLayout}=load('src/tingye/reader-layout.ts');
const {originalPage}=load('src/tingye/original-page.ts');
const {chapter,config}=JSON.parse(fs.readFileSync('.verify-android/original150/fixture.json'));
const out=path.resolve('.verify-ios/desktop163');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'reader.html'),originalPage({...chapter,document:undefined},{...config,spread:true},0));
(async()=>{
 const browser=await require('playwright').webkit.launch({executablePath:path.resolve('releases/webkit2359-runtime/Playwright.exe'),headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1056,height:630}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.messages=[];window.ReactNativeWebView={postMessage:s=>window.messages.push(JSON.parse(s))};});
  await page.goto('file:///'+path.join(out,'reader.html').replaceAll('\\','/'));
  await page.waitForFunction(()=>window.messages.some(m=>m.type==='ready'));
  const state=()=>page.evaluate(()=>window.messages.filter(m=>m.type==='page').at(-1));
  await page.keyboard.press('PageDown');assert.equal((await state()).index,1);
  await page.keyboard.press('ArrowLeft');assert.equal((await state()).index,0);
  await page.keyboard.press('Space');await page.keyboard.press('m');await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(()=>window.messages.filter(m=>['play','toggle','hideControls'].includes(m.type)).map(m=>m.type)),['play','toggle','hideControls']);
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'PageDown',repeat:true,bubbles:true,cancelable:true})));
  assert.equal((await state()).index,0,'Held keys must not race through pages');
  await page.evaluate(()=>{const n=document.createElement('input');document.body.append(n);n.focus();});
  await page.keyboard.press('Space');await page.keyboard.press('ArrowRight');assert.equal((await state()).index,0,'Input keys must not trigger reader');
  await page.evaluate(()=>{document.querySelector('input').remove();document.body.focus();});
  await page.mouse.move(300,200);await page.mouse.wheel(0,120);await page.waitForTimeout(80);assert.equal((await state()).index,1);
  await page.mouse.wheel(0,120);await page.waitForTimeout(80);assert.equal((await state()).index,1,'Wheel inertia must not skip pages');
  await page.waitForTimeout(480);await page.mouse.wheel(0,-120);await page.waitForTimeout(80);assert.equal((await state()).index,0);
  // Window dragging/maximizing/display-density changes preserve exact text anchor.
  for(let i=0;i<10;i++)for(const [w,h] of [[1920,1080],[1100,760],[640,480],[320,320],[344,780],[1000,620]]){
   const l=adaptiveReaderLayout(w,h,22);assert.ok(l.contentWidth+2*l.gutter<=w);assert.equal(l.desktop,w>=1000&&h>=500);
   const offset=300+i*201;
   await page.evaluate(offset=>{window.readerCommand({type:'seek',offset});window.messages=[];},offset);
   await page.setViewportSize({width:Math.floor(l.contentWidth),height:h-(l.desktop?112:l.compactHeight?72:94)});
   await page.evaluate(spread=>window.readerCommand({type:'config',value:{...window.READER_INIT.config,spread}}),l.spread);
   await page.waitForTimeout(170);
   assert.equal((await state()).anchor,offset);
   assert.equal(await page.evaluate(()=>window.messages.some(m=>m.type==='page'&&m.manual)),false);
   assert.ok(await page.evaluate(offset=>{const n=[...document.querySelectorAll('[data-pos]')].find(n=>Number(n.dataset.pos)<=offset&&Number(n.dataset.pos)+n.textContent.length>offset);const r=document.createRange(),i=offset-Number(n.dataset.pos);r.setStart(n.firstChild,i);r.setEnd(n.firstChild,i+1);const b=r.getBoundingClientRect();return b.left>=-2&&b.right<=innerWidth+2&&b.top>=-2&&b.bottom<=innerHeight+2;},offset));
  }
  await page.screenshot({path:path.join(out,'desktop-reader.png')});
  await page.goto('file:///'+path.resolve('.verify-ios/reader151-webkit/pdf.html').replaceAll('\\','/'));
  await page.waitForFunction(()=>window.messages.some(m=>m.type==='ready'));
  for(const [width,height] of [[1100,700],[320,400],[1600,800],[640,320]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(600);
   assert.ok(await page.locator('#pdf-page').evaluate(n=>{const b=n.getBoundingClientRect();return b.width>0&&b.right<=innerWidth+1&&b.height<=innerHeight+1;}),'PDF must resize to fit window');
   assert.equal(await page.locator('#pdf-page canvas').count(),1,'Old page canvases must be released (PDF.js also owns a font measurement canvas)');
   assert.ok(await page.locator('.textLayer span').count()>0,'PDF remains selectable text, not only an image');
  }
  await page.keyboard.press('PageDown');assert.equal(await page.evaluate(()=>window.messages.at(-1).type),'boundary');
  assert.deepEqual(errors,[]);console.log('PASS: DeX keyboard/mouse, input exclusion, wheel debounce, 60 resize transitions with visible anchors/no manual-stop events, responsive PDF canvas and text.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
