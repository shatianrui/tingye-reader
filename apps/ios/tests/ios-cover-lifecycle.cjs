const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const load=require('./load-ts.cjs'),files=new Map();
class File {
 constructor(dir,name){this.name=name;this.uri=dir.uri+'/'+name;}
 get exists(){return files.has(this.uri);}
 write(value){files.set(this.uri,value);}
 delete(){files.delete(this.uri);}
}
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/tingye/cover-cache.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:id=>id==='expo-file-system'?{File}:load('src/tingye/'+id.slice(2)+'.ts')});
(async()=>{
 const directory={uri:'file:///Documents/new-install/books',list:()=>[]};
 const book={id:'existing',title:'Existing',author:'Author',format:'EPUB',cover:'r0',resources:{r0:'data:image/png;base64,YWJj'},chapters:[{title:'Text',text:'Text'}]};
 let reads=0;const cache=m.exports.createCoverCache(directory,async()=>{reads++;return book});
 const rows=[{...book,chapters:[],coverUri:'file:///Documents/old-install/books/existing.cover.png',coverChecked:true,coverCacheVersion:2,chapter:4,position:12}];
 await cache.migrate(rows);
 assert.ok(rows[0].coverUri.startsWith(directory.uri+'/'));assert.ok(files.has(rows[0].coverUri));assert.equal(rows[0].chapter,4);assert.equal(rows[0].position,12);
 const count=reads;await cache.migrate(rows);assert.equal(reads,count,'Valid relocated cache must not re-read whole books');
 const negative=[{...book,chapters:[],coverChecked:true,coverUri:undefined}];await cache.migrate(negative);
 assert.ok(negative[0].coverUri,'Old no-cover decisions must be rechecked on upgrade');
 console.log('PASS: iOS sandbox UUID relocation and stale no-cover migration restore actual artwork without resetting progress or re-reading healthy book files.');
})().catch(e=>{console.error(e);process.exitCode=1});
