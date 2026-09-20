import 'server-only';
import {createClient} from '@supabase/supabase-js';
export function storage(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('云端备份尚未配置。');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from('tingye-books');}
