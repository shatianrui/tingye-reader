import { randomBytes,scrypt,timingSafeEqual,createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
export const token=()=>randomBytes(32).toString('hex');
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function username(value:unknown){if(typeof value!=='string')throw new Error('请输入用户名。');const name=value.trim().normalize('NFKC').toLowerCase();if(!/^[a-z0-9_]{3,24}$/.test(name))throw new Error('用户名须为 3–24 位字母、数字或下划线。');return name;}
export function password(value:unknown):asserts value is string {if(typeof value!=='string'||value.length<10||value.length>128)throw new Error('密码长度须为 10–128 位。');}
export async function hashPassword(value:string){const salt=randomBytes(16).toString('hex');const key=await derive(value,salt,64) as Buffer;return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(value:string,encoded:string){const [kind,salt,key]=encoded.split(':');if(kind!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(key))return false;return timingSafeEqual(await derive(value,salt,64) as Buffer,Buffer.from(key,'hex'));}
