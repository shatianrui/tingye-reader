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

// CommonMark-ish subset. Syntax must become formatting, never body text: every
// character left in the document is displayed, narrated and highlighted.
export function markdownHtml(text:string){
 const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const inline=(source:string)=>{
  const kept:string[]=[],keep=(html:string)=>`${kept.push(html)-1}`;
  let s=source.replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g,(_,c)=>keep(escape(c)));
  s=s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g,(_,__,code)=>keep('<code>'+escape(code.trim())+'</code>'));
  s=s.replace(/<(https?:\/\/[^\s>]+)>/g,(_,url)=>keep(escape(url)));
  s=s.replace(/<(\/?)(br|b|i|em|strong|u|s|sub|sup|small|code)\s*\/?>/gi,(_,close,tag)=>keep(`<${close}${tag.toLowerCase()}>`));
  s=s.replace(/<!--[\s\S]*?-->/g,'');
  s=escape(s);
  s=s.replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\[([^\]]+)\]\[[^\]]*\]/g,'$1');
  s=s.replace(/\[\^([^\]\s]+)\]/g,'<sup>$1</sup>');
  s=s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g,'<strong>$2</strong>').replace(/~~(?=\S)([\s\S]*?\S)~~/g,'<s>$1</s>');
  s=s.replace(/\*(?=\S)([^*]*?\S)\*/g,'<em>$1</em>').replace(/(^|[^\p{L}\p{N}_])_(?=\S)([^_]*?\S)_(?![\p{L}\p{N}_])/gu,'$1<em>$2</em>');
  return s.replace(/(\d+)/g,(_,i)=>kept[Number(i)]);
 };
 const lines=text.replace(/^﻿/,'').replace(/\r\n?/g,'\n').split('\n');
 const cells=(row:string)=>row.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(c=>inline(c.trim()));
 const separator=/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
 let paragraph:string[]=[],list:'ul'|'ol'|'',out:string[]=[];list='';
 const flush=()=>{if(paragraph.length)out.push('<p>'+paragraph.map((l,i)=>i<paragraph.length-1&&/( {2,}|\\)$/.test(l)?inline(l.replace(/( {2,}|\\)$/,''))+'<br>':inline(l.trim())).join(' ')+'</p>');paragraph=[];};
 const closeList=()=>{if(list)out.push(`</${list}>`);list='';};
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  const fence=line.match(/^\s{0,3}(`{3,}|~{3,})/);
  if(fence){flush();closeList();const body:string[]=[];for(i++;i<lines.length&&!lines[i].trim().startsWith(fence[1]);i++)body.push(lines[i]);out.push('<pre><code>'+escape(body.join('\n'))+'</code></pre>');continue;}
  // HTML comments are dropped outside code only (fences above, spans in inline()).
  if(/^\s*<!--/.test(line)){let j=i;while(j<lines.length&&!lines[j].includes('-->'))j++;const rest=j<lines.length?lines[j].slice(lines[j].indexOf('-->')+3):'';if(j<lines.length&&rest.trim()){lines[j]=rest;i=j-1;}else i=j;continue;}
  if(!line.trim()){flush();closeList();continue;}
  const next=lines[i+1]??'';
  if(paragraph.length===0&&/^\s{0,3}[^\s>#|-]/.test(line)&&/^\s{0,3}(=+|-+)\s*$/.test(next)&&!/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)){closeList();const level=next.trim()[0]==='='?1:2;out.push(`<h${level}>${inline(line.trim())}</h${level}>`);i++;continue;}
  if(/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)){flush();closeList();out.push('<hr>');continue;}
  const h=line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
  if(h){flush();closeList();out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);continue;}
  if(line.includes('|')&&separator.test(next)&&next.includes('-')){
   flush();closeList();const rows=[`<tr>${cells(line).map(c=>`<th>${c}</th>`).join('')}</tr>`];
   for(i+=2;i<lines.length&&lines[i].includes('|')&&lines[i].trim();i++)rows.push(`<tr>${cells(lines[i]).map(c=>`<td>${c}</td>`).join('')}</tr>`);
   i--;out.push(`<table>${rows.join('')}</table>`);continue;
  }
  const quote=line.match(/^\s{0,3}(?:>\s?)+(.*)$/);
  if(quote){flush();closeList();if(quote[1].trim())out.push('<blockquote><p>'+inline(quote[1])+'</p></blockquote>');continue;}
  const item=line.match(/^\s*([-*+]|\d{1,9}[.)])\s+(.*)$/);
  if(item){flush();const kind=/\d/.test(item[1])?'ol':'ul';if(list!==kind){closeList();list=kind;out.push(`<${kind}>`);}
   const task=item[2].match(/^\[([ xX])\]\s+(.*)$/);out.push('<li>'+(task?(task[1]===' '?'☐ ':'☑ ')+inline(task[2]):inline(item[2]))+'</li>');continue;}
  const note=line.match(/^\s{0,3}\[\^([^\]]+)\]:\s*(.*)$/);
  if(note){flush();closeList();out.push(`<p><small><sup>${escape(note[1])}</sup> ${inline(note[2])}</small></p>`);continue;}
  closeList();paragraph.push(line);
 }
 flush();closeList();return out.join('');
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
