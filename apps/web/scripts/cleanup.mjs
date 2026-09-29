import certificates from '../db/supabase-ca.json' with {type:'json'};
const {ca}=certificates;
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
const sql=postgres(process.env.DATABASE_URL||process.env.POSTGRES_URL,{ssl:{rejectUnauthorized:true,ca},max:1,prepare:false});
const files=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY).storage.from('tingye-books');
try{
 const expired=await sql`delete from tingye.backup_uploads where expires_at<now() returning object_path`;
 for(const row of expired){const result=await files.remove([row.object_path]);if(result.error)throw result.error;}
 const garbage=await sql`select object_path from tingye.backup_garbage where retire_at<now()`;
 for(const row of garbage){const result=await files.remove([row.object_path]);if(result.error)throw result.error;await sql`delete from tingye.backup_garbage where object_path=${row.object_path}`;}
 const abandoned=await sql`select u.id,u.object_path from tingye.uploads u where u.expires_at<now()-interval '1 hour' and not exists(select 1 from tingye.books b where b.object_path=u.object_path)`;
 for(const row of abandoned){const result=await files.remove([row.object_path]);if(result.error)throw result.error;await sql`delete from tingye.uploads where id=${row.id}`;}
 await sql`delete from tingye.sessions where expires_at<now()`;
 await sql`delete from tingye.rate_limits where expires_at<now()-interval '1 day'`;
 await sql`delete from tingye.invites where expires_at<now() or used_at<now()-interval '1 day'`;
 console.log('Expired sessions, limits, invites and abandoned uploads cleaned.');
}finally{await sql.end();}
