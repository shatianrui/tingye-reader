const assert=require('assert/strict'),load=require('./load-ts.cjs');
const {htmlChapter,docxHtml,markdownHtml,validFormatting,splitStructured}=load('src/tingye/book-format.ts');
const {chapterBlocks,blockDisplay,positionLines,paginateBlocks,normalizeTypography}=load('src/tingye/typesetting.ts');
const chapter=htmlChapter('<head>排除</head><h1>第一章</h1><p>第一段 <b>粗体</b>与<em>斜体</em>。</p><blockquote>引用。</blockquote><pre>诗歌第一行\n  第二行</pre>','书');
assert.equal(chapter.blocks[0].kind,'heading');assert.equal(chapter.blocks[2].kind,'quote');assert.equal(chapter.blocks[3].kind,'verse');assert.ok(chapter.text.includes('诗歌第一行\n  第二行'));assert.ok(chapter.marks.some(m=>m.bold&&chapter.text.slice(m.start,m.end)==='粗体'));
assert.ok(!chapter.text.includes('排除'));assert.equal(validFormatting(chapter).blocks.length,4);
assert.equal(validFormatting({...chapter,blocks:[{start:0,end:1,kind:'paragraph'}]}).blocks,undefined,'Partial metadata must never hide text');
const original='　　原有缩进。\n\n第二段。';const c={title:'章',text:original},b=chapterBlocks(c);assert.equal(blockDisplay(c,b[0],true).prefix,0);assert.equal(blockDisplay(c,b[1],true).prefix,2);assert.equal(c.text,original,'Presentation must not rewrite TTS source');assert.equal(b[1].spaceBefore,1);
const display=blockDisplay(c,b[1],true),lines=positionLines(display.text,b[1],2,[{text:'　　第二',height:40,y:0},{text:'段。',height:40,y:40}]);assert.equal(lines[0].start,b[1].start);assert.equal(lines.at(-1).end,b[1].end);
const blocks=[{start:0,end:50,kind:'paragraph'},{start:51,end:53,kind:'heading'},{start:54,end:104,kind:'paragraph'}];
const measures=blocks.map((b,i)=>Array.from({length:i===1?1:5},(_,n)=>({start:b.start+n*10,end:Math.min(b.end,b.start+(n+1)*10),height:20,y:n*20})));
for(const h of [60,100,180,800]){const pages=paginateBlocks(blocks,measures,h,20,.5,104);assert.equal(pages[0].start,0);assert.equal(pages.at(-1).end,104);let seen=[];pages.forEach((p,i)=>{if(i)assert.equal(pages[i-1].end,p.start);p.fragments.forEach(f=>{assert.ok(f.top+f.height<=h);for(let n=f.first;n<=f.last;n++)seen.push(`${f.block}:${n}`);});});assert.equal(new Set(seen).size,11);assert.equal(seen.length,11);}
const pages=paginateBlocks(blocks,measures,140,20,.5,104);assert.ok(!pages[0].fragments.some(f=>f.block===1),'Heading moves with following paragraph');
const md=splitStructured(htmlChapter(markdownHtml('# 第一章\n\n第一行\n继续同段。\n\n# 第二章\n\n> 引用'),'书'));assert.equal(md.length,2);assert.ok(md[0].text.includes('第一行 继续同段。'));
const doc=htmlChapter(docxHtml('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>标题</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>重点</w:t></w:r></w:p>'),'文档');assert.equal(doc.blocks[0].kind,'heading');assert.ok(doc.marks.some(m=>m.bold));
assert.equal(normalizeTypography({lineHeight:NaN,margin:999,font:'bad'}).margin,40);
console.log('PASS: original text/inline styles/paragraphs/poetry, safe metadata, DOCX and Markdown headings; indentation offset mapping; full page coverage, widow/orphan bounds and heading keeps.');
