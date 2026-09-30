import 'server-only';
import {DeleteObjectsCommand,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {storageBucket,storageClient} from './server-config.mjs';
import {readBoundedBody} from './bounded-body';

const bucket=storageBucket();
let privateClient:ReturnType<typeof storageClient>|undefined,publicClient:ReturnType<typeof storageClient>|undefined;
const internal=()=>privateClient??=storageClient();
const external=()=>publicClient??=storageClient(true);
export const publishedPath=(path:string)=>path.replace(/\.json$/,'.verified.json');
type Result<T>={data:T;error:null}|{data:null;error:Error};
const success=<T>(data:T):Result<T>=>({data,error:null});
const failure=<T>(error:unknown):Result<T>=>({data:null,error:error instanceof Error?error:new Error('Storage operation failed')});

export function storage(){return {
 async createSignedUrl(path:string,expiresIn:number){
  try{return success({signedUrl:await getSignedUrl(external(),new GetObjectCommand({Bucket:bucket,Key:path}),{expiresIn})});}
  catch(error){return failure<{signedUrl:string}>(error);}
 },
 async createSignedUploadUrl(path:string,bytes:number,sha256:string){
  try{
   if(!Number.isSafeInteger(bytes)||bytes<1||bytes>50*1024*1024||!/^[a-f0-9]{64}$/.test(sha256))throw new Error('Invalid upload reservation');
   return success({signedUrl:await getSignedUrl(external(),new PutObjectCommand({Bucket:bucket,Key:path,ContentType:'application/json',ContentLength:bytes,ChecksumSHA256:Buffer.from(sha256,'hex').toString('base64')}),{expiresIn:7200})});
  }catch(error){return failure<{signedUrl:string}>(error);}
 },
 async download(path:string,maxBytes:number){
  try{
   const response=await internal().send(new GetObjectCommand({Bucket:bucket,Key:path}),{abortSignal:AbortSignal.timeout(120000)});
   if(!response.Body)throw new Error('Backup object is empty');
   return success(await readBoundedBody(response.Body as AsyncIterable<Uint8Array>,maxBytes,response.ContentLength));
  }catch(error){return failure<Buffer>(error);}
 },
 async publish(path:string,data:Buffer,sha256:string){
  try{
   await internal().send(new PutObjectCommand({Bucket:bucket,Key:path,Body:data,ContentType:'application/json',ContentLength:data.byteLength,ChecksumSHA256:Buffer.from(sha256,'hex').toString('base64')}),{abortSignal:AbortSignal.timeout(120000)});
   return success(path);
  }catch(error){return failure<string>(error);}
 },
 async remove(paths:string[]){
  if(!paths.length)return success<string[]>([]);
  try{
   for(let offset=0;offset<paths.length;offset+=1000){
    const response=await internal().send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:paths.slice(offset,offset+1000).map(Key=>({Key})),Quiet:true}}),{abortSignal:AbortSignal.timeout(30000)});
    if(response.Errors?.length)throw new Error('Some backup objects could not be removed');
   }
   return success(paths);
  }catch(error){return failure<string[]>(error);}
 },
};}
