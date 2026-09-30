import postgres from 'postgres';
import {databaseUrl,databaseOptions,storageBucket,storageClient} from '../lib/server-config.mjs';
import {readFile,readdir} from 'node:fs/promises';
import {
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

const sql=postgres(databaseUrl(),databaseOptions(1));
try {
 const directory=new URL('../db/migrations/',import.meta.url);
 for(const file of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()){
  await sql.unsafe(await readFile(new URL(file,directory),'utf8'));
 }
 console.log('Account and library schema ready.');
}finally{await sql.end();}

const bucket=storageBucket(),storage=storageClient();
try{await storage.send(new HeadBucketCommand({Bucket:bucket}));}
catch{await storage.send(new CreateBucketCommand({Bucket:bucket}));}
console.log('Private S3-compatible book storage ready.');
