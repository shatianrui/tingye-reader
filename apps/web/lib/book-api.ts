import {requestUser} from './auth';
import {samples} from './books';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
/** V1 is retired: older clients must never publish incomplete metadata or progress. */
export async function handle(req:Request){
 const user=await requestUser(req);if(!user)return json({error:'请先登录。'},401);
 if(req.method==='GET'){
  const id=new URL(req.url).searchParams.get('id');
  if(!id)return json({books:[],account:{userId:user.userId,username:user.username},snapshotAt:Date.now(),upgradeRequired:true});
  const sample=samples.find(b=>b.id===id);if(sample)return json(sample);
 }
 return json({error:'旧版备份已停用。请安装新版 App，选择“上传本机备份”或“从云端还原”。本机书籍不会删除。',code:'BACKUP_UPGRADE_REQUIRED'},426);
}
