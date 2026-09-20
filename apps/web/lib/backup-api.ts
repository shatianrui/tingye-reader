import {createHash,randomUUID} from 'node:crypto';
import {db} from './db';
import {AuthError,requestUser,sameOrigin,rateLimit} from './auth';
import {storage} from './storage';
import {validId,validateBook,BookValidationError} from './book-validation';

const MAX_BOOK=50*1024*1024,MAX_ACCOUNT=500*1024*1024;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const uuid=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
const receipt=(r:Record<string,unknown>)=>({id:r.id,title:r.title,author:r.author,format:r.format,color:r.color,chapters:[],chapter:r.chapter,position:r.position,updatedAt:Number(r.progress_updated_at),revision:r.revision,bytes:Number(r.object_size),sha256:r.sha256,backupAt:new Date(r.backup_at as string).getTime(),backedUp:true});
export function validateSnapshot(value:unknown){
 const packet=value as {format?:unknown;version?:unknown;book?:unknown;progress?:{chapter:number;position:number;updatedAt:number}};
 if(!packet||packet.format!=='tingye-backup'||packet.version!==2)throw new BookValidationError('不支持的备份格式，请更新 App 后重新上传。');
 const book=validateBook(packet.book),p=packet.progress;
 if(!p||!Number.isInteger(p.chapter)||p.chapter<0||p.chapter>=book.chapters.length||!Number.isInteger(p.position)||p.position<0||p.position>4000000||!Number.isSafeInteger(p.updatedAt)||p.updatedAt<0)throw new BookValidationError('备份的阅读位置无效。');
 return {book,progress:p};
}
export async function handleBackup(req:Request){let stage='auth';try{
 const user=await requestUser(req);if(!user)return json({error:'请先登录。'},401);
 if(req.method!=='GET')sameOrigin(req);
 const sql=db(),uid=user.userId,id=new URL(req.url).searchParams.get('id');
 if(req.method==='GET'){
  stage='list';
  if(!id){const rows=await sql`select * from tingye.backups where user_id=${uid} order by backup_at desc`;return json({protocol:2,books:rows.map(receipt),account:{userId:uid,username:user.username},limits:{bookBytes:MAX_BOOK,accountBytes:MAX_ACCOUNT}});}
  if(!validId(id))throw new AuthError('书籍标识无效。');
  stage='download';const rows=await sql`select * from tingye.backups where user_id=${uid} and id=${id}`;
  if(!rows[0])return json({error:'这本书没有完整的云端备份，请在有原书的设备上传。'},404);
  const signed=await storage().createSignedUrl(rows[0].object_path,120);if(signed.error)throw signed.error;
  return json({...receipt(rows[0]),downloadUrl:signed.data.signedUrl,account:{userId:uid,username:user.username}});
 }
 if(req.method==='DELETE'){
  stage='delete';if(!validId(id)||id.startsWith('sample-'))throw new AuthError('书籍标识无效。');
  const paths=await sql.begin(async tx=>{
   await tx`select id from tingye.accounts where id=${uid} for update`;
   const backups=await tx`delete from tingye.backups where user_id=${uid} and id=${id} returning object_path`;
   const pending=await tx`delete from tingye.backup_uploads where user_id=${uid} and book_id=${id} returning object_path`;
   for(const row of [...backups,...pending])await tx`insert into tingye.backup_garbage(object_path,user_id,retire_at) values(${row.object_path},${uid},now()+interval '1 day') on conflict do nothing`;
   return [...backups,...pending].map(r=>r.object_path as string);
  });
  if(paths.length){const removed=await storage().remove(paths);if(removed.error)throw removed.error;}
  return json({ok:true});
 }
 const text=await req.text();if(text.length>8000)throw new AuthError('请求过大。',413);const body=JSON.parse(text);
 if(!body||typeof body!=='object')throw new AuthError('请求无效。');
 if(body.action==='start'){
  stage='start';if(!validId(body.id)||body.id.startsWith('sample-')||!Number.isSafeInteger(body.bytes)||body.bytes<1||body.bytes>MAX_BOOK||typeof body.sha256!=='string'||!/^[a-f0-9]{64}$/.test(body.sha256)||(body.expectedRevision!==null&&!uuid(body.expectedRevision)))throw new AuthError('备份信息无效，单本完整备份上限为 50MB。');
  await rateLimit('backup-v2:'+uid,240,3600);
  const garbage=await sql`select object_path from tingye.backup_garbage where user_id=${uid} and retire_at<now() limit 100`;
  if(garbage.length){const removed=await storage().remove(garbage.map(r=>r.object_path));if(!removed.error)await sql`delete from tingye.backup_garbage where user_id=${uid} and object_path in ${sql(garbage.map(r=>r.object_path))}`;}
  const uploadId=randomUUID(),path=`${uid}/v2/${body.id}/${uploadId}.json`;
  await sql.begin(async tx=>{
   await tx`select id from tingye.accounts where id=${uid} for update`;
   const current=await tx`select revision,object_size from tingye.backups where user_id=${uid} and id=${body.id}`;
   if(current[0]&&current[0].revision!==body.expectedRevision)throw new AuthError('云端已有更新的备份。请先下载还原，再继续阅读和上传，避免覆盖另一台设备的进度。',409);
   const usage=await tx`select coalesce(sum(object_size),0) as bytes,count(*) as count from tingye.backups where user_id=${uid}`;
   const pending=await tx`select coalesce(sum(object_size),0) as bytes from tingye.backup_uploads where user_id=${uid} and expires_at>now()`;
   if(!current.length&&Number(usage[0].count)>=200)throw new AuthError('最多可备份 200 本书。');
   if(Number(usage[0].bytes)+Number(pending[0].bytes)+body.bytes>MAX_ACCOUNT)throw new AuthError('云端备份总容量超过 500MB，请移除不需要的备份。');
   await tx`insert into tingye.backup_uploads(id,user_id,book_id,base_revision,object_path,object_size,sha256,expires_at) values(${uploadId},${uid},${body.id},${current[0]?.revision||null},${path},${body.bytes},${body.sha256},now()+interval '2 hours')`;
   // Keep an orphan marker even if a cancelled PUT arrives after cancellation.
   await tx`insert into tingye.backup_garbage(object_path,user_id,retire_at) values(${path},${uid},now()+interval '1 day')`;
  });
  const signed=await storage().createSignedUploadUrl(path);
  if(signed.error){await sql`delete from tingye.backup_uploads where id=${uploadId} and user_id=${uid}`;throw signed.error;}
  return json({uploadId,url:signed.data.signedUrl});
 }
 if(!uuid(body.uploadId))throw new AuthError('上传标识无效。');
 if(body.action==='cancel'){
  stage='cancel';const rows=await sql`delete from tingye.backup_uploads where id=${body.uploadId} and user_id=${uid} returning object_path`;
  if(rows[0]){const removed=await storage().remove([rows[0].object_path]);if(removed.error)throw removed.error;}
  return json({ok:true});
 }
 if(body.action!=='complete')throw new AuthError('操作无效。');
 stage='complete';
 // Completion is idempotent after a lost HTTP response.
 const done=await sql`select * from tingye.backups where user_id=${uid} and revision=${body.uploadId}`;
 if(done[0])return json(receipt(done[0]));
 const pending=await sql`select * from tingye.backup_uploads where id=${body.uploadId} and user_id=${uid} and expires_at>now()`;
 const upload=pending[0];if(!upload)throw new AuthError('上传已过期或取消，请重新上传。');
 const file=await storage().download(upload.object_path);if(file.error)throw file.error;
 if(file.data.size!==Number(upload.object_size)||file.data.size>MAX_BOOK)throw new AuthError('备份大小校验失败，请重新上传。');
 const data=Buffer.from(await file.data.arrayBuffer());
 if(createHash('sha256').update(data).digest('hex')!==upload.sha256)throw new AuthError('备份内容校验失败，请重新上传。');
 const {book,progress}=validateSnapshot(JSON.parse(data.toString('utf8')));if(book.id!==upload.book_id)throw new AuthError('上传的书籍不匹配。');
 let old:string|undefined;
 const completed=await sql.begin(async tx=>{
  await tx`select id from tingye.accounts where id=${uid} for update`;
  const repeated=await tx`select * from tingye.backups where user_id=${uid} and revision=${body.uploadId}`;if(repeated[0])return repeated[0];
  const active=await tx`select id from tingye.backup_uploads where id=${body.uploadId} and user_id=${uid} and expires_at>now()`;if(!active.length)throw new AuthError('上传已取消，请重试。',409);
  const current=await tx`select revision,object_path from tingye.backups where user_id=${uid} and id=${book.id}`;
  if((current[0]?.revision||null)!==(upload.base_revision||null))throw new AuthError('另一台设备刚更新了备份，本次上传未覆盖云端。请先下载还原。',409);
  const saved=await tx`insert into tingye.backups(user_id,id,revision,title,author,format,color,object_path,object_size,sha256,chapter,position,progress_updated_at) values(${uid},${book.id},${body.uploadId},${book.title},${book.author},${book.format},${book.color||'green'},${upload.object_path},${upload.object_size},${upload.sha256},${progress.chapter},${progress.position},${progress.updatedAt}) on conflict(user_id,id) do update set revision=excluded.revision,title=excluded.title,author=excluded.author,format=excluded.format,color=excluded.color,object_path=excluded.object_path,object_size=excluded.object_size,sha256=excluded.sha256,chapter=excluded.chapter,position=excluded.position,progress_updated_at=excluded.progress_updated_at,backup_at=now() returning *`;
  await tx`delete from tingye.backup_uploads where id=${body.uploadId} and user_id=${uid}`;
  await tx`delete from tingye.backup_garbage where object_path=${upload.object_path} and user_id=${uid}`;
  old=current[0]?.object_path;if(old)await tx`insert into tingye.backup_garbage(object_path,user_id,retire_at) values(${old},${uid},now()+interval '10 minutes') on conflict do nothing`;return saved[0];
 });
 // Old immutable versions are retained until expiration cleanup, so an in-flight
 // restore's signed URL remains valid while another device publishes a new one.
 void old;
 return json(receipt(completed));
 }catch(e){
  if(e instanceof AuthError)return json({error:e.message},e.status);
  if(e instanceof BookValidationError)return json({error:e.message,code:e.code},422);
  if(e instanceof SyntaxError)return json({error:'备份 JSON 无效。'},400);
  console.warn('Backup operation failed',{stage});return json({error:'云端备份暂时不可用，请重试。本机书籍保留。',stage},503);
 }}
