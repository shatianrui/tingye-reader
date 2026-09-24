import postgres from 'postgres';
import {readFile,readdir} from 'node:fs/promises';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;
if(!url||!process.env.S3_ACCESS_KEY||!process.env.S3_SECRET_KEY)throw new Error('Database or storage configuration missing');
const sql=postgres(url,{ssl:process.env.DATABASE_SSL==='require'?'require':false,max:1,prepare:false});
try {
 const directory=new URL('../db/migrations/',import.meta.url);
 for(const file of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()){
  await sql.unsafe(await readFile(new URL(file,directory),'utf8'));
 }
 console.log('Account and library schema ready.');
}finally{await sql.end();}

const bucket=process.env.S3_BUCKET||'tingye-books';
const storage=new S3Client({
 endpoint:process.env.S3_ENDPOINT||'http://minio:9000',
 region:process.env.S3_REGION||'us-east-1',
 forcePathStyle:true,
 requestChecksumCalculation:'WHEN_REQUIRED',
 credentials:{accessKeyId:process.env.S3_ACCESS_KEY,secretAccessKey:process.env.S3_SECRET_KEY},
});
try{await storage.send(new HeadBucketCommand({Bucket:bucket}));}
catch{await storage.send(new CreateBucketCommand({Bucket:bucket}));}
console.log('Private S3-compatible book storage ready.');
