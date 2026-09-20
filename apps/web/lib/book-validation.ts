import type {Book} from './books';
export class BookValidationError extends Error{
 readonly name='BookValidationError';
 constructor(message:string,readonly code='BOOK_INVALID_CONTENT'){super(message);}
}
export const validId=(id:unknown):id is string=>typeof id==='string'&&/^(?:[a-f0-9-]{36}|sample-[a-z]+)$/.test(id);
export function metadata(value:unknown){
 const b=value as Book;
 if(!b||!validId(b.id)||typeof b.title!=='string'||!b.title.trim()||b.title.length>200||typeof b.author!=='string'||b.author.length>100||typeof b.format!=='string'||b.format.length>20)throw new BookValidationError('书籍信息不完整，或书名、作者信息超过长度上限。','BOOK_INVALID_METADATA');
 return {id:b.id,title:b.title,author:b.author,format:b.format,color:['green','blue','ochre'].includes(b.color||'')?b.color!:'green'};
}
export function validateBook(value:unknown):Book{
 const meta=metadata(value),b=value as Book;
 if(!Array.isArray(b.chapters)||!b.chapters.length||b.chapters.length>3000)throw new BookValidationError('书籍须包含 1–3000 个章节或页面。');
 let total=0;
 for(const [i,c] of b.chapters.entries()){
  if(!c||typeof c.title!=='string'||typeof c.text!=='string')throw new BookValidationError(`第 ${i+1} 章的数据格式无效。`);
  if(c.title.length>200)throw new BookValidationError(`第 ${i+1} 章的标题超过 200 字上限。`);
  total+=c.text.length;
  if(total>4000000)throw new BookValidationError('书籍正文超过 400 万字，请拆分后同步。');
 }
 // Native imports retain image-only EPUB covers, illustrations, and PDF pages
 // without extracted text. Do not drop these pages: progress uses chapter indices.
 const pdf=(b as Book&{pdf?:unknown}).pdf;
 const hasPdf=typeof pdf==='string'&&pdf.length<=30*1024*1024&&/^JVBER[a-z\d+/=\s]+$/i.test(pdf);
 const hasPictures=b.chapters.some(c=>{
  const html=(c as typeof c&{document?:{html?:unknown}}).document?.html;
  return typeof html==='string'&&/<(?:img|svg)\b/i.test(html);
 });
 if(!b.chapters.some(c=>c.text.trim())&&!hasPdf&&!hasPictures)throw new BookValidationError('书籍没有文字、原始 PDF 或原书图片页面，请检查导入文件。');
 // This remains the text-only web projection, NOT an HTML sanitizer. Backup
 // completion validates but stores the original uploaded bytes unchanged; native
 // clients validate/sanitize original documents and resources when loading them.
 return {...meta,chapters:b.chapters.map(({title,text})=>({title,text}))};
}
// A completing upload is stale if a newer content version already landed while it
// was in flight (two devices racing signed uploads for the same book). Either side
// missing a version (older, unversioned clients) must never block completion.
export function staleUpload(currentVersion:number|null|undefined,uploadVersion:number|null|undefined):boolean{
 return currentVersion!=null&&uploadVersion!=null&&Number(currentVersion)>Number(uploadVersion);
}
