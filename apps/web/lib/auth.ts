import 'server-only';
import {cookies} from 'next/headers';
import {randomUUID,createHmac} from 'node:crypto';
import {db} from './db';
import {hash,token,hashPassword,verifyPassword,username,password} from './passwords';
export const COOKIE='tingye_session';
export type User={userId:string;displayName:string;username:string};
export class AuthError extends Error {constructor(message:string,public status=400){super(message);}}
export async function requestUser(req?:Request):Promise<User|null>{
 const auth=req?.headers.get('authorization');const value=auth?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]??(!auth?(await cookies()).get(COOKIE)?.value:undefined);
 if(!value||!/^[a-f0-9]{64}$/.test(value))return null;
 const rows=await db()`select a.id,a.username from tingye.sessions s join tingye.accounts a on a.id=s.user_id where s.digest=${hash(value)} and s.expires_at>now()`;
 return rows[0]?{userId:rows[0].id,displayName:rows[0].username,username:rows[0].username}:null;
}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');const expected=new URL(process.env.APP_ORIGIN||req.url).origin;if((origin&&origin!==expected)||req.headers.get('sec-fetch-site')==='cross-site')throw new AuthError('请求来源不受支持。',403);}
export async function rateLimit(key:string,limit:number,seconds:number,amount=1){const rows=await db()`insert into tingye.rate_limits(key,count,expires_at) values(${key},${amount},now()+${seconds}*interval '1 second') on conflict(key) do update set count=case when tingye.rate_limits.expires_at<now() then excluded.count else tingye.rate_limits.count+excluded.count end,expires_at=case when tingye.rate_limits.expires_at<now() then excluded.expires_at else tingye.rate_limits.expires_at end returning count`;if(rows[0].count>limit)throw new AuthError('请求过于频繁，请稍后重试。',429);}
async function throttle(req:Request,name:string){const secret=process.env.AUTH_RATE_SECRET;if(!secret)throw new AuthError('账号服务尚未配置完成。',503);const ip=req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'local';const digest=createHmac('sha256',secret).update(ip).digest('hex');await rateLimit('auth-ip:'+digest,30,900);await rateLimit('auth-name:'+hash(name),12,900);}
async function newSession(userId:string,expectedHash:string){const value=token(),expiresAt=Date.now()+30*86400000;await db().begin(async tx=>{const users=await tx`select id from tingye.accounts where id=${userId} and password_hash=${expectedHash} for share`;if(!users.length)throw new AuthError('密码已变更，请重新登录。',401);await tx`insert into tingye.sessions(digest,user_id,expires_at) values(${hash(value)},${userId},${new Date(expiresAt)})`;});return {token:value,expiresAt};}
export async function authenticate(req:Request,body:Record<string,unknown>){
 sameOrigin(req);const name=username(body.username);password(body.password);await throttle(req,name);const sql=db();
 if(body.action==='register'){
  if(typeof body.invite!=='string'||!/^[a-f0-9]{64}$/.test(body.invite.trim()))throw new AuthError('邀请码无效或已使用。');
  const recovery=token(),id=randomUUID(),encoded=await hashPassword(body.password);
  try{await sql.begin(async tx=>{const invites=await tx`select digest from tingye.invites where digest=${hash((body.invite as string).trim())} and used_by is null and expires_at>now() for update`;if(!invites.length)throw new AuthError('邀请码无效或已使用。');await tx`insert into tingye.accounts(id,username,password_hash,recovery_hash) values(${id},${name},${encoded},${hash(recovery)})`;await tx`update tingye.invites set used_by=${id},used_at=now() where digest=${invites[0].digest}`;});}catch(e){if((e as {code?:string}).code==='23505')throw new AuthError('该用户名已被使用。');throw e;}
  return {...await newSession(id,encoded),user:{userId:id,displayName:name,username:name},recoveryCode:recovery};
 }
 if(body.action==='recover'){
  if(typeof body.recoveryCode!=='string'||!/^[a-f0-9]{64}$/.test(body.recoveryCode))throw new AuthError('用户名或恢复码不正确。');
  const recovery=token(),encoded=await hashPassword(body.password);
  const id=await sql.begin(async tx=>{const rows=await tx`update tingye.accounts set password_hash=${encoded},recovery_hash=${hash(recovery)} where username=${name} and recovery_hash=${hash(body.recoveryCode as string)} returning id`;if(!rows.length)throw new AuthError('用户名或恢复码不正确。');await tx`delete from tingye.sessions where user_id=${rows[0].id}`;return rows[0].id;});
  return {...await newSession(id,encoded),user:{userId:id,displayName:name,username:name},recoveryCode:recovery};
 }
 if(body.action!=='login')throw new AuthError('无效操作。');
 const rows=await sql`select id,password_hash from tingye.accounts where username=${name}`;
 const valid=await verifyPassword(body.password,rows[0]?.password_hash||'scrypt:'+'0'.repeat(32)+':'+'0'.repeat(128));
 if(!valid||!rows.length)throw new AuthError('用户名或密码不正确。',401);
 return {...await newSession(rows[0].id,rows[0].password_hash),user:{userId:rows[0].id,displayName:name,username:name}};
}
export async function signOut(req:Request){sameOrigin(req);const value=req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]||(await cookies()).get(COOKIE)?.value;if(value)await db()`delete from tingye.sessions where digest=${hash(value)}`;}
