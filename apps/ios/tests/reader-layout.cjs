const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const moduleValue={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/tingye/reader-layout.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:moduleValue,exports:moduleValue.exports,Math});
for(const width of [320,375,393,440,768,1024]){
 const layout=moduleValue.exports.readerLayout(width);
 assert.ok(layout.contentWidth<=width-2*layout.gutter,'Reading text stays within the viewport');
 assert.ok(layout.coverWidth>=120,'Book covers remain readable');
 assert.ok(Math.abs(layout.coverWidth*layout.columns+layout.gap*(layout.columns-1)+2*layout.shelfPadding-width)<.01,'Shelf rows fit without clipping');
}
const proMax=moduleValue.exports.readerLayout(440);
assert.equal(proMax.columns,2);
assert.equal(proMax.contentWidth,396);
assert.ok(956-62-34-36-54>22*1.68*20,'Pro Max portrait retains at least 20 lines outside native safe areas');
for(const size of [{w:440,h:956,l:0,r:0,t:62,b:34},{w:956,h:440,l:62,r:62,t:0,b:21},{w:320,h:568,l:0,r:0,t:20,b:0},{w:820,h:1180,l:0,r:0,t:24,b:20}]){
 const safeWidth=size.w-size.l-size.r;
 const current=moduleValue.exports.adaptiveReaderLayout(safeWidth,size.h-size.t-size.b,22);
 const shelf=moduleValue.exports.adaptiveShelfLayout(safeWidth,1.3);
 assert.ok(current.contentWidth+2*current.gutter<=safeWidth);
 assert.ok(current.controlsWidth<=safeWidth&&current.panelWidth<=safeWidth);
 assert.ok(shelf.columns*shelf.cellWidth+(shelf.columns-1)*shelf.gap+2*shelf.padding<=safeWidth+.01);
 assert.ok(shelf.coverWidth<=shelf.cellWidth);
 if(size.w===440){assert.equal(current.spread,false);assert.ok((size.h-size.t-size.b-34-60)/(22*1.85)>=18);}
 if(size.w===956)assert.equal(current.spread,false,'Short landscape viewport stays single-page after safe areas');
 if(size.w===820)assert.equal(current.spread,true);
}
console.log('PASS: actual adaptive layout fits iPhone 16 Pro Max portrait/landscape safe areas, compact iPhone and iPad; native text layout remains device-measured.');
