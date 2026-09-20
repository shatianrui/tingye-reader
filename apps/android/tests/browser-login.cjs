const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/tingye/client.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const pendingKey = 'tingye.native.login.v1';
function runtime(store = new Map()) {
  const opened = [], requests = [];
  const control = { failOpen: false, failToken: false };
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    module: mod, exports: mod.exports, URL, Headers, AbortSignal, Date,
    require: id => {
      if (id === 'react-native') return { Linking: { openURL: async url => { if (control.failOpen) throw Error('No browser'); opened.push(url); } } };
      if (id === 'expo-secure-store') return {
        getItemAsync: async key => store.get(key) ?? null,
        setItemAsync: async (key, value) => { store.set(key, value); },
        deleteItemAsync: async key => { store.delete(key); },
      };
      if (id === 'expo-crypto') return {
        getRandomBytesAsync: async count => crypto.randomBytes(count),
        CryptoDigestAlgorithm: { SHA256: 'sha256' }, CryptoEncoding: { BASE64: 'base64' },
        digestStringAsync: async (_, text) => crypto.createHash('sha256').update(text).digest('base64'),
      };
      if (id === 'expo/fetch') return { fetch: async (url, options) => {
        requests.push({ url, options });
        if (control.failToken) throw Error('offline');
        return { ok: true, json: async () => ({ token: 'b'.repeat(64), expiresAt: Date.now() + 100000, user: { userId: 'test', displayName: 'Test', email: '' } }) };
      } };
      throw Error(`Unexpected dependency: ${id}`);
    },
  });
  return { client: mod.exports, store, opened, requests, control };
}
function callback(r) {
  return `wereader://auth?state=${JSON.parse(r.store.get(pendingKey)).state}&code=${'a'.repeat(64)}`;
}
(async () => {
  const first = runtime();
  await first.client.signIn(); // Resolves after browser launch; no indefinitely pending login window.
  assert.equal(first.opened.length, 1);
  const pending = JSON.parse(first.store.get(pendingKey));
  const start = new URL(first.opened[0]);
  assert.equal(start.origin, first.client.ORIGIN);
  assert.equal(start.pathname, '/mobile/connect');
  assert.equal(start.searchParams.get('state'), pending.state);
  assert.equal(start.searchParams.get('challenge'), crypto.createHash('sha256').update(pending.verifier).digest('base64url'));
  assert.equal(start.searchParams.has('verifier'), false);
  const url = callback(first);
  const restarted = runtime(first.store); // Browser login survives Android process reclamation.
  await restarted.client.restoreSession();
  await assert.rejects(restarted.client.completeSignIn(url.replace(pending.state, '0'.repeat(64))), /不匹配/);
  for (const invalid of [url.replace('wereader:', 'https:'), url.replace('auth?', 'auth/other?'), url.replace('auth?', 'auth.evil?')]) {
    assert.equal(await restarted.client.completeSignIn(invalid), null);
  }
  await assert.rejects(restarted.client.completeSignIn(url + '&code=' + 'c'.repeat(64)), /无效/);
  assert.equal(restarted.requests.length, 0);
  const results = await Promise.all([restarted.client.completeSignIn(url), restarted.client.completeSignIn(url)]);
  assert.equal(results[0].user.userId, 'test');
  assert.equal(results[1], null);
  assert.equal(restarted.requests.length, 1);
  assert.equal(JSON.parse(restarted.requests[0].options.body).verifier, pending.verifier);
  assert.equal(first.store.has(pendingKey), false);
  assert.equal((await runtime(first.store).client.restoreSession()).user.userId, 'test');
  const warm = runtime();
  await warm.client.signIn();
  assert.equal((await warm.client.completeSignIn(callback(warm))).user.userId, 'test');
  const expired = runtime();
  await expired.client.signIn();
  const expiredUrl = callback(expired), old = JSON.parse(expired.store.get(pendingKey));
  expired.store.set(pendingKey, JSON.stringify({ ...old, expiresAt: Date.now() - 1 }));
  await assert.rejects(expired.client.completeSignIn(expiredUrl), /超时/);
  assert.equal(expired.requests.length, 0);
  const unavailable = runtime();
  unavailable.control.failOpen = true;
  await assert.rejects(unavailable.client.signIn(), /默认浏览器/);
  assert.equal(unavailable.store.has(pendingKey), false);
  const retry = runtime();
  await retry.client.signIn();
  const obsolete = callback(retry);
  await retry.client.signIn();
  await assert.rejects(retry.client.completeSignIn(obsolete), /不匹配/);
  retry.control.failToken = true;
  await assert.rejects(retry.client.completeSignIn(callback(retry)), /offline/);
  retry.control.failToken = false;
  assert.equal((await retry.client.completeSignIn(callback(retry))).user.userId, 'test');
  console.log('PASS: default browser launch, PKCE, warm/cold return, duplicate callback, invalid/expired callback, browser failure and retry.');
})().catch(error => { console.error(error); process.exitCode = 1; });
