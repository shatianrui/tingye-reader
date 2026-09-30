import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import * as s3 from '@aws-sdk/client-s3';
import * as presigner from '@aws-sdk/s3-request-presigner';
import * as validation from '../../lib/book-validation';
import {readBoundedBody} from '../../lib/bounded-body';

function load<T>(file:string,modules:Record<string,unknown>):T{
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Response,URL,Buffer,AbortSignal,console:{warn(){}},require:(name:string)=>{if(name in modules)return modules[name];throw Error(name);}});
 return module.exports as T;
}
const book={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'Test',author:'Author',format:'TXT',chapters:[{title:'One',text:'A sentence.'}]};
const uploadId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const payload=Buffer.from(JSON.stringify({format:'tingye-backup',version:2,book,progress:{chapter:0,position:1,updatedAt:123}}));
const digest=crypto.createHash('sha256').update(payload).digest('hex');
const tempPath=`user/v2/${book.id}/${uploadId}.json`;

function api(){
 let saved:Record<string,unknown>|undefined,active=true;
 const upload={id:uploadId,book_id:book.id,object_path:tempPath,object_size:payload.length,sha256:digest,base_revision:null};
 const published:{path:string;data:Buffer}[]=[],removedMarkers:string[]=[];
 const files={
  remove:async(_paths:string[])=>({error:null}),
  download:async(_path:string,limit:number)=>{assert.equal(limit,upload.object_size);return {data:payload,error:null as Error|null};},
  publish:async(path:string,data:Buffer)=>{published.push({path,data});return {data:path,error:null as Error|null};},
 };
 const query=async(parts:TemplateStringsArray,...args:unknown[])=>{
  const q=parts.join('?');
  if(q.startsWith('select * from tingye.backups'))return saved?[saved]:[];
  if(q.startsWith('select * from tingye.backup_uploads'))return active?[upload]:[];
  if(q.startsWith('select id from tingye.accounts'))return [{id:'user'}];
  if(q.startsWith('select id from tingye.backup_uploads'))return active?[{id:uploadId}]:[];
  if(q.startsWith('select revision,object_path from tingye.backups'))return [];
  if(q.startsWith('insert into tingye.backup_garbage'))return [];
  if(q.startsWith('insert into tingye.backups')){
   const columns=['user_id','id','revision','title','author','format','color','object_path','object_size','sha256','chapter','position','progress_updated_at'];
   saved=Object.fromEntries(columns.map((column,i)=>[column,args[i]]));saved.backup_at=new Date().toISOString();return [saved];
  }
  if(q.startsWith('delete from tingye.backup_uploads')){active=false;return [];}
  if(q.startsWith('delete from tingye.backup_garbage')){removedMarkers.push(String(args[0]));return [];}
  throw Error('Unexpected SQL: '+q);
 };
 const sql=Object.assign(query,{begin:async(callback:(tx:typeof query)=>unknown)=>callback(query)});
 class AuthError extends Error{constructor(message:string,readonly status=400){super(message);}}
 const {handleBackup}=load<{handleBackup:(req:Request)=>Promise<Response>}>('lib/backup-api.ts',{
  'node:crypto':crypto,'./db':{db:()=>sql},'./auth':{AuthError,requestUser:async()=>({userId:'user',username:'test'}),sameOrigin(){}},
  './storage':{storage:()=>files,publishedPath:(path:string)=>path.replace(/\.json$/,'.verified.json')},'./book-validation':validation,
 });
 const complete=()=>handleBackup(new Request('https://test/api/backups',{method:'POST',body:JSON.stringify({action:'complete',uploadId})}));
 return {complete,files,upload,published,removedMarkers,saved:()=>saved};
}

test('completion publishes verified bytes under a separate immutable key and is idempotent',async()=>{
 const state=api();const first=await state.complete();assert.equal(first.status,200);
 assert.equal(state.published.length,1);assert.deepEqual(state.published[0].data,payload);
 assert.notEqual(state.saved()?.object_path,tempPath);
 assert.deepEqual(state.removedMarkers,[state.saved()?.object_path]); // Staging marker survives PUT URL reuse.
 const again=await state.complete();assert.equal(again.status,200);
 assert.deepEqual(await again.json(),await first.json());assert.equal(state.published.length,1);
});
test('invalid bytes and failed publication never create a completed backup',async()=>{
 const corrupt=api();corrupt.upload.sha256='0'.repeat(64);
 assert.equal((await corrupt.complete()).status,400);assert.equal(corrupt.published.length,0);
 const short=api();short.upload.object_size++;
 assert.equal((await short.complete()).status,400);assert.equal(short.published.length,0);
 const unavailable=api();unavailable.files.publish=async()=>({data:'',error:Error('offline')});
 assert.equal((await unavailable.complete()).status,503);assert.equal(unavailable.saved(),undefined);
 unavailable.files.publish=async()=>({data:'published',error:null});
 assert.equal((await unavailable.complete()).status,200);
});
test('completion bounds concurrent validation and releases slots after failure',async()=>{
 const state=api();const release:((value:{data:typeof payload;error:Error|null})=>void)[]=[];
 state.files.download=()=>new Promise(resolve=>release.push(resolve));
 const first=state.complete(),second=state.complete();
 while(release.length<2)await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await state.complete()).status,429);
 for(const resolve of release)resolve({data:payload,error:Error('disconnected')});
 assert.equal((await first).status,503);assert.equal((await second).status,503);
 state.files.download=async()=>({data:payload,error:null});
 assert.equal((await state.complete()).status,200);
});
test('real S3 signer binds byte length and checksum without adding required client headers',async()=>{
 const client=new s3.S3Client({endpoint:'https://storage.test',region:'us-east-1',credentials:{accessKeyId:'test',secretAccessKey:'test'},forcePathStyle:true,requestChecksumCalculation:'WHEN_REQUIRED'});
 const {storage}=load<{storage:()=>{createSignedUploadUrl:(path:string,bytes:number,sha:string)=>Promise<{data:{signedUrl:string}|null;error:Error|null}>}}>('lib/storage.ts',{
  'server-only':{},'@aws-sdk/client-s3':s3,'@aws-sdk/s3-request-presigner':presigner,
  './server-config.mjs':{storageBucket:()=> 'books',storageClient:()=>client},'./bounded-body':{readBoundedBody},
 });
 const signed=await storage().createSignedUploadUrl(tempPath,payload.length,digest);assert.equal(signed.error,null);
 const url=new URL(signed.data!.signedUrl);
 assert.deepEqual(url.searchParams.get('X-Amz-SignedHeaders')?.split(';'),['content-length','host']);
 assert.equal(url.searchParams.get('x-amz-checksum-sha256'),Buffer.from(digest,'hex').toString('base64'));
 const wrong=await storage().createSignedUploadUrl(tempPath,payload.length+1,digest);
 assert.notEqual(url.searchParams.get('X-Amz-Signature'),new URL(wrong.data!.signedUrl).searchParams.get('X-Amz-Signature'));
 assert.ok((await storage().createSignedUploadUrl(tempPath,51*1024*1024,digest)).error);
 client.destroy();
});
