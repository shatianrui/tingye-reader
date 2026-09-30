import {DeleteObjectsCommand} from '@aws-sdk/client-s3';

// A failed storage delete must leave its database marker available for retry.
export async function cleanup(sql,files,bucket,{apply=false}={}){
 const expired=await sql`select object_path from tingye.backup_uploads u where expires_at<now() and not exists(select 1 from tingye.backups b where b.object_path=u.object_path)`;
 const garbage=await sql`select object_path from tingye.backup_garbage g where retire_at<now() and not exists(select 1 from tingye.backups b where b.object_path=g.object_path) and not exists(select 1 from tingye.backup_uploads u where u.object_path=g.object_path and u.expires_at>now())`;
 const abandoned=await sql`select u.object_path from tingye.uploads u where u.expires_at<now()-interval '1 hour' and not exists(select 1 from tingye.books b where b.object_path=u.object_path)`;
 const paths=[...new Set([...expired,...garbage,...abandoned].map(row=>row.object_path))];
 if(!apply)return {apply:false,objects:paths.length};
 for(let offset=0;offset<paths.length;offset+=1000){
  const batch=paths.slice(offset,offset+1000);
  const result=await files.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:batch.map(Key=>({Key})),Quiet:true}}),{abortSignal:AbortSignal.timeout(30000)});
  if(result.Errors?.length)throw Error('Object cleanup failed; database markers retained for retry');
  await sql`delete from tingye.backup_uploads where expires_at<now() and object_path in ${sql(batch)}`;
  await sql`delete from tingye.backup_garbage where retire_at<now() and object_path in ${sql(batch)}`;
  await sql`delete from tingye.uploads where expires_at<now()-interval '1 hour' and object_path in ${sql(batch)}`;
 }
 await sql`delete from tingye.sessions where expires_at<now()`;
 await sql`delete from tingye.rate_limits where expires_at<now()-interval '1 day'`;
 await sql`delete from tingye.invites where expires_at<now() or used_at<now()-interval '1 day'`;
 return {apply:true,objects:paths.length};
}
