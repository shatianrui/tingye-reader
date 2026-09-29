import 'server-only';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';

const bucket=process.env.S3_BUCKET||'tingye-books';
const credentials=()=>{
 const accessKeyId=process.env.S3_ACCESS_KEY;
 const secretAccessKey=process.env.S3_SECRET_KEY;
 if(!accessKeyId||!secretAccessKey)throw new Error('云端备份尚未配置。');
 return {accessKeyId,secretAccessKey};
};
const client=(endpoint:string)=>new S3Client({
 endpoint,
 region:process.env.S3_REGION||'us-east-1',
 credentials:credentials(),
 forcePathStyle:true,
 requestChecksumCalculation:'WHEN_REQUIRED',
});
const internal=()=>client(process.env.S3_ENDPOINT||'http://minio:9000');
const external=()=>client(process.env.S3_PUBLIC_ENDPOINT||process.env.APP_ORIGIN||'http://localhost:9000');
type Result<T>={data:T;error:null}|{data:null;error:Error};
const success=<T>(data:T):Result<T>=>({data,error:null});
const failure=<T>(error:unknown):Result<T>=>({data:null,error:error instanceof Error?error:new Error('Storage operation failed')});

export function storage(){return {
 async createSignedUrl(path:string,expiresIn:number){
  try{return success({signedUrl:await getSignedUrl(external(),new GetObjectCommand({Bucket:bucket,Key:path}),{expiresIn})});}
  catch(error){return failure<{signedUrl:string}>(error);}
 },
 async createSignedUploadUrl(path:string){
  try{
   const {PutObjectCommand}=await import('@aws-sdk/client-s3');
   return success({signedUrl:await getSignedUrl(external(),new PutObjectCommand({Bucket:bucket,Key:path,ContentType:'application/json'}),{expiresIn:7200})});
  }catch(error){return failure<{signedUrl:string}>(error);}
 },
 async download(path:string){
  try{
   const response=await internal().send(new GetObjectCommand({Bucket:bucket,Key:path}));
   if(!response.Body)throw new Error('Backup object is empty');
   const bytes=await response.Body.transformToByteArray();
   return success(new Blob([Buffer.from(bytes)],{type:response.ContentType||'application/json'}));
  }catch(error){return failure<Blob>(error);}
 },
 async remove(paths:string[]){
  if(!paths.length)return success<string[]>([]);
  try{
   const response=await internal().send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:paths.map(Key=>({Key})),Quiet:true}}));
   if(response.Errors?.length)throw new Error('Some backup objects could not be removed');
   return success(paths);
  }catch(error){return failure<string[]>(error);}
 },
};}
