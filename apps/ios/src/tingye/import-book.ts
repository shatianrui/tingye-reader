import { File } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo';
import * as Crypto from 'expo-crypto';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { Book, Chapter } from './books';
import {htmlChapter,docxHtml,markdownHtml,splitStructured} from './book-format';
import {originalChapter,archiveResources,resourcePath,escapeHtml} from './original-document';
import {bookCover,chapterCover} from './book-cover';

const MAX = 4000000;
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: true });
const list = <T,>(v: T | T[] | undefined): T[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
export function plain(html:string){return htmlChapter(html,'').text;}
export function textChapters(text:string,title:string):Chapter[]{
 const chapters:Chapter[]=[];let heading=title,lines:string[]=[];
 const flush=()=>{while(lines.length&&!lines[0].trim())lines.shift();while(lines.length&&!lines.at(-1)!.trim())lines.pop();if(lines.length)chapters.push({title:heading.slice(0,200),text:lines.join('\n')});lines=[];};
 for(const line of text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n')){
  if(/^(第[\d零一二三四五六七八九十百千万两]+[章回节卷部篇].{0,70}|chapter\s+\d+.{0,70})$/i.test(line.trim())){flush();heading=line.trim();lines.push(line);}else lines.push(line);
 }
 flush();return chapters;
}
function resolve(base: string, href: string) {
  const result: string[] = [];
  for (const part of (base.slice(0, base.lastIndexOf('/') + 1) + href.split('#')[0]).split('/')) {
    if (part === '..') result.pop(); else if (part && part !== '.') result.push(part);
  }
  return decodeURIComponent(result.join('/'));
}
async function zipText(zip: JSZip, path: string) {
  const file = zip.file(path); if (!file) throw new Error('文档结构不完整。');
  const uncompressed = (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (uncompressed && uncompressed > MAX * 4) throw new Error('文档内容过大，请拆分导入。');
  return file.async('string');
}
export async function parseBook(uri: string, name: string): Promise<Book> {
  const file = new File(uri);
  if (file.size > 20 * 1024 * 1024) throw new Error('单本书籍不能超过 20 MB。');
  const format = name.split('.').pop()?.toLowerCase() || 'txt';
  const title = name.replace(/\.[^.]+$/, '').slice(0, 200) || '未命名';
  let chapters: Chapter[],pdf:string|undefined,assets:Record<string,string>|undefined,cover:string|undefined;
  if (format === 'pdf') {
    const module = requireOptionalNativeModule<{readPDFPages(uri: string): Promise<string[]>}>('TingyeDocuments');
    if (!module) throw new Error('当前运行环境不支持 PDF，请安装微读完整版本。');
    chapters = (await module.readPDFPages(uri)).map((text,i)=>({title:`第 ${i+1} 页`,text}));
    pdf=await file.base64();
  } else if (format === 'epub' || format === 'docx') {
    const zip = await JSZip.loadAsync(await file.bytes());
    if (format === 'docx') {
      const document = await zipText(zip, 'word/document.xml');
      const resources=archiveResources(zip),rels=zip.file('word/_rels/document.xml.rels');
      assets=resources.assets;
      const links=rels?list<any>(xml.parse(await rels.async('string'))?.Relationships?.Relationship):[];
      const images:Record<string,string>={};for(const rel of links)if(/\/image$/.test(rel['@_Type']||'')&&rel['@_TargetMode']!=='External')images[rel['@_Id']]=await resources.asset(resourcePath('word/document.xml',rel['@_Target']));
      chapters = [await originalChapter(docxHtml(document,images),title)];
    } else {
      const container = xml.parse(await zipText(zip, 'META-INF/container.xml'));
      const opfPath = list<any>(container?.container?.rootfiles?.rootfile)[0]?.['@_full-path'];
      if (typeof opfPath !== 'string') throw new Error('EPUB 缺少目录信息。');
      const pkg = xml.parse(await zipText(zip, opfPath)).package;
      const manifest = list<any>(pkg?.manifest?.item);
      // EPUB font obfuscation is a standard font-embedding mechanism, not DRM.
      if(zip.file('META-INF/encryption.xml')){
        const encryption=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',removeNSPrefix:true}).parse(await zipText(zip,'META-INF/encryption.xml'));
        const identifiers=list<any>(pkg?.metadata?.['dc:identifier']||pkg?.metadata?.identifier),unique=identifiers.find(i=>i?.['@_id']===pkg['@_unique-identifier'])||identifiers[0];
        const identifier=String(typeof unique==='string'?unique:unique?.['#text']||'').replace(/[ \t\r\n]/g,'');
        for(const entry of list<any>(encryption?.encryption?.EncryptedData)){
          if(entry?.EncryptionMethod?.['@_Algorithm']!=='http://www.idpf.org/2008/embedding')throw Error('此 EPUB 含受保护内容，请使用无 DRM 的书籍。');
          const path=resourcePath('',entry?.CipherData?.CipherReference?.['@_URI']||''),font=zip.file(path);
          if(!font||!identifier||!manifest.some(item=>resourcePath(opfPath,item['@_href']||'')===path&&/font|opentype|truetype/i.test(item['@_media-type']||'')))throw Error('EPUB 内嵌字体信息不完整。');
          const digest=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1,identifier),key=Uint8Array.from(digest.match(/../g)!,h=>parseInt(h,16)),bytes=await font.async('uint8array');
          for(let i=0;i<Math.min(bytes.length,1040);i++)bytes[i]^=key[i%key.length];zip.file(path,bytes);
        }
      }
      const resources=archiveResources(zip);
      assets=resources.assets;
      // EPUB 3 cover-image and EPUB 2 meta[name=cover] can be outside the spine.
      const coverId=list<any>(pkg?.metadata?.meta).find(m=>m['@_name']==='cover')?.['@_content'];
      const declared=manifest.filter(m=>String(m['@_properties']||'').split(/\s+/).includes('cover-image'));
      const legacy=manifest.find(m=>m['@_id']===coverId);
      const guide=list<any>(pkg?.guide?.reference).filter(r=>String(r['@_type']||'').split(/\s+/).includes('cover'));
      const named=manifest.filter(m=>/(?:^|\/)(?:cover|frontcover)(?:[_.-][^/]*)?\.(?:jpe?g|png|webp|gif|svg|avif)$/i.test(m['@_href']||''));
      for(const candidate of [...declared,...(legacy?[legacy]:[]),...guide,...named]){
        const path=resourcePath(opfPath,String(candidate['@_href']||''));if(!path||!zip.file(path))continue;
        if(/\.(?:x?html?)$/i.test(path)){
          const page=await originalChapter(await zipText(zip,path),'封面',path,resources);
          cover=chapterCover(page,assets);
        }else cover=(await resources.asset(path)).match(/^tingye-resource:(r\d+)$/)?.[1];
        if(cover)break;
      }
      const fixedLayout=list<any>(pkg?.metadata?.meta).some(m=>m['@_property']==='rendition:layout'&&m['#text']==='pre-paginated');
      chapters = [];
      for (const ref of list<any>(pkg?.spine?.itemref)) {
        const item = manifest.find(x => x['@_id'] === ref['@_idref']);
        if (!item || ref['@_linear'] === 'no') continue;
        const path=resolve(opfPath,item['@_href']),source=await zipText(zip,path);
        const viewport=source.match(/<meta\b[^>]*name=["']viewport["'][^>]*content=["']([^"']+)/i)?.[1]||source.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']viewport/i)?.[1]||'';
        const vw=Number(viewport.match(/width\s*=\s*(\d+)/)?.[1]),vh=Number(viewport.match(/height\s*=\s*(\d+)/)?.[1]);
        const fixed=(fixedLayout||String(ref['@_properties']||'').includes('rendition:layout-pre-paginated'))&&vw>0&&vh>0?{width:vw,height:vh}:undefined;
        const chapter=await originalChapter(source,`第 ${chapters.length+1} 章`,path,resources,fixed);
        if(chapter.text||/<(?:img|svg)\b/.test(chapter.document?.html||''))chapters.push(chapter);
        if (chapters.reduce((n, c) => n + c.text.length, 0) > MAX) throw new Error('正文超过 400 万字，请拆分导入。');
      }
    }
  } else {
    if (!['txt','md','markdown','html','htm'].includes(format)) throw new Error('支持 TXT、EPUB、PDF、DOCX、Markdown 和 HTML。');
    const bytes = await file.bytes(); let text:string;
    if(bytes.length>=2&&((bytes[0]===255&&bytes[1]===254)||(bytes[0]===254&&bytes[1]===255))){const little=bytes[0]===255;const chunks:string[]=[];for(let i=2;i+1<bytes.length;i+=2)chunks.push(String.fromCharCode(little?bytes[i]+bytes[i+1]*256:bytes[i]*256+bytes[i+1]));text=chunks.join('');}else text=new TextDecoder().decode(bytes);
    if (text.includes('\uFFFD')) { try { text = new TextDecoder('gb18030').decode(bytes); } catch { throw new Error('请将文本转为 UTF-8 编码后导入。'); } }
    chapters = ['html','htm'].includes(format)?[await originalChapter(text,title)]:['md','markdown'].includes(format)?[await originalChapter(markdownHtml(text),title)]:textChapters(text,title);
  }
  if (!chapters.length || (!pdf&&chapters.every(c => !c.text.trim()&&!/<(?:img|svg)\b/.test(c.document?.html||'')))) throw new Error('未找到可以阅读的正文。');
  if (chapters.length > 3000 || chapters.reduce((n, c) => n + c.text.length, 0) > MAX) throw new Error('书籍过大，请拆分导入。');
  return { id: Crypto.randomUUID(), title, author: '我的导入', format: format.toUpperCase(), chapters, pdf, resources:assets, cover:bookCover({cover,resources:assets,chapters}), color: 'green' };
}
