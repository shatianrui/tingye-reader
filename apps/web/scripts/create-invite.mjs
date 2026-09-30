import postgres from 'postgres';
import {databaseUrl,databaseOptions} from '../lib/server-config.mjs';
import {randomBytes,createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const target=process.argv[2];if(!target)throw new Error('Usage: npm run invite:create -- PRIVATE_OUTPUT_FILE');
const sql=postgres(databaseUrl(),databaseOptions(1));
const invite=randomBytes(32).toString('hex');
try{await sql`insert into tingye.invites(digest,expires_at) values(${createHash('sha256').update(invite).digest('hex')},now()+interval '7 days')`;await writeFile(target,invite+'\n',{flag:'wx',mode:0o600});console.log('Single-use invite saved to the specified private file (expires in 7 days).');}finally{await sql.end();}
