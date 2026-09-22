// @ts-nocheck -- Executed inside the isolated Android WebView, not in Hermes.
import {installDesktopInput} from './desktop-input';
import {paintWordHighlight} from './word-highlight';
export function originalRuntime(){
 const init=window.READER_INIT,content=document.getElementById('ty-reader-book'),track=document.getElementById('ty-reader-track'),settings=document.getElementById('ty-reader-settings');
 let nodes=[],starts=[0],page=0,count=1,pitch=1,config=init.config,ready=false,timer,anchor=init.offset||0,lastPageMessage='',playback=null,turnTimer;
 const send=(type,data={})=>window.ReactNativeWebView?.postMessage(JSON.stringify({type,...data}));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const rectAt=(node,index)=>{const range=document.createRange();range.setStart(node,clamp(index,0,node.length));range.setEnd(node,clamp(index+1,0,node.length));return range.getBoundingClientRect();};
 const pageAt=(node,index)=>clamp(Math.floor((rectAt(node,index).left-track.getBoundingClientRect().left+page*pitch+.5)/pitch),0,count-1);
 function collect(){nodes=Array.from(content.querySelectorAll('[data-pos]')).flatMap(span=>span.firstChild?.nodeType===3?[{node:span.firstChild,start:Number(span.dataset.pos)}]:[]);}
 function pageChanged(manual=false){if(manual)anchor=starts[page]||0;const next={index:page,count,start:starts[page]||0,end:starts[page+1]??init.length,anchor,manual},signature=JSON.stringify(next);if(signature!==lastPageMessage){lastPageMessage=signature;send('page',next);}}
 function show(index,manual=false){page=clamp(index,0,count-1);if(!init.fixed)content.style.transform=`translateX(${-page*pitch}px)`;pageChanged(manual);}
 function seek(offset){anchor=offset;const found=nodes.find(n=>n.start<=offset&&n.start+n.node.length>offset)||nodes.find(n=>n.start>=offset)||nodes.at(-1);show(found&&!init.fixed?pageAt(found.node,offset-found.start):0);}
 function layout(){clearTimeout(timer);timer=undefined;try{
  if(track.clientWidth<1||track.clientHeight<1)return;
  const saved=ready?anchor:(init.offset||0),savedPage=page,wasImagePage=ready&&((starts[page+1]??init.length)===starts[page]),w=track.clientWidth,h=track.clientHeight;
  const columns=!init.fixed&&init.length>0&&config.spread&&w>=620?2:1,gap=40,columnWidth=(w-gap*(columns-1))/columns;pitch=w+gap;
  content.dataset.columns=String(columns);content.dataset.imageOnly=String(!init.length);
  document.documentElement.style.setProperty('--column-width',columnWidth+'px');
  document.documentElement.style.setProperty('--page-height',(init.fixed?.height||h)+'px');
  if(init.fixed){const scale=Math.min(w/init.fixed.width,h/init.fixed.height);Object.assign(content.style,{width:init.fixed.width+'px',height:init.fixed.height+'px',columnWidth:'auto',transform:`scale(${scale})`,transformOrigin:'top left',marginLeft:Math.max(0,(w-init.fixed.width*scale)/2)+'px'});count=1;starts=[0];}
  else{content.style.transition='';clearTimeout(turnTimer);content.style.transform='none';page=0;Object.assign(content.style,{width:w+'px',height:h+'px',columnWidth:columnWidth+'px',columnCount:String(columns),columnGap:gap+'px',columnRule:columns===2?'1px solid '+config.colors.line:'none',columnFill:'auto',marginLeft:'0'});document.documentElement.style.setProperty('--page-height',h+'px');
   count=Math.max(1,Math.ceil((content.scrollWidth+40-1)/pitch));starts=Array(count).fill(null);starts[0]=0;
   for(const entry of nodes){const {node,start}=entry;if(!node.length)continue;const first=pageAt(node,0),last=pageAt(node,node.length-1);
    for(let p=first;p<=last;p++){let lo=0,hi=node.length;while(lo<hi){const mid=(lo+hi)>>>1;if(pageAt(node,mid)<p)lo=mid+1;else hi=mid;}if(lo<node.length&&(starts[p]===null||start+lo<starts[p]))starts[p]=start+lo;}
   }
   for(let p=count-1;p>=0;p--)if(starts[p]===null)starts[p]=starts[p+1]??init.length;
  }
  ready=true;if(playback){seek(playback.offset);highlight(playback.start,playback.end);}else if(wasImagePage||!nodes.length)show(savedPage);else seek(saved);send('ready');
 }catch(e){send('error',{message:'排版暂时失败，已显示连续正文。'});Object.assign(content.style,{transform:'none',columnWidth:'auto',height:'auto',width:'100%'});track.style.overflow='auto';count=1;starts=[0];pageChanged();}}
 function schedule(){clearTimeout(timer);timer=setTimeout(layout,100);}
 function apply(value){config=value;const t=value.typography,original=value.original&&init.original,family=t.font==='kai'?'ReaderKai':t.font==='serif'?'ReaderSerif':'sans-serif';
  document.body.style.background=value.colors.surface;document.body.style.color=value.colors.text;
  settings.textContent=`:root{--page-height:${track.clientHeight}px}html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:${value.colors.surface}!important}#ty-reader-track{position:absolute;inset:0;overflow:hidden}#ty-reader-book{font-size:${value.fontSize}px;line-height:${t.lineHeight};font-family:${family};color:${value.colors.text};box-sizing:border-box;overflow-wrap:break-word}#ty-reader-book img,#ty-reader-book svg{max-width:${init.fixed?'100%':'min(100%,var(--column-width))'};max-height:${init.fixed?'var(--page-height)':(init.length?'max(60px,calc(var(--page-height) - 4em))':'var(--page-height)')};object-fit:contain;break-inside:avoid}#ty-reader-book[data-image-only="true"] :is(article,div,p,figure){margin:0!important;padding:0!important;box-sizing:border-box}#ty-reader-book[data-image-only="true"] img,#ty-reader-book[data-image-only="true"] svg{display:block;margin-inline:auto}#ty-reader-book table{max-width:100%;border-collapse:collapse}#ty-reader-book pre{white-space:pre-wrap;overflow-wrap:anywhere}#ty-reader-book h1,#ty-reader-book h2,#ty-reader-book h3{break-after:avoid}#ty-reader-book p{orphans:2;widows:2}#ty-reader-book [data-pos]{cursor:text}#ty-reader-book::highlight(reading){background:${value.colors.highlight}}::highlight(reading){background:${value.colors.highlight};color:${value.colors.text}}.reading-active{background:${value.colors.highlight}}.missing-image{font-size:.8em;color:${value.colors.muted}}${!original?`#ty-reader-book,#ty-reader-book p,#ty-reader-book div,#ty-reader-book span{font-family:${family}!important}#ty-reader-book p{font-size:${value.fontSize}px!important;line-height:${t.lineHeight}!important;margin-block:0 ${t.paragraphGap}em!important;text-align:${t.alignment}!important;text-indent:${t.indent?'2em':'0'}!important}#ty-reader-book{line-height:${t.lineHeight}!important}`:''}${value.colors.dark?'#ty-reader-book *:not(img):not(svg):not(svg *){color:inherit!important;background-color:transparent!important}':''}`;
  schedule();
 }
 function highlight(start,end){paintWordHighlight(nodes,start,end,config.colors.highlight);}
 let imageViewer;
 function closeImage(){imageViewer?.remove();imageViewer=undefined;}
 function showImage(image){
  closeImage();touch=null;imageViewer=document.createElement('div');imageViewer.id='ty-image-viewer';imageViewer.setAttribute('role','dialog');imageViewer.setAttribute('aria-label','原书图片');
  imageViewer.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#151515;display:flex;align-items:center;justify-content:center;overflow:auto;touch-action:pinch-zoom';
  const full=image.cloneNode(true);full.removeAttribute('style');full.style.cssText='display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;margin:auto';imageViewer.append(full);
  const close=document.createElement('button');close.textContent='关闭图片';close.style.cssText='position:fixed;top:12px;right:12px;padding:12px 16px;border:0;border-radius:22px;background:white;color:#222;font-size:16px';close.addEventListener('click',e=>{e.stopPropagation();closeImage();});imageViewer.append(close);document.body.append(imageViewer);
 }
 document.addEventListener('keydown',e=>{if(!imageViewer)return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();closeImage();}},true);
 document.addEventListener('wheel',e=>{if(imageViewer)e.stopImmediatePropagation();},{capture:true,passive:true});
 function command(c){if(c.type==='playback'){playback=c.cursor;if(timer)layout();if(playback){closeImage();seek(playback.offset);highlight(playback.start,playback.end);}else highlight(-1,-1);return;}if(imageViewer){if(c.type==='turn')return;if(c.type==='seek')closeImage();}if(c.type==='config')apply(c.value);if(c.type==='seek'){if(timer)layout();seek(c.offset);}if(c.type==='highlight')highlight(c.start,c.end);if(c.type==='turn'){if(timer)layout();const next=page+c.delta;if(next<0||next>=count){send('boundary',{delta:c.delta});return;}if(config.pageTurnStyle==='eink'&&!init.fixed)turnEinkFlash(()=>show(next,true));else{turnSlide();show(next,true);}}}
 // Two page-turn styles for an explicit turn; layout/seek reposition
 // instantly either way (no reader-initiated flip involved).
 // Slide: a brief transform transition, like a physical e-book reader.
 function turnSlide(){
  if(config.pageTurnStyle!=='slide'||init.fixed)return;
  content.style.transition='transform .24s cubic-bezier(.22,.61,.36,1)';
  clearTimeout(turnTimer);turnTimer=setTimeout(()=>{content.style.transition='';},260);
 }
 // E Ink: a short dark flash brackets the (instant) page swap, matching the
 // full-panel refresh flicker of a Kindle-style electrophoretic display.
 function turnEinkFlash(swap){
  const flash=document.createElement('div');
  flash.style.cssText='position:fixed;inset:0;background:#161616;opacity:0;pointer-events:none;z-index:2147483000;transition:opacity 70ms linear';
  document.body.append(flash);
  requestAnimationFrame(()=>{flash.style.opacity='1';});
  setTimeout(()=>{swap();requestAnimationFrame(()=>{flash.style.opacity='0';});setTimeout(()=>flash.remove(),160);},90);
 }
 window.readerCommand=command;
 installDesktopInput(delta=>command({type:'turn',delta}),send);
 const receive=e=>{try{command(JSON.parse(e.data));}catch{}};document.addEventListener('message',receive);window.addEventListener('message',receive);
 let touch=null,moved=false;
 document.addEventListener('touchstart',e=>{if(imageViewer)return;touch={x:e.touches[0].clientX,y:e.touches[0].clientY,time:Date.now()};moved=false;},{passive:true});
 document.addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;moved=Math.abs(dx)>15||Math.abs(dy)>15;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.4){e.preventDefault();command({type:'turn',delta:dx<0?1:-1});}touch=null;});
 document.addEventListener('click',e=>{if(imageViewer)return;const art=e.target.closest('img,svg');if(art&&!moved&&!String(window.getSelection())){e.preventDefault();showImage(art);return;}const link=e.target.closest('a');if(link){e.preventDefault();const href=link.getAttribute('href');if(href?.startsWith('#')){const target=document.getElementById(decodeURIComponent(href.slice(1))),span=target?.matches('[data-pos]')?target:target?.querySelector('[data-pos]');if(span)seek(Number(span.dataset.pos));}else if(href)send('link',{href});return;}if(!moved&&!String(window.getSelection()))send('toggle');moved=false;});
 window.addEventListener('resize',schedule);window.addEventListener('pageshow',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 collect();apply(config);layout();
 document.fonts?.ready.then(schedule);for(const image of content.querySelectorAll('img')){image.addEventListener('load',schedule);image.addEventListener('error',schedule);}
 // Late font/image metrics are reapplied without discarding the visible content.
 setTimeout(schedule,1500);setTimeout(schedule,5000);
}
