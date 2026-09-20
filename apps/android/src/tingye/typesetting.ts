import type {Chapter} from './books';

export type BookBlock={start:number;end:number;kind:'paragraph'|'heading'|'quote'|'verse'|'list';level?:number;spaceBefore?:number;align?:'left'|'center'|'right'};
export type BookMark={start:number;end:number;bold?:boolean;italic?:boolean};
export type Typography={font:'serif'|'kai'|'system';lineHeight:number;paragraphGap:number;margin:number;indent:boolean;alignment:'left'|'justify'};
export const defaultTypography:Typography={font:'serif',lineHeight:1.85,paragraphGap:.55,margin:24,indent:true,alignment:'left'};
export function normalizeTypography(value:Partial<Typography>|undefined):Typography{
 const v=value||{},clamp=(n:unknown,min:number,max:number,fallback:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
 return {font:v.font==='kai'||v.font==='system'?v.font:'serif',lineHeight:clamp(v.lineHeight,1.4,2.2,1.85),paragraphGap:clamp(v.paragraphGap,0,1.2,.55),margin:clamp(v.margin,16,40,24),indent:v.indent!==false,alignment:v.alignment==='justify'?'justify':'left'};
}
export function chapterBlocks(chapter:Chapter):BookBlock[]{
 if(chapter.blocks?.length)return chapter.blocks;
 const blocks:BookBlock[]=[];let offset=0;
 for(const line of chapter.text.split('\n')){if(line.trim())blocks.push({start:offset,end:offset+line.length,spaceBefore:Math.min(3,(chapter.text.slice(blocks.at(-1)?.end??0,offset).match(/\n/g)||[]).length-1),kind:/^\s*(?:第[\d零一二三四五六七八九十百千万两]+[章回节卷部篇]|chapter\s+\d+)/i.test(line)&&line.length<90?'heading':'paragraph'});offset+=line.length+1;}
 return blocks;
}
// Only presentation receives an indent; stored text, sentence IDs and TTS offsets stay unchanged.
export function blockDisplay(chapter:Chapter,block:BookBlock,indent:boolean){
 const raw=chapter.text.slice(block.start,block.end);
 const prefix=indent&&block.kind==='paragraph'&&!/^[\s\u3000]/u.test(raw)?'\u3000\u3000':'';
 return {text:prefix+raw,prefix:prefix.length};
}
export type MeasuredLine={text:string;height:number;y?:number};
export type PositionedLine={start:number;end:number;y:number;height:number};
export function positionLines(text:string,block:BookBlock,prefix:number,lines:MeasuredLine[]):PositionedLine[]{
 let cursor=0,y=0;
 return lines.map((line,i)=>{const found=text.indexOf(line.text,cursor),from=found>=cursor?found:cursor;cursor=from+line.text.length;const top=line.y??y;y=top+line.height;
  return {start:Math.min(block.end,block.start+Math.max(0,from-prefix)),end:i===lines.length-1?block.end:Math.min(block.end,block.start+Math.max(0,cursor-prefix)),y:top,height:line.height};});
}
export type PageFragment={block:number;first:number;last:number;top:number;height:number};
export type TextPage={start:number;end:number;fragments:PageFragment[]};
export function paginateBlocks(blocks:BookBlock[],measures:PositionedLine[][],height:number,fontSize:number,gap:number,textLength:number):TextPage[]{
 const pages:TextPage[]=[];let page:TextPage={start:0,end:0,fragments:[]},used=0;
 const flush=()=>{if(page.fragments.length){pages.push(page);page={start:0,end:0,fragments:[]};used=0;}};
 for(let bi=0;bi<blocks.length;bi++){
  const lines=measures[bi];if(!lines?.length)continue;
  let i=0;
  while(i<lines.length){
   const spacing=i===0&&used>0?fontSize*((blocks[bi].kind==='heading'?gap+1:gap)+Math.max(0,blocks[bi].spaceBefore||0)*.5):0;
   const headingRoom=blocks[bi].kind==='heading'&&i===0?lines.at(-1)!.y+lines.at(-1)!.height-lines[0].y+(measures[bi+1]?.slice(0,2).reduce((a,l)=>a+l.height,0)||0):0;
   if(used>0&&headingRoom>0&&headingRoom+spacing>height-used){flush();continue;}
   let end=i,span=0;
   while(end<lines.length){const next=lines[end].y+lines[end].height-lines[i].y;if(used+spacing+next>height-.5)break;span=next;end++;}
   if(end===i){if(used>0){flush();continue;}end=i+1;span=lines[i].height;}
   // Keep two lines together when feasible; never strand a one-line continuation.
   if(end<lines.length&&end-i===1&&used>0&&height>=lines[i].height*2){flush();continue;}
   if(lines.length-end===1&&end-i>=3){end--;span=lines[end-1].y+lines[end-1].height-lines[i].y;}
   if(!page.fragments.length)page.start=lines[i].start;
   page.fragments.push({block:bi,first:i,last:end-1,top:used+spacing,height:span});used+=spacing+span;page.end=lines[end-1].end;i=end;
   if(i<lines.length)flush();
  }
 }
 flush();if(pages.length){pages[0].start=0;for(let i=0;i<pages.length;i++)pages[i].end=pages[i+1]?.start??textLength;}
 return pages;
}
