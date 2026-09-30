import {parseDocument} from 'htmlparser2';
import * as css from 'css-tree';
import type JSZip from 'jszip';
import type {Chapter} from './books';
import {chapterBlocks} from './typesetting';

export type OriginalDocument={html:string;css:string;path?:string;fixed?:{width:number;height:number}};
export const escapeHtml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const allowed=new Set('body article section div p span h1 h2 h3 h4 h5 h6 b strong em i u s small big sub sup ruby rt rp br hr pre code blockquote ul ol li dl dt dd table caption colgroup col thead tbody tfoot tr th td figure figcaption img a aside svg g path rect circle ellipse line polyline polygon text tspan image defs clipPath use symbol linearGradient radialGradient stop mask pattern'.toLowerCase().split(' '));
const blocked=new Set(['script','iframe','object','embed','form','input','button','video','audio','head','style','link','meta','base','noscript']);
const block=/^(body|article|section|div|p|h[1-6]|li|blockquote|pre|tr|figure|figcaption|dt|dd)$/;
const mime:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',svg:'image/svg+xml',otf:'font/otf',ttf:'font/ttf',woff:'font/woff',woff2:'font/woff2'};
export function resourcePath(base:string,href:string){
 if(/^(?:[a-z][\w+.-]*:|\/\/|\/)/i.test(href))return '';
 const parts=base.split('/').slice(0,-1);let clean:string;try{clean=decodeURIComponent(href.split(/[?#]/)[0]);}catch{return '';}
 for(const p of clean.split('/')){if(p==='..'){if(!parts.length)return '';parts.pop();}else if(p&&p!=='.')parts.push(p);}
 return parts.join('/');
}
export function safeCss(source:string,urls:Map<string,string>=new Map(),declarations=false){
 try{const ast=css.parse(source,{context:declarations?'declarationList':'stylesheet'});
 css.walk(ast,{enter(node:any,item:any,list:any){
  if(node.type==='Atrule'&&/^(import|charset|namespace)$/i.test(node.name)){if(list)list.remove(item);}
  if(node.type==='Url')node.value=urls.get(node.value)||(/^(?:tingye-resource:r\d+|data:(?:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)|font\/[^;,]+);base64,[a-z\d+/=\s]+)$/i.test(node.value)?node.value:'');
  if(node.type==='TypeSelector'&&node.name==='body')node.name='article';
  if(node.type==='Declaration'&&/^page-break-(before|after)$/.test(node.property)){node.property=node.property.replace('page-','');css.walk(node.value,(n:any)=>{if(n.type==='Identifier'&&n.name==='always')n.name='column';});}
  if(node.type==='Declaration'&&/^break-(before|after)$/.test(node.property))css.walk(node.value,(n:any)=>{if(n.type==='Identifier'&&/^(page|left|right|recto|verso)$/.test(n.name))n.name='column';});
  if(node.type==='Declaration'&&/^(?:behavior|-moz-binding|animation|transition)/i.test(node.property)&&list)list.remove(item);
 }});
 if(!declarations)css.walk(ast,(node:any)=>{if(node.type==='Rule'&&node.prelude?.type==='SelectorList'){const selectors:string[]=[];node.prelude.children.forEach((selector:any)=>{const s=css.generate(selector);selectors.push(s.trim().startsWith(':where(#ty-reader-book)')?s:':where(#ty-reader-book) '+s);});node.prelude=css.parse(selectors.join(','),{context:'selectorList'});}});
 return css.generate(ast).replace(/<\//g,'<\\/');}catch{return '';}
}
// Local package resources only. Never fetch external URLs from an imported book.
export function archiveResources(zip:JSZip){
 const cache=new Map<string,Promise<string>>();const assets:Record<string,string>={};let total=0;
 const store=(value:string)=>{const id='r'+Object.keys(assets).length;assets[id]=value;return 'tingye-resource:'+id;};
 const read=async(path:string)=>{const f=zip.file(path);if(!f)return '';const size=(f as any)._data?.uncompressedSize||0;if(size>16*1024*1024)throw Error('书籍中的单个资源超过 16MB。');total+=size;if(total>80*1024*1024)throw Error('书籍解压资源超过 80MB，请拆分导入。');return f;};
 const asset=(path:string):Promise<string>=>{if(cache.has(path))return cache.get(path)!;const promise=(async()=>{const type=mime[path.split('.').pop()?.toLowerCase()||''];if(!type)return '';const f=await read(path);if(!f)return '';if(type==='image/svg+xml'){const svg=await f.async('string');const safe=await originalChapter(svg,'插图',path,{asset:p=>/\.svg$/i.test(p)?Promise.resolve(''):asset(p),sheet,assets});const svgStyle=safe.document!.css.replace(/:where\(#ty-reader-book\) /g,'');const body=safe.document!.html.replace(/<span[^>]*>|<\/span>/g,'').replace(/(<svg[^>]*>)/,'$1<style>'+svgStyle+'</style>').replace(/tingye-resource:(r\d+)/g,(_,id)=>assets[id]||'');return store('data:image/svg+xml;base64,'+encodeBase64(body));}return store('data:'+type+';base64,'+await f.async('base64'));})();cache.set(path,promise);return promise;};
 const sheet=async(path:string,seen=new Set<string>()):Promise<string>=>{if(seen.has(path)||seen.size>12)return '';const branch=new Set(seen).add(path),f=await read(path);if(!f)return '';const source=await f.async('string'),urls=new Map<string,string>();let imported='';try{const ast=css.parse(source);const requests:Promise<void>[]=[];css.walk(ast,(n:any)=>{if(n.type==='Url')requests.push(asset(resourcePath(path,n.value)).then(v=>{urls.set(n.value,v);}));if(n.type==='Atrule'&&n.name==='import'){const raw=css.generate(n.prelude);const href=raw.match(/^(?:url\()?['"]?([^'"\s)]+)/)?.[1];if(href)requests.push(sheet(resourcePath(path,href),branch).then(v=>{imported+=v;}));}});await Promise.all(requests);}catch{}return imported+safeCss(source,urls);};
 return {asset,sheet,assets};
}
// Avoid relying on browser btoa in Hermes.
function encodeBase64(value:string){const bytes=new TextEncoder().encode(value),chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let result='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]||0)<<8)|(bytes[i+2]||0);result+=chars[n>>>18]+chars[(n>>>12)&63]+(i+1<bytes.length?chars[(n>>>6)&63]:'=')+(i+2<bytes.length?chars[n&63]:'=');}return result;}
export async function originalChapter(source:string,title:string,path='',resources?:ReturnType<typeof archiveResources>,fixed?:OriginalDocument['fixed']):Promise<Chapter>{
 const root=parseDocument(source,{decodeEntities:true}),sheets:string[]=[],urlMap=new Map<string,string>();
 const pending:Promise<void>[]=[];
 const visit=(n:any)=>{const tag=(n.name||'').toLowerCase(),a=n.attribs||{};
  if(tag==='link'&&/stylesheet/i.test(a.rel||'')&&resources){const index=sheets.length;sheets.push('');pending.push(resources.sheet(resourcePath(path,a.href||'')).then(s=>{sheets[index]=s;}));}
  const style=tag==='style'?n.children?.map((c:any)=>c.data||'').join(''):a.style;
  if(style){try{css.walk(css.parse(style,{context:tag==='style'?'stylesheet':'declarationList'}),(c:any)=>{if(c.type==='Url'&&resources)pending.push(resources.asset(resourcePath(path,c.value)).then(v=>{urlMap.set(c.value,v);}));});}catch{}if(tag==='style')sheets.push(style);}
  for(const key of ['src','xlink:href','href'])if(a[key]&&(tag==='img'||tag==='image')&&resources)pending.push(resources.asset(resourcePath(path,a[key])).then(v=>{urlMap.set(a[key],v);}));
  for(const child of n.children||[])visit(child);
 };visit(root);await Promise.all(pending);
 let text='';const newline=()=>{if(text&&!text.endsWith('\n'))text+='\n';};
 // Ruby annotations (<rt>/<rp>) are displayed but are not body text: narrating
 // them reads every annotated word twice and drifts the highlight.
 const render=(n:any,pre=false,inSvg=false,annotation=false):string=>{
  if(n.type==='text'){const value=pre?n.data:n.data.replace(/[\t\r\n ]+/g,' ');if(annotation)return escapeHtml(value);if(!value.trim()&&!pre){if(!text||text.endsWith('\n'))return '';}
   const start=text.length;text+=value;const tag=inSvg?'tspan':'span';return `<${tag} data-pos="${start}">${escapeHtml(value)}</${tag}>`;}
  const tag=String(n.name||'').toLowerCase(),a=n.attribs||{};
  if(blocked.has(tag))return '';if(a.hidden!==undefined||/display\s*:\s*none/i.test(a.style||''))return '';
  if(!tag||tag==='html')return (n.children||[]).map((c:any)=>render(c,pre,inSvg,annotation)).join('');
  if(!allowed.has(tag))return (n.children||[]).map((c:any)=>render(c,pre,inSvg,annotation)).join('');
  if(block.test(tag))newline();if(tag==='br'&&!annotation)text+='\n';
  // Adjacent table cells must not merge into one word for narration.
  if((tag==='td'||tag==='th')&&!annotation&&text&&!/\s$/.test(text))text+=' ';
  let attrs='';for(const [key,v] of Object.entries(a)){const value=String(v);if(/^(id|class|title|alt|lang|dir|width|height|colspan|rowspan|start|type|viewbox|preserveaspectratio|d|fill|stroke|stroke-width|x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|points|transform|offset|xmlns)$/.test(key))attrs+=` ${key==='viewbox'?'viewBox':key==='preserveaspectratio'?'preserveAspectRatio':key}="${escapeHtml(value)}"`;}
  if(a.style)attrs+=` style="${escapeHtml(safeCss(a.style,urlMap,true))}"`;
  if(tag==='img'||tag==='image'){const raw=a.src||a['xlink:href']||a.href||'',uri=urlMap.get(raw)||(/^(?:tingye-resource:r\d+|data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z\d+/=\s]+)$/i.test(raw)?raw:'');if(!uri)return `<span class="missing-image">[${escapeHtml(a.alt||'图片资源缺失')}]</span>`;attrs+=` ${tag==='img'?'src':'href'}="${escapeHtml(uri)}"`;}
  if(tag==='a'&&a.href&&!/^(?:[a-z][\w+.-]*:|\/\/)/i.test(a.href))attrs+=` href="${escapeHtml(a.href)}"`;
  if(tag==='use'&&/^#[\w.-]+$/.test(a.href||a['xlink:href']||''))attrs+=` href="${escapeHtml(a.href||a['xlink:href'])}"`;
  const children=(n.children||[]).map((c:any)=>render(c,pre||tag==='pre',inSvg||tag==='svg',annotation||tag==='rt'||tag==='rp')).join('');if(block.test(tag))newline();
  const svgNames:Record<string,string>={clippath:'clipPath',lineargradient:'linearGradient',radialgradient:'radialGradient'};
  const name=tag==='body'?'article':svgNames[tag]||tag;return `<${name}${attrs}>${children}${['img','br','hr','col'].includes(tag)?'':`</${name}>`}`;
 };
 const html=root.children.map(n=>render(n)).join('');text=text.replace(/\n+$/,'');
 const heading=source.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]?.replace(/<[^>]+>/g,'');
 return {title:(heading||title).slice(0,200),text,document:{html,css:sheets.map(s=>safeCss(s,urlMap)).join('\n'),path,fixed}};
}
export function legacyDocument(chapter:Chapter):OriginalDocument{
 const html=chapterBlocks(chapter).map(b=>{const tag=b.kind==='heading'?'h2':b.kind==='quote'?'blockquote':b.kind==='verse'?'pre':'p',marks=(chapter.marks||[]).filter(m=>m.end>b.start&&m.start<b.end),cuts=[...new Set([b.start,b.end,...marks.flatMap(m=>[Math.max(b.start,m.start),Math.min(b.end,m.end)])])].sort((a,b)=>a-b);const body=cuts.slice(0,-1).map((start,i)=>{const style=marks.filter(m=>m.start<=start&&m.end>start);return `<span data-pos="${start}" style="${style.some(m=>m.bold)?'font-weight:bold;':''}${style.some(m=>m.italic)?'font-style:italic;':''}">${escapeHtml(chapter.text.slice(start,cuts[i+1]))}</span>`;}).join('');return `<${tag}${b.align?' style="text-align:'+b.align+'"':''}>${body}</${tag}>`;}).join('');
 return {html,css:'p {white-space:pre-wrap;}'};
}

export function validateDocument(value:OriginalDocument|undefined,text:string):OriginalDocument|undefined{
 if(!value||typeof value.html!=='string'||typeof value.css!=='string')return;
 if(value.html.length+value.css.length>80*1024*1024)throw Error('章节资源过大。');
 const root=parseDocument(value.html);let valid=true;
 const visit=(n:any)=>{if(n.name&&!allowed.has(n.name.toLowerCase()))valid=false;
  for(const [key,v] of Object.entries(n.attribs||{})){const val=String(v);if(/^on/i.test(key)||['srcdoc','formaction','action'].includes(key))valid=false;
   if(['src','href','xlink:href'].includes(key)&&/^(?:https?:|file:|javascript:|\/\/)/i.test(val))valid=false;
   if(key==='data-pos'&&(!/^\d+$/.test(val)||Number(val)>text.length))valid=false;
  }for(const c of n.children||[])visit(c);
 };visit(root);if(!valid)return;
 const f=value.fixed;return {html:value.html,css:safeCss(value.css),path:typeof value.path==='string'?value.path:undefined,fixed:f&&f.width>0&&f.height>0&&f.width<=10000&&f.height<=10000?f:undefined};
}
