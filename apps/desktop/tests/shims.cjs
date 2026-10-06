// Unit tests for the desktop bridge: file URI mapping, book page rewriting and
// the contracts it relies on in the shared iOS source. Run: npm test
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ios = path.resolve(__dirname, '../../ios');
const load = require(path.join(ios, 'tests/load-ts.cjs'));
const { resolveUri, dataUri } = require('../electron/paths.cjs');
const { prepareDocument, READER_NONCE } = require('../electron/webview-document.cjs');

// ---- tingye:// URIs never leave their root -------------------------------------------
const roots = { app: path.resolve('/opt/tingye/renderer'), data: path.resolve('/home/reader/tingye-data') };
assert.deepEqual(resolveUri('tingye://data/document/tingye-vercel/u1/book.json', roots), { kind: 'data', file: path.join(roots.data, 'document/tingye-vercel/u1/book.json') });
assert.deepEqual(resolveUri('tingye://app/assets/font.otf', roots), { kind: 'app', file: path.join(roots.app, 'assets/font.otf') });
// Dot segments (plain, %-encoded, or hidden behind an encoded slash) are either
// normalised away by the URL parser or rejected; nothing resolves outside a root.
for (const sneaky of ['tingye://data/%2e%2e/%2e%2e/etc/passwd', 'tingye://data/a%2F..%2F..%2Fsecret', 'tingye://data/..%5c..%5cwindows', 'tingye://app/../../data/x']) {
  const found = resolveUri(sneaky, roots);
  assert.ok(found === null || found.file.startsWith(roots[found.kind] + path.sep), sneaky);
}
assert.equal(resolveUri('tingye://data/a%2F..%2F..%2Fsecret', roots), null);
for (const bad of ['tingye://evil/x', 'file:///etc/passwd', 'https://copilotcli.top/api', 'tingye://data/%00x', 'not a url']) assert.equal(resolveUri(bad, roots), null, bad);
const picked = path.join(roots.data, 'cache/picked/1f/故乡 第一卷.txt');
const uri = dataUri(picked, roots.data);
assert.match(uri, /^tingye:\/\/data\/cache\/picked\/1f\/%E6%95%85/);
assert.equal(resolveUri(uri, roots).file, picked);
assert.throws(() => dataUri(path.resolve('/home/reader/other.txt'), roots.data));

// ---- Book pages: CSP gains tingye:, the bridge runs first with the page nonce ---------
const { originalPage } = load(path.join(ios, 'src/tingye/original-page.ts'));
const { pdfPage } = load(path.join(ios, 'src/tingye/pdf-page.ts'));
const { defaultTypography } = load(path.join(ios, 'src/tingye/typesetting.ts'));
const { readingTheme } = load(path.join(ios, 'src/tingye/themes.ts'));
const config = { fontSize: 20, typography: defaultTypography, colors: readingTheme('paper'), original: true };
const chapter = { title: '样章', text: '正文。', document: { html: '<p>正文。<img src="tingye://data/cache/a.png"></p>', css: '' } };
const pages = {
  original: originalPage(chapter, config, 0, '@font-face{font-family:ReaderSerif;src:url("tingye://data/cache/f.otf")}', {}),
  pdf: pdfPage('JVBERi0=', 0, '正文。', config, 'window.pdfjsLib={};'),
};
for (const [name, page] of Object.entries(pages)) {
  // The iOS pages must keep using the nonce the desktop bridge carries.
  assert.ok(page.includes(`'nonce-${READER_NONCE}'`), `${name} page CSP nonce changed`);
  const out = prepareDocument(page);
  const policy = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(out)[1];
  const directive = key => policy.split(';').map(s => s.trim()).find(s => s.startsWith(key + ' '));
  assert.ok(directive('img-src').endsWith(' tingye:'), `${name} img-src`);
  assert.ok(directive('font-src').endsWith(' tingye:'), `${name} font-src`);
  assert.equal(directive('script-src'), `script-src 'nonce-${READER_NONCE}'`, `${name} script-src untouched`);
  assert.equal(directive('connect-src'), "connect-src 'none'", `${name} connect-src untouched`);
  assert.ok(!/unsafe-eval/.test(policy));
  const bridgeAt = out.indexOf(`<script nonce="${READER_NONCE}">(function(){var host=window.parent;window.ReactNativeWebView=`);
  assert.ok(bridgeAt > out.indexOf('Content-Security-Policy'), `${name} bridge after CSP`);
  assert.ok(bridgeAt < out.indexOf('<script', out.indexOf('Content-Security-Policy') + 1) + 1, `${name} bridge is the first script`);
  assert.equal(prepareDocument('<p>x</p>').startsWith(`<script nonce="${READER_NONCE}">`), true);
}

// ---- WebView commands are decoded, never evaluated -----------------------------------
const { parseCommand } = load(path.join(__dirname, '../src/shims/webview-document.ts'));
const reader = fs.readFileSync(path.join(ios, 'src/tingye/OriginalReader.tsx'), 'utf8');
const injection = "injectJavaScript(`window.readerCommand&&window.readerCommand(${JSON.stringify(value).replace(/</g,'\\\\u003c')});true;`)";
assert.ok(reader.includes(injection), 'OriginalReader injection format changed; update src/shims/webview-document.ts');
const command = { type: 'playback', cursor: { chapter: 0, offset: 3, text: '</script><b>' } };
// parseCommand runs in a vm context, so compare by value rather than prototype.
assert.equal(JSON.stringify(parseCommand(`window.readerCommand&&window.readerCommand(${JSON.stringify(command).replace(/</g, '\\u003c')});true;`)), JSON.stringify(command));
assert.equal(parseCommand('alert(1)'), undefined);
assert.equal(parseCommand('window.readerCommand&&window.readerCommand(alert(1));true;'), undefined);
assert.equal(parseCommand('window.readerCommand&&window.readerCommand({});true;alert(1)'), undefined);

// ---- One version for the shared UI ---------------------------------------------------
const appJson = JSON.parse(fs.readFileSync(path.join(ios, 'app.json'), 'utf8'));
assert.equal(require('../package.json').version, appJson.expo.version, 'apps/desktop version must match apps/ios/app.json');

console.log('PASS: tingye:// paths stay inside their roots, book pages keep a strict CSP with the desktop bridge, commands are parsed not evaluated, versions match.');
