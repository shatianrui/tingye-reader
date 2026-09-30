import {S3Client} from '@aws-sdk/client-s3';

export function databaseUrl(){
 const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;
 if(!url)throw new Error('Database configuration missing');
 return url;
}
/** @returns {{ssl:'require'|false,max:number,prepare:false}} */
export function databaseOptions(max=3){
 return {ssl:process.env.DATABASE_SSL==='require'?'require':false,max,prepare:false};
}
export const storageBucket=()=>process.env.S3_BUCKET||'tingye-books';
export function storageClient(external=false){
 const accessKeyId=process.env.S3_ACCESS_KEY,secretAccessKey=process.env.S3_SECRET_KEY;
 if(!accessKeyId||!secretAccessKey)throw new Error('Storage configuration missing');
 return new S3Client({
  endpoint:external?(process.env.S3_PUBLIC_ENDPOINT||process.env.APP_ORIGIN||'http://localhost:9000'):(process.env.S3_ENDPOINT||'http://minio:9000'),
  region:process.env.S3_REGION||'us-east-1',credentials:{accessKeyId,secretAccessKey},
  forcePathStyle:true,requestChecksumCalculation:'WHEN_REQUIRED',
 });
}
