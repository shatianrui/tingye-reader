const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const load=require('./load-ts.cjs');
const {adaptiveReaderLayout,adaptiveShelfLayout}=load('src/tingye/reader-layout.ts');
const {originalPage}=load('src/tingye/original-page.ts');
const {chapter,config}=JSON.parse(fs.readFileSync('.verify-android/original150/fixture.json'));
const out=path.resolve('.verify-android/fold160');fs.mkdirSync(out,{recursive:true});
const fixture={...chapter,document:undefined};
fs.writeFileSync(path.join(out,'reader.html'),originalPage(fixture,{...config,spread:true},0));
const sizes=[[320,740],[344,760],[392,780],[673,760],[720,780],[840,680],[960,600],[740,320],[280,600]];
for(const [w,h] of sizes){
 const l=adaptiveReaderLayout(w,h,32),s=adaptiveShelfLayout(w,1.3);
 assert.ok(l.contentWidth+2*l.gutter<=w+.1);assert.ok(s.coverWidth>0&&s.coverWidth<=s.cellWidth);
 assert.ok(s.columns*s.cellWidth+(s.columns-1)*12+32<=w+.1);
 assert.ok(!l.spread||l.contentWidth>=620&&h>=420);
}
assert.equal(adaptiveReaderLayout(840,680,22,true).spread,false);
(async()=>{
 const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:344,height:700}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.messages=[];window.ReactNativeWebView={postMessage:s=>window.messages.push(JSON.parse(s))};});
  await page.goto('file:///'+path.join(out,'reader.html').replaceAll('\\','/'));
  await page.waitForFunction(()=>window.messages.some(m=>m.type==='ready'));
  const visible=async offset=>page.evaluate(offset=>{
   const span=[...document.querySelectorAll('[data-pos]')].find(n=>Number(n.dataset.pos)<=offset&&Number(n.dataset.pos)+n.textContent.length>offset);
   if(!span)return true;const n=span.firstChild,r=document.createRange(),i=offset-Number(span.dataset.pos);r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();
   return b.width===0||(b.left>=-2&&b.right<=innerWidth+2&&b.top>=-2&&b.bottom<=innerHeight+3);
  },offset);
  for(let i=0;i<30;i++){
   const offset=700+i*103;
   await page.evaluate(offset=>window.readerCommand({type:'seek',offset}),offset);
   for(const [width,height] of [[344,700],[796,640],[672,680],[740,280]]){
    const l=adaptiveReaderLayout(width,height);
    await page.setViewportSize({width:Math.round(l.contentWidth),height});
    await page.evaluate(spread=>window.readerCommand({type:'config',value:{...window.READER_INIT.config,spread}}),l.spread);
    await page.waitForTimeout(250);
    const last=await page.evaluate(()=>window.messages.filter(m=>m.type==='page').at(-1));
    assert.equal(last.anchor,offset,'Repeated folds must keep the exact text anchor');
    assert.equal(last.manual,false,'Reflow must not tell the native player to stop');
    assert.ok(await visible(offset),`Anchor hidden: ${width}x${height}, offset ${offset}`);
   }
  }
  await page.setViewportSize({width:796,height:640});
  await page.evaluate(()=>window.readerCommand({type:'config',value:{...window.READER_INIT.config,spread:true}}));await page.waitForTimeout(160);
  assert.equal(await page.locator('#ty-reader-book').getAttribute('data-columns'),'2');
  // Walk the full book in spreads: ranges must be contiguous and every narrated character visible.
  await page.evaluate(()=>window.readerCommand({type:'seek',offset:0}));
  let end=0,pages=0;
  for(;;){
   const m=await page.evaluate(()=>window.messages.filter(m=>m.type==='page').at(-1));
   assert.equal(m.start,end);assert.ok(m.end>=m.start);
   for(let o=m.start;o<m.end;o+=31)assert.ok(await visible(o),'Hidden spread text '+o);
   end=m.end;pages++;
   if(m.index===m.count-1)break;
   await page.evaluate(()=>window.readerCommand({type:'turn',delta:1}));
  }
  assert.equal(end,chapter.text.length);assert.ok(pages>2);
  await page.evaluate(()=>window.readerCommand({type:'seek',offset:2200}));
  await page.screenshot({path:path.join(out,'unfolded-spread.png')});
  await page.setViewportSize({width:300,height:660});await page.waitForTimeout(160);
  await page.screenshot({path:path.join(out,'folded-single.png')});
  // Fixed-layout and image-only pages never become two broken halves.
  for(const name of ['fixed','cover']){
   await page.goto('file:///'+path.resolve('.verify-android/original150',name+'.html').replaceAll('\\','/'));
   await page.setViewportSize({width:796,height:640});
   await page.evaluate(()=>window.readerCommand({type:'config',value:{...window.READER_INIT.config,spread:true}}));await page.waitForTimeout(180);
   assert.ok(await page.locator('img').evaluate(n=>{const b=n.getBoundingClientRect();return b.width>0&&b.right<=innerWidth+2&&b.bottom<=innerHeight+2;}));
   if(name==='fixed')assert.equal(await page.locator('#ty-reader-book').getAttribute('data-columns'),'1');
  }
  await page.goto('file:///'+path.resolve('.verify-android/original150/epub.html').replaceAll('\\','/'));
  await page.evaluate(()=>window.readerCommand({type:'config',value:{...window.READER_INIT.config,spread:true}}));
  await page.waitForTimeout(250);
  for(let offset=0;offset<chapter.text.length;offset+=97){await page.evaluate(offset=>window.readerCommand({type:'seek',offset}),offset);assert.ok(await visible(offset),'Original EPUB hidden in spread: '+offset);}
  assert.deepEqual(errors,[]);
  console.log('PASS: 120 fold/rotation/split-window changes preserve exact anchor, no playback-stop events; complete two-page text coverage, narrow/wide shelf geometry, fixed pages and images.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
