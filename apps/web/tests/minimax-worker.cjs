const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { Miniflare } = require('miniflare');

(async () => {
  const bundle = await build({
    stdin: { contents: `import { minimaxRequest } from './lib/minimax';
      export default { async fetch(req) {
        try { return Response.json(await minimaxRequest('/get_voice', {redirectTest:new URL(req.url).pathname==='/redirect'})); }
        catch(error) { return new Response(error.message, {status:502}); }
      }};`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'esm', platform: 'neutral',
    external: ['cloudflare:workers'],
  });
  const mf = new Miniflare({ workers: [
    { name: 'client', modules: true, script: bundle.outputFiles[0].text,
      compatibilityDate: '2026-05-15', outboundService: 'upstream',
      bindings: { MINIMAX_API_KEY: 'test-only', MINIMAX_REGION: 'cn' } },
    { name: 'upstream', modules: true, compatibilityDate: '2026-05-15', script: `
      export default { async fetch(req) {
        if(new URL(req.url).hostname!=='api.minimax.cn') return new Response('Redirect followed unexpectedly', {status:500});
        if((await req.json()).redirectTest) return Response.redirect('https://unexpected.example/', 307);
        return Response.json({base_resp:{status_code:0},system_voice:[{voice_id:'test'}]});
      }};` },
  ] });
  try {
    const voices = await mf.dispatchFetch('https://test.example/voices');
    assert.equal(voices.status, 200, await voices.clone().text());
    assert.equal((await voices.json()).system_voice.length, 1);
    const redirect = await mf.dispatchFetch('https://test.example/redirect');
    assert.equal(redirect.status, 502);
    assert.match(await redirect.text(), /跳转/);
    console.log('PASS: actual Workers runtime accepts MiniMax requests and rejects upstream redirects.');
  } finally { await mf.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
