const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const JSZip=require('jszip');
const buffers=new Map();
const moduleUnderTest={exports:{}};
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/tingye/import-book.ts'),'utf8');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{
 module:moduleUnderTest,exports:moduleUnderTest.exports,TextDecoder,
 require:id=>{
  if(id==='expo-file-system')return {File:class{constructor(uri){this.data=buffers.get(uri);this.size=this.data.length;}async bytes(){return this.data;}}};
  if(id==='expo')return {requireOptionalNativeModule:()=>null};
  if(id==='expo-crypto')return {randomUUID:require('node:crypto').randomUUID,CryptoDigestAlgorithm:{SHA1:'sha1'},digestStringAsync:async(_,v)=>require('node:crypto').createHash('sha1').update(v).digest('hex')};
  if(id.startsWith('./'))return require('./load-ts.cjs')('src/tingye/'+id.slice(2)+'.ts');
  return require(id);
 }
});
const {parseBook,textChapters,plain}=moduleUnderTest.exports;
const parse=async(name,data)=>{buffers.set(name,typeof data==='string'?Buffer.from(data):data);return parseBook(name,name);};
(async()=>{
 assert.equal(textChapters('没有章节标题。\n仍然保留正文。','散文')[0].text,'没有章节标题。\n仍然保留正文。');
 const txt=await parse('小说.txt','第一章 开始\n第一句话。\n第二句话！\n第二章 重逢\n新的正文。');
 assert.equal(txt.chapters.length,2);assert.equal(txt.chapters[1].title,'第二章 重逢');
 const html=await parse('文章.html','<head>不要朗读</head><script>alert(1)</script><p>甲&amp;乙</p><p>第二段。</p>');
 assert.equal(html.chapters[0].text,'甲&乙\n第二段。');
 assert.equal(plain('&#x1F4D6;'),'📖');
 const preserved=await parse('缩进.txt','　　第一段。\n\n第二段。');assert.equal(preserved.chapters[0].text,'　　第一段。\n\n第二段。');
 const utf16=await parse('编码.txt',Buffer.concat([Buffer.from([255,254]),Buffer.from('第一段。','utf16le')]));assert.equal(utf16.chapters[0].text,'第一段。');
 const docx=new JSZip();docx.file('word/document.xml','<w:document><w:p><w:r><w:t>第一段。</w:t></w:r></w:p><w:p><w:r><w:t>第二段。</w:t></w:r></w:p></w:document>');
 assert.equal((await parse('文档.docx',await docx.generateAsync({type:'uint8array'}))).chapters[0].text,'第一段。\n第二段。');
 const epub=new JSZip();epub.file('META-INF/container.xml','<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>');
 epub.file('OEBPS/content.opf','<package><manifest><item id="a" href="a.xhtml"/><item id="b" href="b.xhtml"/><item id="nav" href="nav.xhtml"/></manifest><spine><itemref idref="b"/><itemref idref="a"/><itemref idref="nav" linear="no"/></spine></package>');
 epub.file('OEBPS/a.xhtml','<h1>后章</h1><p>后段。</p>');epub.file('OEBPS/b.xhtml','<h1>先章</h1><p>先段。</p>');
 const book=await parse('书.epub',await epub.generateAsync({type:'uint8array'}));
 assert.equal(book.chapters.length,2);assert.equal(book.chapters[0].title,'先章');assert.equal(book.chapters[1].title,'后章');

 const originalFont=Buffer.from(Array.from({length:1200},(_,i)=>i%251)),obfuscated=Buffer.from(originalFont),key=require('node:crypto').createHash('sha1').update('book-id').digest();for(let i=0;i<1040;i++)obfuscated[i]^=key[i%20];
 epub.file('OEBPS/content.opf','<package unique-identifier="uid"><metadata><dc:identifier id="uid">book-id</dc:identifier></metadata><manifest><item id="a" href="a.xhtml"/><item id="b" href="b.xhtml"/><item id="font" href="font.ttf" media-type="font/ttf"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>');
 epub.file('OEBPS/font.ttf',obfuscated);epub.file('META-INF/encryption.xml','<encryption><enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><enc:CipherData><enc:CipherReference URI="OEBPS/font.ttf"/></enc:CipherData></enc:EncryptedData></encryption>');
 epub.file('OEBPS/pic.png',Buffer.from([137,80,78,71]));epub.file('OEBPS/book.css','@font-face{font-family:Original;src:url(font.ttf)}p{font-family:Original}');
 for(const name of ['a','b'])epub.file('OEBPS/'+name+'.xhtml','<head><link rel="stylesheet" href="book.css"/></head><p>图文正文</p><img src="pic.png"/>');
 const rich=await parse('图文.epub',await epub.generateAsync({type:'uint8array'}));assert.equal(Object.keys(rich.resources).length,2);assert.ok(rich.chapters.every(c=>c.document.html.includes('tingye-resource:')));assert.ok(rich.chapters.every(c=>c.document.css.includes('font-family:Original')));
 assert.ok(Object.values(rich.resources).some(r=>r==='data:font/ttf;base64,'+originalFont.toString('base64')));
 const restored=require('./load-ts.cjs')('src/tingye/library.ts').validateBook(JSON.parse(JSON.stringify(rich)));assert.equal(Object.keys(restored.resources).length,2);assert.ok(restored.chapters[0].document.html.includes('<img'));
 epub.file('OEBPS/a.xhtml','<img src="pic.png"/>');const illustrated=await parse('封面.epub',await epub.generateAsync({type:'uint8array'}));assert.equal(illustrated.chapters[0].text,'');assert.ok(illustrated.chapters[0].document.html.includes('<img'));
 console.log('PASS: EPUB deduplicated images/fonts, standard font obfuscation, publisher CSS, image-only spine pages and persisted original resources.');
 const covers=new JSZip();covers.file('META-INF/container.xml','<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>');
 covers.file('OPS/body.xhtml','<p>这是正文。</p>');covers.file('OPS/front.png',Buffer.from([137,80,78,71,13,10,26,10]));
 covers.file('OPS/cover.xhtml','<svg><image xlink:href="front.png"/></svg>');
 const coverPackage=(metadata,manifest,guide='')=>'<package><metadata>'+metadata+'</metadata><manifest><item id="body" href="body.xhtml"/>'+manifest+'</manifest><spine><itemref idref="body"/></spine>'+guide+'</package>';
 async function checkCover(opf){covers.file('OPS/book.opf',opf);const b=await parse('封面测试.epub',await covers.generateAsync({type:'uint8array'}));assert.match(b.resources[b.cover],/^data:image\//);assert.equal(b.chapters.length,1);assert.equal(b.chapters[0].text,'这是正文。');const restored=require('./load-ts.cjs')('src/tingye/library.ts').validateBook(JSON.parse(JSON.stringify(b)));assert.equal(restored.cover,b.cover);return b;}
 const epub3=await checkCover(coverPackage('','<item id="image" href="front.png" properties="nav cover-image" media-type="image/png"/>'));
 assert.equal(epub3.resources[epub3.cover],'data:image/png;base64,iVBORw0KGgo=');
 await checkCover(coverPackage('<meta name="cover" content="image"/>','<item id="image" href="front.png"/>'));
 await checkCover(coverPackage('','','<guide><reference type="cover" href="cover.xhtml#front"/></guide>'));
 covers.file('OPS/art.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"><rect width="100" height="150" fill="orange"/></svg>');
 const vector=await checkCover(coverPackage('','<item id="image" href="art.svg" properties="cover-image"/>'));assert.match(vector.resources[vector.cover],/^data:image\/svg\+xml/);
 covers.file('OPS/cover.jpg',Buffer.from([255,216,255]));await checkCover(coverPackage('','<item id="unmarked" href="cover.jpg" media-type="image/jpeg"/>'));
 covers.file('OPS/book.opf',coverPackage('','<item id="remote" href="https://untrusted.example/cover.png" properties="cover-image"/>'));
 assert.equal((await parse('无封面.epub',await covers.generateAsync({type:'uint8array'}))).cover,undefined);
 assert.equal(illustrated.cover,require('./load-ts.cjs')('src/tingye/book-cover.ts').bookCover(illustrated));assert.ok(illustrated.cover);
 console.log('PASS: EPUB 2/3 cover metadata outside spine, guide SVG image wrapper, SVG artwork, named cover fallback, persistence, no remote image access.');
 await assert.rejects(parse('空.txt',''),/未找到/);
 await assert.rejects(parse('扫描.pdf','fake pdf'),/完整版本/);
 await assert.rejects(parse('过大.txt',new Uint8Array(21*1024*1024)),/20 MB/);
 console.log('PASS: paragraph preservation, TXT chapter navigation, HTML, DOCX, EPUB spine order, missing PDF runtime and size limits.');
})().catch(e=>{console.error(e);process.exitCode=1;});

