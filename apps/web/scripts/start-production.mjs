import {spawnSync} from 'node:child_process';

const migration=spawnSync(process.execPath,['scripts/migrate.mjs'],{stdio:'inherit',env:process.env});
if(migration.status!==0)process.exit(migration.status??1);
await import('../server.js');
