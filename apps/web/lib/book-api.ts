import {randomUUID} from 'node:crypto';
import {db} from './db';
import {AuthError,requestUser,sameOrigin,rateLimit} from './auth';
import {storage} from './storage';
import {metadata,validId,validateBook,BookValidationError} from './book-validation';
import {samples} from './books';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const clean=(row:Record<string,unknown>)=>({id:row.id,title:row.title,author:row.author,format:row.format,color:row.color,chapters:[],chapter:row.chapter,position:row.position,updatedAt:Number(row.progress_updated_at),backedUp:!!row.object_path});
export async function handle(req:Request){let stage='auth';try{
 const user=await requestUser(req);if(!user)return json({error:'请先登录。'},401);
 if(req.method!=='GET')sameOrigin(req);
 const sql=db(),uid=user.userId,id=new URL(req.url).searchParams.get('id');
 if(req.method==='GET'){
  stage=id?'download':'list';
  if(!id){const rows=await sql`select * from tingye.books where user_id=${uid} order by created_at desc limit 500`;return json({books:rows.map(clean),account:{userId:uid,username:user.username},snapshotAt:Date.now()});}
  if(!validId(id))throw new AuthError('无效书籍。');
  const rows=await sql`select * from tingye.books where user_id=${uid} and id=${id}`;
  const sample=samples.find(b=>b.id===id);if(sample)return json({...sample,...(rows[0]?{chapter:rows[0].chapter,position:rows[0].position,updatedAt:Number(rows[0].progress_updated_at)}:{})});
  const row=rows[0];if(!row)return json({error:'书籍不存在。'},404);
  if(!row.object_path)return json({error:'云端尚无这本书的正文。请先在原设备上传正文：新版 App 点“同步”，旧版点“云端备份”；再到此设备同步。'},409);
  const signed=await storage().createSignedUrl(row.object_path,60);if(signed.error)throw signed.error;
  return json({...clean(row),downloadUrl:signed.data.signedUrl});
 }
 if(req.method==='DELETE'){
  stage='delete';
  if(!validId(id)||id.startsWith('sample-'))throw new AuthError('请选择导入的书籍。');
  const rows=await sql`delete from tingye.books where user_id=${uid} and id=${id} returning object_path`;
  if(rows[0]?.object_path)await storage().remove([rows[0].object_path]);
  return json({ok:true});
 }
 stage='request';
 const raw=await req.text();if(raw.length>30000)throw new AuthError('请求过大。请通过备份入口上传正文。',413);
 const body=JSON.parse(raw);
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AuthError('请求须为 JSON 对象。');
 if(req.method==='PATCH'){
  stage='progress';
  if(!validId(body.id)||!Number.isInteger(body.chapter)||body.chapter<0||body.chapter>3000||!Number.isInteger(body.position)||body.position<0||body.position>4000000||!Number.isSafeInteger(body.updatedAt)||body.updatedAt<0||body.updatedAt>Date.now()+60000)throw new AuthError('进度无效。');
  const rows=await sql`update tingye.books set chapter=${body.chapter},position=${body.position},progress_updated_at=${body.updatedAt} where user_id=${uid} and id=${body.id} and progress_updated_at<${body.updatedAt} returning id`;
  return json({ok:true,updated:rows.length>0});
 }
 if(body.action==='backup-start'){
  stage='backup-start';
  if(!validId(body.id)||body.id.startsWith('sample-'))throw new AuthError('无效书籍。');
  // A single explicit shelf sync may contain up to 200 books. Keep an abuse
  // ceiling, but do not block normal multi-book sync after only three uploads.
  await rateLimit('uploads:'+uid,240,3600);
  const bytes=body.bytes===undefined?18*1024*1024:body.bytes;
  if(!Number.isSafeInteger(bytes)||bytes<1||bytes>18*1024*1024)throw new AuthError('单本云端正文上限为 18MB。');
  const book=await sql`select id from tingye.books where user_id=${uid} and id=${body.id}`;if(!book.length)throw new AuthError('请先保存书籍信息。');
  const uploadId=randomUUID(),path=`${uid}/${body.id}/${uploadId}.json`;
  await sql.begin(async tx=>{
   await tx`select id from tingye.accounts where id=${uid} for update`;
   const used=await tx`select coalesce(sum(object_size),0) as size from tingye.books where user_id=${uid}`;
   const pending=await tx`select count(*) as count from tingye.uploads where user_id=${uid} and expires_at>now()`;
   const current=await tx`select object_size from tingye.books where user_id=${uid} and id=${body.id}`;
   if(Math.max(0,Number(used[0].size)-Number(current[0]?.object_size||0))+Number(pending[0].count)*18*1024*1024+bytes>50*1024*1024)throw new AuthError('备份空间或待完成上传已达上限，请先完成上传或清理备份。');
   await tx`insert into tingye.uploads(id,user_id,book_id,object_path,expires_at) values(${uploadId},${uid},${body.id},${path},now()+interval '2 hours')`;
  });
  const signed=await storage().createSignedUploadUrl(path);
  if(signed.error){await sql`delete from tingye.uploads where id=${uploadId} and user_id=${uid}`;throw signed.error;}
  return json({uploadId,url:signed.data.signedUrl});
 }
 if(body.action==='backup-cancel'){
  stage='backup-cancel';
  if(typeof body.uploadId!=='string'||!/^[a-f0-9-]{36}$/.test(body.uploadId))throw new AuthError('无效上传。');
  const removed=await sql`delete from tingye.uploads where id=${body.uploadId} and user_id=${uid} returning object_path`;
  if(removed[0])await storage().remove([removed[0].object_path]);
  return json({ok:true});
 }
 if(body.action==='backup-complete'){
  stage='backup-complete';
  if(typeof body.uploadId!=='string'||!/^[a-f0-9-]{36}$/.test(body.uploadId))throw new AuthError('无效上传。');
  const rows=await sql`select * from tingye.uploads where id=${body.uploadId} and user_id=${uid} and expires_at>now()`;const upload=rows[0];if(!upload)throw new AuthError('上传凭证已过期，请重新备份。');
  const file=await storage().download(upload.object_path);if(file.error)throw file.error;
  if(file.data.size>18*1024*1024)throw new AuthError('备份文件过大。');
  const book=validateBook(JSON.parse(await file.data.text()));if(book.id!==upload.book_id)throw new AuthError('书籍不匹配。');
  let old:string|null=null;
  await sql.begin(async tx=>{
   await tx`select id from tingye.accounts where id=${uid} for update`;
   const current=await tx`select object_path from tingye.books where user_id=${uid} and id=${book.id}`;if(!current.length)throw new AuthError('书籍已被移除。');
   const sum=await tx`select coalesce(sum(object_size),0) as total from tingye.books where user_id=${uid} and id<>${book.id}`;if(Number(sum[0].total)+file.data.size>50*1024*1024)throw new AuthError('你的云端备份已达到 50MB 上限，请先移除不用的备份。');
   const consumed=await tx`delete from tingye.uploads where id=${body.uploadId} and user_id=${uid} returning id`;if(!consumed.length)throw new AuthError('上传凭证已使用。');
   old=current[0].object_path;await tx`update tingye.books set object_path=${upload.object_path},object_size=${file.data.size} where user_id=${uid} and id=${book.id}`;
  });
  if(old)await storage().remove([old]);return json({ok:true});
 }
 stage='metadata';
 const book=metadata(body);
 await sql.begin(async tx=>{
  await tx`select id from tingye.accounts where id=${uid} for update`;
  const count=await tx`select count(*) from tingye.books where user_id=${uid}`;
  const exists=await tx`select id from tingye.books where user_id=${uid} and id=${book.id}`;
  if(!exists.length&&Number(count[0].count)>=200)throw new AuthError('书架最多支持 200 本书。');
  await tx`insert into tingye.books(user_id,id,title,author,format,color) values(${uid},${book.id},${book.title},${book.author},${book.format},${book.color}) on conflict(user_id,id) do update set title=excluded.title,author=excluded.author,format=excluded.format,color=excluded.color`;
 });return json({ok:true});
 }catch(e){
  if(e instanceof AuthError)return json({error:e.message},e.status);
  if(e instanceof BookValidationError)return json({error:e.message,code:e.code,stage},422);
  if(e instanceof SyntaxError)return json({error:'请求或备份文件不是有效的 JSON。',code:'BOOK_INVALID_JSON',stage},400);
  // Never log request bodies, book titles, signed URLs, tokens or raw SDK errors.
  console.warn('book-api failure',{stage});
  const label:Record<string,string>={auth:'账号校验',list:'书架读取',download:'正文下载地址获取',delete:'云端删除',progress:'进度保存',metadata:'书目信息保存','backup-start':'上传地址获取','backup-complete':'上传后的正文确认','backup-cancel':'取消上传'};
  const code='BOOK_'+stage.replaceAll('-','_').toUpperCase()+'_FAILED';
  return json({error:`${label[stage]||'云端处理'}暂时失败，请稍后重试（${code}）。本机书籍不受影响。`,code,stage},503);
 }}
