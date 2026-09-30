import postgres from 'postgres';
import {databaseUrl,databaseOptions,storageBucket,storageClient} from '../lib/server-config.mjs';
import {cleanup} from '../lib/cleanup.mjs';

const sql=postgres(databaseUrl(),databaseOptions(1));
try{
 const result=await cleanup(sql,storageClient(),storageBucket(),{apply:process.argv.includes('--apply')});
 console.log(JSON.stringify(result));
 if(!result.apply)console.log('Dry run only. Pass --apply to remove expired data.');
}finally{await sql.end();}
