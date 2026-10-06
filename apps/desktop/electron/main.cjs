'use strict';
const { app, BrowserWindow, protocol, ipcMain, net, dialog, safeStorage, shell, session } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { resolveUri, dataUri, mimeType } = require('./paths.cjs');
const { prepareDocument } = require('./webview-document.cjs');

// The renderer is the iOS React Native UI running on react-native-web. Its
// bundle and the user's files are both served from tingye://, so pages,
// fonts, covers and narration audio need no file:// access at all.
protocol.registerSchemesAsPrivileged([
  { scheme: 'tingye', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);
// Narration starts after network synthesis, not inside a click handler.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('com.shatianrui.tingye.desktop');

// Tests point the app at a throwaway profile; packaged builds use the default.
if (process.env.TINGYE_DESKTOP_USER_DATA && path.isAbsolute(process.env.TINGYE_DESKTOP_USER_DATA)) {
  app.setPath('userData', process.env.TINGYE_DESKTOP_USER_DATA);
}

const rendererRoot = path.join(__dirname, '..', 'dist', 'renderer');
const dataRoot = () => path.join(app.getPath('userData'), 'tingye-data');
const roots = () => ({ app: rendererRoot, data: dataRoot() });
const entry = (() => {
  const name = process.env.TINGYE_DESKTOP_ENTRY;
  return name && /^[\w-]+\.html$/.test(name) && fs.existsSync(path.join(rendererRoot, name)) ? name : 'index.html';
})();

function target(uri, writable) {
  const found = resolveUri(String(uri), roots());
  if (!found || (writable && found.kind !== 'data')) throw new Error('文件位置无效。');
  return found.file;
}

async function serve(request) {
  const found = resolveUri(request.url, roots());
  if (!found) return new Response('Not found', { status: 404 });
  let stat;
  try { stat = await fsp.stat(found.file); } catch { return new Response('Not found', { status: 404 }); }
  if (!stat.isFile()) return new Response('Not found', { status: 404 });
  const headers = {
    'Content-Type': mimeType(found.file),
    // Book pages run in sandboxed (opaque-origin) frames and load fonts with CORS.
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': found.kind === 'data' ? 'no-cache' : 'max-age=31536000',
    'Accept-Ranges': 'bytes',
  };
  // Book pages opened by the WebView shim get the desktop bridge and CSP sources.
  if (found.kind === 'data' && new URL(request.url).searchParams.has('webview') && /\.html$/i.test(found.file)) {
    return new Response(prepareDocument(await fsp.readFile(found.file, 'utf8')), { status: 200, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '');
  if (range && stat.size > 0) {
    let start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
    let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1;
    end = Math.min(end, stat.size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${stat.size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(found.file, { start, end })), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(found.file)), { status: 200, headers: { ...headers, 'Content-Length': String(stat.size) } });
}

function reply(event, run) {
  try { event.returnValue = { ok: true, value: run() }; }
  catch (error) { event.returnValue = { ok: false, error: String((error && error.message) || error) }; }
}

// ---- Files (expo-file-system shim) -------------------------------------------------
ipcMain.on('fs:paths', event => reply(event, () => ({ document: 'tingye://data/document/', cache: 'tingye://data/cache/' })));
ipcMain.on('fs:info', (event, uri) => reply(event, () => {
  try {
    const stat = fs.statSync(target(uri, false));
    return { exists: true, isDirectory: stat.isDirectory(), size: stat.size, modificationTime: stat.mtimeMs };
  } catch { return { exists: false }; }
}));
ipcMain.on('fs:mkdir', (event, uri) => reply(event, () => { fs.mkdirSync(target(uri, true), { recursive: true }); }));
ipcMain.on('fs:list', (event, uri) => reply(event, () =>
  fs.readdirSync(target(uri, true), { withFileTypes: true }).map(entry => ({ name: entry.name, isDirectory: entry.isDirectory() }))));
ipcMain.on('fs:delete', (event, uri) => reply(event, () => {
  const file = target(uri, true);
  if (file === dataRoot()) throw new Error('不能删除数据根目录。');
  fs.rmSync(file, { recursive: true, force: true });
}));
ipcMain.on('fs:write', (event, uri, data, encoding) => reply(event, () => {
  const file = target(uri, true);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const bytes = encoding === 'base64' ? Buffer.from(String(data), 'base64') : typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  fs.writeFileSync(file, bytes);
}));
ipcMain.on('fs:copy', (event, from, to) => reply(event, () => {
  const destination = target(to, true);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(target(from, false), destination);
}));
ipcMain.on('fs:move', (event, from, to) => reply(event, () => {
  const destination = target(to, true);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(target(from, true), destination);
}));
ipcMain.handle('fs:read', async (_event, uri, as) => {
  const buffer = await fsp.readFile(target(uri, false));
  if (as === 'text') return buffer.toString('utf8');
  if (as === 'base64') return buffer.toString('base64');
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
});

// ---- Secure storage (expo-secure-store shim): DPAPI via safeStorage on Windows --------
const securePath = () => path.join(app.getPath('userData'), 'secure-store.json');
function readSecure() {
  try { return JSON.parse(fs.readFileSync(securePath(), 'utf8')); } catch { return {}; }
}
function writeSecure(values) {
  fs.mkdirSync(path.dirname(securePath()), { recursive: true });
  fs.writeFileSync(securePath(), JSON.stringify(values), { mode: 0o600 });
}
const secureKey = key => { if (!/^[\w.-]{1,200}$/.test(String(key))) throw new Error('Invalid key'); return String(key); };
ipcMain.handle('secure:get', (_event, key) => {
  const stored = readSecure()[secureKey(key)];
  if (!stored) return null;
  const bytes = Buffer.from(stored.value, 'base64');
  return stored.encrypted ? safeStorage.decryptString(bytes) : bytes.toString('utf8');
});
ipcMain.handle('secure:set', (_event, key, value) => {
  const values = readSecure();
  const encrypted = safeStorage.isEncryptionAvailable();
  const bytes = encrypted ? safeStorage.encryptString(String(value)) : Buffer.from(String(value), 'utf8');
  values[secureKey(key)] = { encrypted, value: bytes.toString('base64') };
  writeSecure(values);
});
ipcMain.handle('secure:delete', (_event, key) => {
  const values = readSecure();
  delete values[secureKey(key)];
  writeSecure(values);
});

// ---- Dialogs (Alert and expo-document-picker shims) ---------------------------------
ipcMain.on('dialog:message', (event, options) => reply(event, () => {
  const buttons = Array.isArray(options.buttons) && options.buttons.length ? options.buttons.slice(0, 8).map(String) : ['好'];
  return dialog.showMessageBoxSync(BrowserWindow.fromWebContents(event.sender), {
    type: 'none', title: '听页', message: String(options.title || ''), detail: options.message ? String(options.message) : undefined,
    buttons, cancelId: Number.isInteger(options.cancelId) ? options.cancelId : buttons.length - 1, defaultId: 0, noLink: true,
  });
}));
ipcMain.handle('dialog:open', async (event, options) => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: '导入书籍',
    properties: options && options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [
      { name: '书籍', extensions: ['epub', 'txt', 'pdf', 'docx', 'md', 'markdown', 'html', 'htm'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true, assets: null };
  // Like copyToCacheDirectory: the importer reads a private copy, never the original.
  const folder = path.join(dataRoot(), 'cache', 'picked', crypto.randomUUID());
  fs.mkdirSync(folder, { recursive: true });
  const assets = result.filePaths.map(source => {
    const name = path.basename(source), copy = path.join(folder, name);
    fs.copyFileSync(source, copy);
    return { uri: dataUri(copy, dataRoot()), name, size: fs.statSync(copy).size, mimeType: mimeType(copy) };
  });
  return { canceled: false, assets };
});
ipcMain.handle('shell:open', async (_event, url) => {
  const parsed = new URL(String(url));
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Unsupported link');
  await shell.openExternal(parsed.href);
});

// ---- Network: requests leave from the main process, so the cloud API needs no CORS ----
const requests = new Map();
ipcMain.handle('net:fetch', async (_event, id, request) => {
  const url = new URL(String(request.url));
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported URL');
  const controller = new AbortController();
  requests.set(id, controller);
  try {
    const response = await net.fetch(url.href, {
      method: request.method || 'GET',
      headers: request.headers || [],
      body: request.body == null ? undefined : typeof request.body === 'string' ? request.body : Buffer.from(request.body),
      redirect: request.redirect === 'error' || request.redirect === 'manual' ? request.redirect : 'follow',
      signal: controller.signal,
    });
    const body = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, statusText: response.statusText, headers: [...response.headers], url: response.url, redirected: response.redirected, body };
  } finally { requests.delete(id); }
});
ipcMain.on('net:abort', (_event, id) => { const controller = requests.get(id); if (controller) controller.abort(); });

function createWindow() {
  const window = new BrowserWindow({
    width: 1280, height: 860, minWidth: 720, minHeight: 540, show: false,
    title: '听页', backgroundColor: '#F4EFE4', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false, spellcheck: false,
    },
  });
  window.removeMenu();
  // Navigation sets document.title to route names ("Shelf"); the window stays 听页.
  window.on('page-title-updated', event => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('tingye://app/')) event.preventDefault(); });
  void window.loadURL('tingye://app/' + entry);
  return window;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    // No spellchecker: otherwise Chromium fetches dictionaries from Google on first run.
    session.defaultSession.setSpellCheckerEnabled(false);
    protocol.handle('tingye', serve);
    fs.mkdirSync(dataRoot(), { recursive: true });
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
