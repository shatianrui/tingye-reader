import certificates from '../db/supabase-ca.json' with {type:'json'};
const {ca}=certificates;
import 'server-only';
import postgres from 'postgres';
let client: ReturnType<typeof postgres> | undefined;
export function db() {
 const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;
 if(!url)throw new Error('账号服务尚未配置完成。');
 return client??=postgres(url,{max:3,prepare:false,idle_timeout:20,connect_timeout:15,ssl:{rejectUnauthorized:true,ca}});
}
