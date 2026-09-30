const assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {parseDocument}=require('htmlparser2');
const {markdownHtml,docxHtml}=load('src/tingye/book-format.ts');
const {originalChapter}=load('src/tingye/original-document.ts');
const {sentenceRanges,narrationGroups}=load('src/tingye/pagination.ts');
const {estimatedSpeechOffset}=load('src/tingye/speech-progress.ts');
const {speakableText,hasSpeech}=load('src/tingye/speech-text.ts');

// Highlight offsets are data-pos + index; narration offsets index chapter.text.
// Every rendered span must be exactly the text slice it claims to be.
function assertAligned(chapter,label){
 const walk=n=>{if(n.attribs?.['data-pos']!==undefined){const pos=Number(n.attribs['data-pos']),value=(n.children||[]).map(c=>c.data||'').join('');
   assert.equal(chapter.text.slice(pos,pos+value.length),value,`${label}: span @${pos} drifted`);}for(const c of n.children||[])walk(c);};
 if(chapter.document)walk(parseDocument(chapter.document.html,{decodeEntities:true}));
 for(const r of sentenceRanges(chapter.text))assert.equal(chapter.text.slice(r.start,r.end),r.text,`${label}: sentence @${r.start} drifted`);
}

const markdown=`# 第一章 春天

这是**加粗**和*斜体*，还有 \`代码\` 与 __下划线__、~~删除线~~、snake_case_name。
链接 [听页](https://copilotcli.top) 与 <https://example.com>。

---

- 第一项
- [ ] 待办
- [x] 完成
1. 有序一
2) 有序二

| 列一 | 列二 |
| :--- | ---: |
| 甲 | 乙 |

> 引用一句。

标题二
======

\`\`\`js
const a = 1;
\`\`\`

<!-- 注释 -->
换行<br>之后\\*转义星号\\*。脚注[^1]。

[^1]: 脚注内容。
`;

(async()=>{
 const md=await originalChapter(markdownHtml(markdown),'md');
 assertAligned(md,'markdown');
 // No Markdown syntax survives as body text (escaped \* is intended content).
 for(const junk of ['**','__','~~','`','---','|','[ ]','[x]','](','<br>','<!--','======','[^1]','#'])assert.ok(!md.text.includes(junk),`markdown text still contains ${junk}: ${JSON.stringify(md.text)}`);
 for(const kept of ['加粗','斜体','代码','下划线','删除线','snake_case_name','听页','https://example.com','第一项','☐ 待办','☑ 完成','有序二','列一 列二','甲 乙','引用一句。','标题二','const a = 1;','之后*转义星号*','脚注内容'])assert.ok(md.text.includes(kept),`markdown lost ${kept}`);
 assert.match(md.document.html,/<h1>.*第一章 春天.*<\/h1>/);assert.match(md.document.html,/<table>/);assert.match(md.document.html,/<hr>/);assert.match(md.document.html,/<s>.*删除线.*<\/s>/);

 // Other formats keep the same invariant.
 const html=await originalChapter('<h1>标题</h1><p>正文<b>加粗</b>。<ruby>汉<rp>(</rp><rt>hàn</rt><rp>)</rp></ruby><ruby>字<rt>zì</rt></ruby>很美。</p><table><tr><td>甲</td><td>乙</td></tr></table>','html');
 assertAligned(html,'html');
 assert.ok(!/hàn|zì|[()]/.test(html.text),'ruby annotations must not be narrated');
 assert.match(html.document.html,/<rt>hàn<\/rt>/,'ruby annotations stay visible');
 assert.ok(html.text.includes('甲 乙'),'table cells stay separate words');
 const docx=await originalChapter(docxHtml('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>第一章</w:t></w:r></w:p><w:p><w:r><w:t>正文</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>继续。</w:t></w:r></w:p>'),'docx');
 assertAligned(docx,'docx');
 // TXT chapters are the raw text (import-book textChapters), no document layer.
 assertAligned({text:'第一章 开始\n| 表 | 格 |\n----\n正文一句。'},'txt');

 // Narration: silent markup keeps its length (offsets stay valid) and is not voiced.
 const table='| 甲 | 乙 |\n| --- | --- |\n正文 **一句**。';
 assert.equal(speakableText(table).length,table.length);
 assert.ok(!/[|*]|--/.test(speakableText(table)));
 assert.equal(speakableText('COVID-19 与 2026-09-30'),'COVID-19 与 2026-09-30','single hyphens are words, not markup');
 assert.ok(!hasSpeech('| --- | --- |')&&!hasSpeech('======')&&hasSpeech('甲'));
 const groups=narrationGroups(table);
 assert.ok(groups.every(g=>hasSpeech(g.text)),'symbol-only sentences are skipped');
 assert.ok(!groups.some(g=>/^[|\s-]+$/.test(g.text)));

 // Estimated cursor: markup takes no time, so halfway through the audio is
 // halfway through the WORDS, not ahead of the voice.
 const plain='甲乙丙丁戊己庚辛',marked='甲乙丙丁戊己庚辛\n| --- | --- | --- |';
 const at=text=>text.slice(0,estimatedSpeechOffset(text,0,5,10)).replace(/[^\p{L}]/gu,'');
 assert.equal(at(marked),at(plain),'symbols must not push the highlight ahead of speech');

 console.log('PASS: Markdown/HTML/EPUB ruby/DOCX/TXT keep highlight offsets aligned with narration; Markdown syntax, rules, tables and annotations are never voiced; silent markup takes no estimated time.');
})().catch(e=>{console.error(e);process.exit(1);});
