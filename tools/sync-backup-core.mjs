import fs from 'node:fs';
const root=new URL('../',import.meta.url);
for(const [from,to] of [['core.ts','backup-core.ts'],['sha256.ts','backup-sha256.ts']]){
 const source=fs.readFileSync(new URL('packages/backup-core/'+from,root));
 for(const directory of ['apps/android/src/tingye/','apps/ios/src/tingye/','apps/web/lib/']){
  const target=new URL(directory+to,root);
  if(process.argv.includes('--check')){if(!fs.existsSync(target)||!source.equals(fs.readFileSync(target)))throw Error('Backup engine differs: '+directory+to);}
  else fs.writeFileSync(target,source);
 }
}
console.log('Backup engine synchronized across Android, iOS and web.');
