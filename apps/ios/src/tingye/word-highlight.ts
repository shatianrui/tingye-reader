// @ts-nocheck -- Runs only inside the isolated book WebView.
export function paintWordHighlight(entries,start,end,color){
 const ranges=[];
 for(const {node,start:base} of entries){if(base>=end||base+node.length<=start)continue;
  const range=document.createRange();range.setStart(node,Math.max(0,start-base));range.setEnd(node,Math.min(node.length,end-base));ranges.push(range);
 }
 let style=document.getElementById('ty-word-highlight-style');
 if(!style){style=document.createElement('style');style.id='ty-word-highlight-style';document.head.append(style);}
 style.textContent=`::highlight(reading){background-color:${color}}`;
 document.getElementById('ty-word-highlight-overlay')?.remove();
 if(window.Highlight&&window.CSS?.highlights){CSS.highlights.set('reading',new Highlight(...ranges));return;}
 // Older WebKit has no CSS Highlight API. Rectangles preserve the original DOM,
 // unlike adding a class to a whole paragraph or wrapping/reflowing its text.
 const overlay=document.createElement('div');overlay.id='ty-word-highlight-overlay';overlay.style.cssText='position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:1';
 for(const range of ranges)for(const rect of range.getClientRects()){
  if(rect.width<=0||rect.right<=0||rect.left>=innerWidth||rect.bottom<=0||rect.top>=innerHeight)continue;
  const mark=document.createElement('div');mark.style.cssText=`position:absolute;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;background:${color};opacity:.5`;overlay.append(mark);
 }
 document.body.append(overlay);
}
