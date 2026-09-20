import certificates from '../db/supabase-ca.json' with {type:'json'};
const {ca}=certificates;
// Run only against the new deployment after migrations, never the original Site.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import postgres from 'postgres';
const origin=process.argv[2];if(!origin||!/^https?:\/\//.test(origin))throw Error('Provide the new deployment URL');
const sql=postgres(process.env.DATABASE_URL||process.env.POSTGRES_URL,{ssl:{rejectUnauthorized:true,ca},max:1,prepare:false});
const names=['a','b'].map(x=>'test_'+x+'_'+randomBytes(4).toString('hex'));
const invites=names.map(()=>randomBytes(32).toString('hex')),password='Test-'+randomBytes(16).toString('hex');
const digest=s=>createHash('sha256').update(s).digest('hex');
async function call(path,{method='GET',body,token,foreign=false}={}){const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json','X-Tingye-Client':'native',...(token?{Authorization:'Bearer '+token}:{}),...(foreign?{Origin:'https://foreign.invalid'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
try{
 for(const invite of invites)await sql`insert into tingye.invites(digest,expires_at) values(${digest(invite)},now()+interval '10 minutes')`;
 const [a,b]=await Promise.all(names.map((username,i)=>call('/api/auth',{method:'POST',body:{action:'register',username,password,invite:invites[i]}})));
 assert.equal(a.status,200,JSON.stringify(a.data));assert.equal(b.status,200,JSON.stringify(b.data));
 assert.match(a.data.recoveryCode,/^[a-f0-9]{64}$/);
 const duplicate=await call('/api/auth',{method:'POST',body:{action:'register',username:names[0]+'_2',password,invite:invites[0]}});assert.equal(duplicate.status,400);
 const book={id:randomUUID(),title:'临时测试书',author:'测试',format:'TXT'};
 assert.equal((await call('/api/books',{method:'POST',body:book,token:a.data.token})).status,200);
 assert.equal((await call('/api/books',{token:b.data.token})).data.books.length,0);
 assert.equal((await call('/api/books?id='+book.id,{token:b.data.token})).status,404);
 assert.equal((await call('/api/books',{method:'POST',body:book,token:a.data.token,foreign:true})).status,403);
 assert.equal((await call('/api/tts/voices',{method:'POST',body:{provider:'minimax'}})).status,401);
 const browserLogin=await fetch(origin+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({action:'login',username:names[1],password})});
 assert.equal(browserLogin.status,200);assert.equal((await browserLogin.json()).token,undefined);
 const setCookie=browserLogin.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Lax/i);if(origin.startsWith('https:'))assert.match(setCookie,/Secure/i);
 const cookie=setCookie.split(';')[0];
 const browserSession=await fetch(origin+'/api/auth',{headers:{Cookie:cookie}});assert.equal((await browserSession.json()).user.username,names[1]);
 const reader=await fetch(origin+'/',{headers:{Cookie:cookie},redirect:'manual'});assert.equal(reader.status,200);assert.match(await reader.text(),/听页/);
 assert.equal((await fetch(origin+'/api/auth',{method:'DELETE',headers:{Cookie:cookie,Origin:origin}})).status,200);
 assert.equal((await (await fetch(origin+'/api/auth',{headers:{Cookie:cookie}})).json()).user,null);
 const reset=await call('/api/auth',{method:'POST',body:{action:'recover',username:names[0],password:password+'-new',recoveryCode:a.data.recoveryCode}});assert.equal(reset.status,200);
 assert.equal((await call('/api/auth',{token:a.data.token})).data.user,null);
 assert.equal((await call('/api/auth',{method:'POST',body:{action:'login',username:names[0],password}})).status,401);
 assert.equal((await call('/api/auth',{method:'POST',body:{action:'recover',username:names[0],password,recoveryCode:a.data.recoveryCode}})).status,400);
 console.log('PASS: real registration, single-use invite, account isolation, CSRF, browser cookie login/reader/logout, recovery, old-session invalidation and TTS authentication.');
}finally{
 await sql`delete from tingye.invites where digest in ${sql(invites.map(digest))}`;
 await sql`delete from tingye.accounts where username in ${sql(names)}`;
 await sql.end();
}
