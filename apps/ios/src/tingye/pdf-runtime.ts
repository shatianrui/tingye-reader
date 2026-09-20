// @ts-nocheck -- Browser-only PDF.js renderer; bundled as a string for Hermes.
import {installDesktopInput} from './desktop-input';
import {paintWordHighlight} from './word-highlight';
export async function pdfRuntime(){
 const init=window.READER_INIT,lib=window.pdfjsLib,host=document.getElementById('pdf-page');
 const send=(type,data={})=>window.ReactNativeWebView?.postMessage(JSON.stringify({type,...data}));
 const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 class CMaps{async fetch({name}){const data=window.PDF_RESOURCES[name+'.bcmap'];if(!data)throw Error('Missing CMap');return {cMapData:bytes(data),compressionType:1};}}
 class Fonts{async fetch({filename}){return bytes(window.PDF_RESOURCES[filename]);}}
 let config=init.config,textLayer,highlight={start:-1,end:-1},pdfPage,textContent,rendering=false,pending=false,resizeTimer;
 const applyHighlight=()=>{if(textLayer)paintWordHighlight(textLayer.textDivs.filter(span=>span.firstChild?.nodeType===3).map(span=>({node:span.firstChild,start:Number(span.dataset.pos)})),highlight.start,highlight.end,config.colors.highlight);};
 async function render(){
  if(!pdfPage||innerWidth<1||innerHeight<1)return;
  if(rendering){pending=true;return;}
  rendering=true;let stage;
  try{
   const base=pdfPage.getViewport({scale:1}),scale=Math.min(innerWidth/base.width,innerHeight/base.height),viewport=pdfPage.getViewport({scale});
   // Keep the previous page visible until its resized canvas and text are ready.
   stage=document.createElement('div');stage.style.cssText=`position:absolute;visibility:hidden;width:${viewport.width}px;height:${viewport.height}px`;
   stage.style.setProperty('--scale-factor',scale);stage.style.setProperty('--total-scale-factor',scale);stage.style.setProperty('--user-unit','1');host.append(stage);
   const canvas=document.createElement('canvas'),ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';stage.append(canvas);
   await pdfPage.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0]}).promise;
   const layer=document.createElement('div');layer.className='textLayer';stage.append(layer);const next=new lib.TextLayer({textContentSource:textContent,container:layer,viewport});await next.render();
   let from=0;for(const span of next.textDivs){const raw=span.textContent,found=init.text.indexOf(raw,from);span.dataset.pos=String(found>=0?found:from);from=(found>=0?found:from)+raw.length;}
   textLayer=next;host.replaceChildren(stage);stage.style.position='relative';stage.style.visibility='visible';host.style.width=viewport.width+'px';host.style.height=viewport.height+'px';applyHighlight();
  }catch(e){stage?.remove();send('error',{message:'PDF 页面缩放失败：'+String(e.message||e)});}
  finally{rendering=false;if(pending){pending=false;void render();}}
 }
 try{
  lib.GlobalWorkerOptions.workerSrc='data:application/javascript,';
  const pdf=await lib.getDocument({data:bytes(init.pdf),isEvalSupported:false,useSystemFonts:true,CMapReaderFactory:CMaps,StandardFontDataFactory:Fonts,useWasm:false}).promise;
  pdfPage=await pdf.getPage(init.page+1);textContent=await pdfPage.getTextContent();await render();
  send('page',{index:0,count:1,start:0,end:init.text.length});send('ready');
  if(!init.text.trim())send('note',{message:'此页没有可提取文字，保留原始扫描页面。'});
 }catch(e){send('error',{message:'原始 PDF 页面加载失败：'+String(e.message||e)});}
 function command(c){if(c.type==='playback'){highlight=c.cursor||{start:-1,end:-1};applyHighlight();}if(c.type==='turn')send('boundary',{delta:c.delta});if(c.type==='config'){config=c.value;document.body.style.background=config.colors.surface;applyHighlight();}if(c.type==='highlight'){highlight=c;applyHighlight();}}
 window.readerCommand=command;document.addEventListener('message',e=>{try{command(JSON.parse(e.data));}catch{}});window.addEventListener('message',e=>{try{command(JSON.parse(e.data));}catch{}});
 installDesktopInput(delta=>command({type:'turn',delta}),send,false);
 window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>void render(),120);});
 document.addEventListener('click',()=>{if(!String(getSelection()))send('toggle');});
 let touch;document.addEventListener('touchstart',e=>{touch=e.touches[0];},{passive:true});document.addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch.clientX,dy=e.changedTouches[0].clientY-touch.clientY;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&visualViewport.scale<=1)send('boundary',{delta:dx<0?1:-1});touch=null;});
}
