import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBook} from '../../lib/book-validation';
const base={id:'12345678-1234-1234-1234-123456789abc',title:'带封面和插图的书',author:'我的导入',format:'EPUB'};
const picture={title:'封面',text:'',document:{html:'<img src="tingye-resource:r0">',css:'',path:'cover.xhtml'}};
test('native EPUB image-only cover and blank pages retain chapter indices during backup validation',()=>{
 const chapters=[picture,{title:'正文',text:'第一句。第二句。'},{title:'留白页',text:' \n'},{title:'下一章',text:'继续阅读。'}];
 const result=validateBook({...base,chapters});
 assert.deepEqual(result.chapters,chapters.map(({title,text})=>({title,text})));
 assert.equal(result.chapters[1].text,'第一句。第二句。');
 assert.equal(result.chapters[3].title,'下一章');
 assert.equal('document' in result.chapters[0],false,'text-only web projection must not start rendering untrusted HTML');
});
test('image-only EPUB and scanned PDF are valid even without extracted speech text',()=>{
 assert.equal(validateBook({...base,chapters:[picture]}).chapters.length,1);
 assert.equal(validateBook({...base,chapters:[{title:'SVG',text:'',document:{html:'<svg><rect width="10" height="10"/></svg>'}}]}).chapters.length,1);
 assert.equal(validateBook({...base,format:'PDF',pdf:'JVBERi0xLjQK',chapters:[{title:'第 1 页',text:''},{title:'第 2 页',text:''}]}).chapters.length,2);
});
test('malformed or genuinely empty books remain explicit validation errors, not network errors',()=>{
 for(const value of [
  {...base,chapters:[]},
  {...base,chapters:[{title:'空书',text:''}]},
  {...base,chapters:[{title:'a',text:7}]},
  {...base,chapters:[null]},
  {...base,chapters:[{title:'a'.repeat(201),text:'正文'}]},
  {...base,chapters:[{title:'a',text:'a'.repeat(4000001)}]},
  {...base,chapters:Array.from({length:3001},()=>({title:'a',text:'正文'}))},
  {...base,id:'invalid',chapters:[{title:'a',text:'正文'}]},
 ])assert.throws(()=>validateBook(value),{name:'BookValidationError'});
});
