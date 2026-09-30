import 'server-only';
import postgres from 'postgres';
import {databaseUrl,databaseOptions} from './server-config.mjs';
let client: ReturnType<typeof postgres> | undefined;
export function db() {
 return client??=postgres(databaseUrl(),{...databaseOptions(),idle_timeout:20,connect_timeout:15});
}
