import certificates from '../db/supabase-ca.json' with {type:'json'};
const {ca}=certificates;
import postgres from 'postgres';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;
if(!url||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Database or storage configuration missing');
const sql=postgres(url,{ssl:{rejectUnauthorized:true,ca},max:1,prepare:false});
try {await sql.unsafe(await readFile(new URL('../db/migrations/001_accounts.sql',import.meta.url),'utf8'));console.log('Account and library schema ready.');}finally{await sql.end();}
const storage=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY).storage;
const existing=await storage.getBucket('tingye-books');
if(existing.error){const result=await storage.createBucket('tingye-books',{public:false,fileSizeLimit:18*1024*1024,allowedMimeTypes:['application/json']});if(result.error)throw result.error;}
else if(existing.data.public)throw new Error('Book bucket must be private');
console.log('Private book storage ready.');
