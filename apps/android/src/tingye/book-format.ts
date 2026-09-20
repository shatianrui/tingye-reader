import {parseDocument} from 'htmlparser2';
import type {Chapter} from './books';
import type {BookBlock,BookMark} from './typesetting';

// A small semantic document model. No publisher scripts, network content or arbitrary CSS executes.
export function htmlChapter(html:string,title:string):Chapter{
 const root=parseDocument(html,{decodeEntities:true});
 const blocks:BookBlock[]=[],marks:BookMark[]=[];let text='',buffer='',localMarks:BookMark[]=[],kind:BookBlock['kind']='paragraph',align:BookBlock['align'],level:number|undefined;
 const flush=()=>{const left=buffer.match(/^[ \t\r\n]*/)?.[0].length||0,body=buffer.slice(left).replace(/[ \t\r\n]+$/,'');if(body){if(text)text+='\n';const start=text.length;text+=body;blocks.push({start,end:text.length,kind,align,level});for(const m of localMarks){const a=Math.max(0,m.start-left),b=Math.min(body.length,m.end-left);if(b>a)marks.push({...m,start:start+a,end:start+b});}}buffer='';localMarks=[];};
 const walk=(node:any,bold=false,italic=false,pre=false)=>{
  if(node.type==='text'){let value=pre?node.data:node.data.replace(/[\t\r\n ]+/g,' ');const start=buffer.length;buffer+=value;if(bold||italic)localMarks.push({start,end:buffer.length,bold,italic});return;}
  const tag=String(node.name||'').toLowerCase();if(['head','script','style','nav','noscript','svg'].includes(tag))return;
  if(node.attribs?.hidden!==undefined||/display\s*:\s*none/i.test(node.attribs?.style||''))return;
  if(tag==='br'){buffer+='\n';return;}
  if(tag==='hr'){flush();kind='verse';buffer='*　*　*';flush();kind='paragraph';return;}
  const isBlock=/^(p|h[1-6]|li|blockquote|pre|div|section|article|tr|figure|figcaption)$/.test(tag);
  const old={kind,align,level};
  if(isBlock){flush();kind=/^h[1-6]$/.test(tag)?'heading':tag==='blockquote'?'quote':tag==='pre'?'verse':tag==='li'?'list':kind==='quote'?'quote':'paragraph';level=kind==='heading'?Number(tag[1])||2:undefined;const match=String(node.attribs?.style||'').match(/text-align\s*:\s*(center|right|left)/i);align=(match?.[1]||node.attribs?.align||undefined) as BookBlock['align'];if(!['center','right','left'].includes(align||''))align=undefined;if(tag==='li')buffer='• ';}
  if(tag==='td'&&buffer&&!buffer.endsWith('　'))buffer+='　';
  for(const child of node.children||[])walk(child,bold||tag==='b'||tag==='strong',italic||tag==='i'||tag==='em',pre||tag==='pre');
  if(isBlock){flush();({kind,align,level}=old);}
 };
 for(const n of root.children)walk(n);flush();
 const heading=blocks.find(b=>b.kind==='heading');
 return {title:(heading?text.slice(heading.start,heading.end):title).slice(0,200),text,blocks,marks};
}

export function docxHtml(xml:string,images:Record<string,string>={}){
 return [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map(([,p])=>{
  const heading=p.match(/<w:pStyle\b[^>]*w:val="(?:Heading|heading|标题)(\d)"/),tag=heading?'h'+Math.min(6,Number(heading[1])):'p';
  const align=p.match(/<w:jc\b[^>]*w:val="(center|right|left)"/)?.[1];
  const body=[...p.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g)].map(([,r])=>{
   let t=[...r.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(br|tab)\b[^>]*\/>|<a:blip\b[^>]*r:embed="([^"]+)"[^>]*\/?\s*>/g)].map(m=>m[3]?(images[m[3]]?'<img src="'+images[m[3]]+'" alt="插图">':''):m[2]==='br'?'<br>':m[2]==='tab'?'　':m[1]).join('');
   if(/<w:b(?:\s|\/|>)/.test(r)&&!/<w:b\b[^>]*w:val="(?:0|false)"/.test(r))t='<b>'+t+'</b>';
   if(/<w:i(?:\s|\/|>)/.test(r)&&!/<w:i\b[^>]*w:val="(?:0|false)"/.test(r))t='<i>'+t+'</i>';
   return t;
  }).join('');return `<${tag}${align?' style="text-align:'+align+'"':''}>${body}</${tag}>`;
 }).join('');
}

