const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

// Exercise the real handlers with an atomic in-memory R2 implementation.
const records = new Map(); let version = 0;
const bucket = {
  async get(key) { const value = records.get(key); return value ? { etag:value.etag, json:async()=>JSON.parse(value.body) } : null; },
  async put(key, body, options) {
    if (options?.onlyIf && records.get(key)?.etag !== options.onlyIf.etagMatches) return null;
    const result = {body,etag:String(++version)}; records.set(key,result); return result;
  },
  async delete(key) { records.delete(key); },
};
const owner = {userId:'owner-id',email:'owner@example.test',displayName:'Owner',fullName:null};
let browserUser = owner;
const env = {BUCKET:bucket,NATIVE_ALLOWED_EMAILS:owner.email};
const cache = new Map();
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const source = fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module = {exports:{}};
  const requireMock = id => {
    if(id==='cloudflare:workers')return {env};
    if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>browserUser};
    if(id==='@/lib/mobile-auth')return load('lib/mobile-auth.ts');
    if(id==='@/lib/minimax')return load('lib/minimax.ts');
    if(id==='@/lib/books')return load('lib/books.ts');
    throw new Error('Unexpected dependency '+id);
  };
  vm.runInNewContext(code,{module,exports:module.exports,require:requireMock,crypto:webcrypto,TextEncoder,btoa,Request,Response,URL,URLSearchParams,AbortSignal,console,fetch:()=>{throw new Error('Unauthorized request reached an upstream');}});
  cache.set(relative,module.exports);return module.exports;
}
const auth=load('lib/mobile-auth.ts'), authorize=load('app/api/mobile/authorize/route.ts'), token=load('app/api/mobile/token/route.ts'), session=load('app/api/mobile/session/route.ts');
const base='https://reader.example.test';
const req=(route,body,headers={})=>new Request(base+route,{method:'POST',body:typeof body==='string'?body:JSON.stringify(body),headers});
const exchange=(code,verifier)=>token.POST(req('/api/mobile/token',{code,verifier}));
async function grant(verifier='a'.repeat(64)) {
  const state='b'.repeat(64),challenge=await auth.digest(verifier);
  const response=await authorize.POST(req('/api/mobile/authorize',new URLSearchParams({state,challenge}).toString(),{origin:base}));
  assert.equal(response.status,303);
  const callback=new URL(response.headers.get('location'));
  assert.equal(callback.protocol,'wereader:');assert.equal(callback.host,'auth');assert.equal(callback.searchParams.get('state'),state);
  assert.equal(callback.searchParams.has('token'),false);
  return {code:callback.searchParams.get('code'),verifier};
}
(async()=>{
  assert.equal(await auth.requestUser(new Request(base)),owner);
  env.NATIVE_ALLOWED_EMAILS=' OWNER@example.test , guest@example.test ';
  assert.equal(auth.allowedEmail(' owner@EXAMPLE.test '),true);
  assert.equal(auth.allowedEmail('guest@example.test'),true);
  assert.equal(auth.allowedEmail('unknown@example.test'),false);
  env.NATIVE_ALLOWED_EMAILS=owner.email;
  assert.equal(await auth.requestUser(new Request(base,{headers:{authorization:'Bearer invalid'}})),null);
  env.NATIVE_ALLOWED_EMAILS='';assert.equal(await auth.requestUser(new Request(base)),null);env.NATIVE_ALLOWED_EMAILS=owner.email;
  browserUser={...owner,email:'outsider@example.test'};assert.equal(await auth.requestUser(new Request(base)),null);
  assert.equal((await authorize.POST(req('/api/mobile/authorize','',{origin:base}))).status,403);
  browserUser=null;
  for(const [file,method] of [['books','GET'],['books','POST'],['books','PATCH'],['books','DELETE'],['tts','GET'],['tts','POST'],['tts/voices','POST']]){
    const response=await load(`app/api/${file}/route.ts`)[method](new Request(base+'/api/'+file,{method}));
    assert.equal(response.status,401,`${file} ${method} must deny anonymous access`);
  }
  browserUser=owner;
  assert.equal((await authorize.POST(req('/api/mobile/authorize','',{origin:'https://attacker.example.test'}))).status,403);
  assert.equal((await authorize.POST(req('/api/mobile/authorize',''))).status,403);
  for(const body of ['null','[]','broken','{}'])assert.equal((await token.POST(req('/api/mobile/token',body))).status,400);
  const first=await grant();assert.equal((await exchange(first.code,'c'.repeat(64))).status,401);
  const results=await Promise.all([exchange(first.code,first.verifier),exchange(first.code,first.verifier)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
  const login=await results.find(r=>r.status===200).json();
  assert.match(login.token,/^[a-f0-9]{64}$/);assert.equal(login.user.userId,owner.userId);
  assert.equal((await exchange(first.code,first.verifier)).status,401);
  browserUser=null;const signed=new Request(base+'/api/mobile/session',{headers:{authorization:`Bearer ${login.token}`}});
  assert.equal((await session.GET(signed)).status,200);
  await session.DELETE(signed);assert.equal((await session.GET(signed)).status,401);
  browserUser=owner;
  const expired=await grant(),key='native/codes/'+await auth.digest(expired.code),g=await (await bucket.get(key)).json();
  await bucket.put(key,JSON.stringify({...g,expiresAt:Date.now()-1}));assert.equal((await exchange(expired.code,expired.verifier)).status,401);
  const sessionToken='d'.repeat(64);await bucket.put(await auth.sessionKey(sessionToken),JSON.stringify({user:owner,expiresAt:Date.now()-1}));
  assert.equal(await auth.requestUser(new Request(base,{headers:{authorization:`Bearer ${sessionToken}`}})),null);
  console.log('PASS: allowlist, all protected APIs, CSRF, malformed input, PKCE, atomic replay prevention, expiry and revocation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
