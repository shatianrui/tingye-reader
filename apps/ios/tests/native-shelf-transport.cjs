const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('src/tingye/native-library.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const calls=[],m={exports:{}};let owner='userA',sessionOwner='userA';
vm.runInNewContext(code,{module:m,exports:m.exports,Headers,URL,Date,AbortSignal,require:name=>{
 if(name==='@react-native-async-storage/async-storage')return{getItem:async()=>null,setItem:async()=>{}};
 if(name==='expo-file-system')return{Directory:class{create(){}},File:class{},Paths:{document:'documents'}};
 if(name==='expo/fetch')return{fetch:async()=>{throw Error('Unexpected object transfer');}};
 if(name==='./client')return{session:()=>({user:{userId:sessionOwner}}),api:async(path,options)=>{calls.push({path,options});return{books:[],account:{userId:owner,username:'test'}};}};
 if(name==='./cover-cache')return{createCoverCache:()=>({migrate:async x=>x})};
 if(name==='./library')return{createLibrary:(storage,remote,transfer)=>({remote,transfer})};
 throw Error(name);
}});
(async()=>{
 const shelf=m.exports.nativeLibrary('userA');
 await shelf.remote('/api/books');await shelf.remote('/api/books');
 assert.notEqual(calls[0].path,calls[1].path);assert.ok(calls[0].path.startsWith('/api/books?_sync='));assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.headers.get('Cache-Control'),'no-cache');
 await shelf.remote('/api/books?id=book1');assert.ok(calls[2].path.startsWith('/api/books?id=book1&_sync='));
 await shelf.remote('/api/books',{method:'POST',body:'{}'});assert.equal(calls[3].path,'/api/books');
 owner='userB';await assert.rejects(shelf.remote('/api/books'),/账号与本机书架不一致/);
 const count=calls.length;sessionOwner='userB';await assert.rejects(shelf.remote('/api/books'),/请登录此书架的账号/);assert.equal(calls.length,count);
 console.log('PASS: native shelf reads use fresh URLs/no-store, preserve queries, reject wrong cloud owner and local account switches.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
