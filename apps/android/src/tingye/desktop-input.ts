// Runs only in the isolated book WebView. Native settings/inputs keep their keys.
export function installDesktopInput(turn:(delta:number)=>void,send:(type:string)=>void,wheelPages=true){
 const editable=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable],a,button,[role="button"]');
 const selected=()=>!!String(window.getSelection());
 document.body.tabIndex=-1;
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||editable(e.target))return;
  const delta=['ArrowRight','PageDown'].includes(e.key)?1:['ArrowLeft','PageUp'].includes(e.key)?-1:0;
  const action=e.key===' '&&!e.shiftKey?'play':e.key==='Escape'?'hideControls':e.key.toLowerCase()==='m'?'toggle':null;
  if(!delta&&!action)return;
  if(e.shiftKey||selected())return;
  e.preventDefault();
  if(e.repeat)return;
  if(delta)turn(delta);else if(action)send(action);
 });
 if(!wheelPages)return; // PDF keeps normal scrolling and pinch/trackpad zoom.
 let accumulated=0,lastEvent=0,lastTurn=-Infinity;
 document.addEventListener('wheel',e=>{
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||editable(e.target)||selected())return;
  // Allow scrollable tables/code in the book to consume their own wheel input.
  for(let n=e.target instanceof Element?e.target:null;n&&n!==document.body;n=n.parentElement){
   const style=getComputedStyle(n);
   if(/auto|scroll/.test(style.overflowY)&&n.scrollHeight>n.clientHeight+1)return;
   if(/auto|scroll/.test(style.overflowX)&&n.scrollWidth>n.clientWidth+1)return;
  }
  e.preventDefault();
  const now=performance.now(),raw=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
  const delta=raw*(e.deltaMode===1?20:e.deltaMode===2?innerHeight:1);
  if(now-lastEvent>180||Math.sign(delta)!==Math.sign(accumulated))accumulated=0;
  lastEvent=now;
  if(now-lastTurn<450)return;
  accumulated+=delta;
  if(Math.abs(accumulated)>=80){turn(accumulated>0?1:-1);accumulated=0;lastTurn=now;}
 },{passive:false});
}
