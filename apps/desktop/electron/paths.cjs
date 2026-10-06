'use strict';
// Maps the renderer's tingye:// URIs onto disk. Pure functions so tests can
// exercise the traversal rules without Electron.
const path = require('node:path');

const SCHEME = 'tingye:';

/** Resolves `rel` inside `root`; returns null for anything that escapes it. */
function inside(root, rel) {
  const base = path.resolve(root);
  const target = path.resolve(base, '.' + path.sep + rel);
  return target === base || target.startsWith(base + path.sep) ? target : null;
}

/**
 * tingye://data/<rel> → user data, tingye://app/<rel> → bundled renderer files
 * (read only). Returns {kind, file} or null when the URI is not one of ours or
 * points outside its root.
 */
function resolveUri(uri, roots) {
  let url;
  try { url = new URL(uri); } catch { return null; }
  if (url.protocol !== SCHEME || (url.host !== 'data' && url.host !== 'app')) return null;
  let rel;
  try { rel = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch { return null; }
  if (rel.includes('\0')) return null;
  const file = inside(url.host === 'data' ? roots.data : roots.app, rel);
  return file ? { kind: url.host, file } : null;
}

/** Inverse of resolveUri for user data files. */
function dataUri(file, dataRoot) {
  const rel = path.relative(path.resolve(dataRoot), path.resolve(file));
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Path is outside the data directory');
  return 'tingye://data/' + rel.split(path.sep).map(encodeURIComponent).join('/');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon',
};
function mimeType(file) { return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'; }

module.exports = { resolveUri, dataUri, mimeType, inside };
