// End-to-end test of the packaged renderer in real Electron, driven by
// Playwright, with the fixture account (src/fixture.tsx) and a throwaway
// profile. Run after `npm run build:fixture`. Linux needs a display (xvfb-run).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');

const root = path.resolve(__dirname, '..');
const shots = path.join(root, '.e2e');
const PAGE = /第 \d+ \/ \d+ 章 · (\d+) \/ (\d+) 页/;

function echoServer() {
  const server = http.createServer((request, response) => {
    if (request.url === '/slow') return; // never answers: the client must abort
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      response.writeHead(201, { 'Content-Type': 'application/json', 'X-Echo': 'yes' });
      response.end(JSON.stringify({
        method: request.method, client: request.headers['x-tingye-client'], auth: request.headers.authorization,
        origin: request.headers.origin ?? null, bytes: [...Buffer.concat(chunks)],
      }));
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tingye-desktop-e2e-'));
  const server = await echoServer();
  const app = await _electron.launch({
    args: process.platform === 'linux' ? ['.', '--no-sandbox'] : ['.'], cwd: root,
    env: { ...process.env, TINGYE_DESKTOP_ENTRY: 'fixture.html', TINGYE_DESKTOP_USER_DATA: userData },
  });
  const errors = [];
  try {
    const page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const label = async () => (await page.evaluate(() => document.body.innerText)).match(PAGE);

    // Shelf: ink-wash chrome, the imported TXT and PDF, window title kept.
    await page.getByText('续读').first().waitFor({ timeout: 60000 });
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()), '听页');
    const shelf = await page.evaluate(() => document.body.innerText);
    assert.ok(shelf.includes('我的书架') && shelf.includes('纸本'), 'shelf lists the imported books');
    await page.screenshot({ path: path.join(shots, '01-shelf.png') });

    // HTTP leaves through the main process: no Origin header, body bytes intact, abort works.
    const base = `http://127.0.0.1:${server.address().port}`;
    const network = await page.evaluate(async base => {
      const response = await fetch(base + '/echo', { method: 'POST', headers: { 'X-Tingye-Client': 'native', Authorization: 'Bearer test' }, body: new Uint8Array([1, 2, 255]) });
      const echo = await response.json();
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 300);
      let aborted = '';
      try { await fetch(base + '/slow', { signal: controller.signal }); } catch (error) { aborted = error.name; }
      return { status: response.status, header: response.headers.get('x-echo'), echo, aborted };
    }, base);
    assert.equal(network.status, 201);
    assert.equal(network.header, 'yes');
    assert.deepEqual(network.echo, { method: 'POST', client: 'native', auth: 'Bearer test', origin: null, bytes: [1, 2, 255] });
    assert.equal(network.aborted, 'AbortError');

    // Narration playlist over tingye:// audio files: both clips, in order, then finish.
    const audio = await page.evaluate(async () => {
      const { File, Paths, createAudioPlaylist } = globalThis.__tingyeTest;
      const wav = seconds => {
        const rate = 8000, n = Math.round(rate * seconds), buffer = new ArrayBuffer(44 + n * 2), v = new DataView(buffer);
        const text = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
        text(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); text(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, 'data'); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 8) * 3000, true);
        return new Uint8Array(buffer);
      };
      const uris = [0, 1].map(i => { const file = new File(Paths.cache, 'e2e', `clip-${i}.wav`); file.write(wav(0.4)); return file.uri; });
      const playlist = createAudioPlaylist({ sources: [{ uri: uris[0] }], updateInterval: 50 });
      playlist.add({ uri: uris[1] });
      playlist.playbackRate = 1.5;
      const seen = new Set();
      const result = await new Promise(resolve => {
        playlist.addListener('playlistStatusUpdate', status => {
          seen.add(status.currentIndex);
          if (status.itemFailed) resolve('failed');
          if (status.didJustFinish) resolve('finished@' + status.currentIndex);
        });
        playlist.play();
        setTimeout(() => resolve('timeout'), 10000);
      });
      playlist.destroy();
      return { result, seen: [...seen].sort() };
    });
    assert.deepEqual(audio, { result: 'finished@1', seen: [0, 1] });

    // Reader: the original-layout page renders in the sandboxed frame; keys turn pages.
    await page.getByText('续读').first().click();
    await page.locator('iframe[title="书页"]').waitFor({ timeout: 30000 });
    // Pagination settles after fonts load; the first chapter spans several pages.
    await page.waitForFunction(pattern => Number(new RegExp(pattern).exec(document.body.innerText)?.[2]) >= 2, PAGE.source, { timeout: 30000 });
    assert.equal((await label())[1], '1');
    await page.screenshot({ path: path.join(shots, '02-reader.png') });
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(pattern => new RegExp(pattern).exec(document.body.innerText)?.[1] === '2', PAGE.source, { timeout: 10000 });
    await page.keyboard.press('m');
    await page.getByText('上一章').first().waitFor({ timeout: 10000 });
    await page.screenshot({ path: path.join(shots, '03-menu.png') });

    // Esc closes the menu, then returns to the shelf (BackHandler shim).
    await page.mouse.click(4, 4);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByText('我的书架').first().waitFor({ timeout: 10000 });

    // PDF imported with pdf.js shows its original page.
    await page.getByText('纸本', { exact: true }).first().click();
    await page.locator('iframe[title="书页"]').waitFor({ timeout: 30000 });
    await page.waitForFunction(pattern => new RegExp(pattern).test(document.body.innerText), PAGE.source, { timeout: 30000 });
    await page.screenshot({ path: path.join(shots, '04-pdf.png') });

    const relevant = errors.filter(text => !/fake worker/i.test(text));
    assert.deepEqual(relevant, [], 'renderer errors');
    console.log('PASS: desktop shelf, main-process fetch with abort, tingye:// narration playlist, sandboxed book pages with keyboard paging and menus, Esc back, PDF import.');
  } finally {
    await app.close().catch(() => {});
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
