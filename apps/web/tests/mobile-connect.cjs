const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
let email='denied@example.test',checks=0;
const auth={
 requireChatGPTUser:async()=>{checks++;return {email,displayName:email};},
 chatGPTSignInPath:path=>'/signin-with-chatgpt?return_to='+encodeURIComponent(path),
 chatGPTSignOutPath:path=>'/signout-with-chatgpt?return_to='+encodeURIComponent(path),
};
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../app/mobile/connect/page.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{
 module:mod,exports:mod.exports,encodeURIComponent,
 require:id=>id==='@/app/chatgpt-auth'?auth:id==='@/lib/mobile-auth'?{allowedEmail:e=>e==='allowed@example.test',MOBILE_CALLBACK:'wereader://auth'}:id.endsWith('.css')?{card:'card',primary:'primary',secondary:'secondary'}:require(id),
});
const params={state:'b'.repeat(64),challenge:'a'.repeat(43)};
async function render(p=params){let tree=await mod.exports.default({searchParams:Promise.resolve(p)});while(React.isValidElement(tree)&&typeof tree.type==='function')tree=await tree.type(tree.props);return renderToStaticMarkup(tree);}
(async()=>{
 const denied=await render();assert.match(denied,/denied@example.test/);assert.match(denied,/退出并切换账号/);assert.match(denied,/signout-with-chatgpt/);assert.match(denied,/choose%3D1/);assert.match(denied,/error=access_denied/);assert.doesNotMatch(denied,/<form/);
 const count=checks,choose=await render({...params,choose:'1'});assert.equal(checks,count,'account picker must not automatically reauthenticate');assert.match(choose,/重新登录 ChatGPT/);assert.match(choose,/signin-with-chatgpt/);assert.match(choose,/state%3D/);
 email='allowed@example.test';const allowed=await render();assert.match(allowed,/授权并返回微读/);assert.match(allowed,/\/api\/mobile\/authorize/);assert.match(allowed,/退出并切换账号/);
 const invalid=await render({state:'invalid',challenge:'invalid'});assert.match(invalid,/打开微读 App/);assert.equal(checks,count+1);
 console.log('PASS: denied account recovery, manual reauthentication without loop, PKCE preservation, allowed authorization and invalid-link return.');
})().catch(e=>{console.error(e);process.exitCode=1;});