export function markdownHtml(text:string){
 const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const inline=(s:string)=>escape(s).replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
 let code=false,paragraph:string[]=[],out:string[]=[];
 const flush=()=>{if(paragraph.length)out.push('<p>'+paragraph.join(' ')+'</p>');paragraph=[];};
 for(const line of text.replace(/\r\n?/g,'\n').split('\n')){if(/^```/.test(line)){flush();out.push(code?'</pre>':'<pre>');code=!code;continue;}if(code){out.push(escape(line)+'\n');continue;}if(!line.trim()){flush();continue;}const h=line.match(/^(#{1,6})\s+(.+)/);if(h){flush();out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);}else if(/^>\s?/.test(line)){flush();out.push('<blockquote>'+inline(line.replace(/^>\s?/,''))+'</blockquote>');}else if(/^\s*(?:[-*+] |\d+\. )/.test(line)){flush();out.push('<li>'+inline(line.replace(/^\s*(?:[-*+] |\d+\. )/,''))+'</li>');}else paragraph.push(inline(line));}
 flush();if(code)out.push('</pre>');return out.join('');
}

export function validFormatting(c:Chapter):Pick<Chapter,'blocks'|'marks'>{
 const inside=(r:{start:number;end:number})=>Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.start>=0&&r.end>r.start&&r.end<=c.text.length;
 const blocks=c.blocks?.filter(b=>inside(b)&&['paragraph','heading','quote','verse','list'].includes(b.kind)).slice(0,100000).map(b=>({start:b.start,end:b.end,kind:b.kind,level:b.level,align:['left','center','right'].includes(b.align||'')?b.align:undefined}));
 let last=0;const ordered=blocks?.every(b=>{const ok=b.start>=last;last=b.end;return ok;});
 // Reject incomplete/unordered metadata instead of hiding source text.
 const complete=ordered&&blocks?.length&&c.text.slice(0,blocks[0].start).trim()===''&&blocks.every((b,i)=>!c.text.slice(b.end,blocks[i+1]?.start??c.text.length).trim());
 return {blocks:complete?blocks:undefined,marks:c.marks?.filter(inside).slice(0,100000).map(m=>({start:m.start,end:m.end,bold:!!m.bold,italic:!!m.italic}))};
}

export function splitStructured(chapter:Chapter):Chapter[]{
 const headings=(chapter.blocks||[]).filter(b=>b.kind==='heading'&&(b.level===1||/^第.+[章回卷部篇]/.test(chapter.text.slice(b.start,b.end))));
 if(!headings.length)return [chapter];
 const cuts=[...new Set([0,...headings.map(b=>b.start),chapter.text.length])].sort((a,b)=>a-b);
 return cuts.slice(0,-1).flatMap((start,i)=>{let end=cuts[i+1];while(end>start&&chapter.text[end-1]==='\n')end--;if(!chapter.text.slice(start,end).trim())return [];
  const h=headings.find(b=>b.start===start);return [{title:h?chapter.text.slice(h.start,h.end):chapter.title,text:chapter.text.slice(start,end),blocks:chapter.blocks?.filter(b=>b.start>=start&&b.end<=end).map(b=>({...b,start:b.start-start,end:b.end-start})),marks:chapter.marks?.filter(m=>m.start>=start&&m.end<=end).map(m=>({...m,start:m.start-start,end:m.end-start}))}];});
}
