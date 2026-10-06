// expo-file-system (SDK 57 File/Directory API) backed by the main process.
// URIs are tingye://data/... for user files and tingye://app/... for bundled
// assets; the synchronous calls mirror the native API the app relies on.
import { desktop, remoteMessage } from '../desktop';

type Info = { exists: boolean; isDirectory?: boolean; size?: number; modificationTime?: number };
type Part = string | Entry;

const uriOf = (part: Part) => (typeof part === 'string' ? part : part.uri);
function build(parts: Part[]) {
  const [first, ...rest] = parts;
  let uri = uriOf(first);
  for (const part of rest) {
    if (!uri.endsWith('/')) uri += '/';
    uri += typeof part === 'string' ? part.split('/').filter(Boolean).map(encodeURIComponent).join('/') : part.uri.replace(/^.*\/(?=[^/]+\/?$)/, '');
  }
  return uri;
}

async function read(uri: string, as: 'text' | 'bytes' | 'base64'): Promise<string | Uint8Array> {
  if (uri.startsWith('tingye:')) {
    try { return await desktop.invoke<string | Uint8Array>('fs:read', uri, as); } catch (error) { throw new Error(remoteMessage(error)); }
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error('无法读取文件。');
  if (as === 'text') return response.text();
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (as === 'bytes') return bytes;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

abstract class Entry {
  readonly uri: string;
  protected constructor(uri: string) { this.uri = uri; }
  protected info(): Info { return this.uri.startsWith('tingye:') ? desktop.sync<Info>('fs:info', this.uri) : { exists: false }; }
  get name() { const trimmed = this.uri.replace(/\/+$/, ''); return decodeURIComponent(trimmed.slice(trimmed.lastIndexOf('/') + 1)); }
  get parentDirectory(): Directory { const trimmed = this.uri.replace(/\/+$/, ''); return new Directory(trimmed.slice(0, trimmed.lastIndexOf('/') + 1)); }
  delete() { desktop.sync('fs:delete', this.uri); }
}

export class Directory extends Entry {
  constructor(...parts: Part[]) { const uri = build(parts); super(uri.endsWith('/') ? uri : uri + '/'); }
  get exists() { const info = this.info(); return info.exists && !!info.isDirectory; }
  create(options: { intermediates?: boolean; idempotent?: boolean; overwrite?: boolean } = {}) {
    if (this.exists) { if (options.idempotent) return; if (!options.overwrite) throw new Error('目录已存在。'); }
    desktop.sync('fs:mkdir', this.uri);
  }
  list(): (File | Directory)[] {
    return desktop.sync<{ name: string; isDirectory: boolean }[]>('fs:list', this.uri)
      .map(entry => (entry.isDirectory ? new Directory(this, entry.name) : new File(this, entry.name)));
  }
}

export class File extends Entry {
  constructor(...parts: Part[]) { super(build(parts).replace(/\/+$/, '')); }
  get exists() { const info = this.info(); return info.exists && !info.isDirectory; }
  get size() { return this.info().size ?? 0; }
  get modificationTime() { return this.info().modificationTime ?? null; }
  get extension() { const dot = this.name.lastIndexOf('.'); return dot < 0 ? '' : this.name.slice(dot); }
  text() { return read(this.uri, 'text') as Promise<string>; }
  bytes() { return read(this.uri, 'bytes') as Promise<Uint8Array>; }
  base64() { return read(this.uri, 'base64') as Promise<string>; }
  create() { if (!this.exists) this.write(''); }
  write(content: string | Uint8Array, options: { encoding?: 'utf8' | 'base64' } = {}) {
    desktop.sync('fs:write', this.uri, content, options.encoding === 'base64' ? 'base64' : 'utf8');
  }
  copy(destination: File | Directory) {
    const target = destination instanceof Directory ? new File(destination, this.name) : destination;
    desktop.sync('fs:copy', this.uri, target.uri);
  }
  move(destination: File | Directory) {
    const target = destination instanceof Directory ? new File(destination, this.name) : destination;
    desktop.sync('fs:move', this.uri, target.uri);
    (this as { uri: string }).uri = target.uri;
  }
}

export const Paths = {
  get document() { return new Directory(desktop.sync<{ document: string }>('fs:paths').document); },
  get cache() { return new Directory(desktop.sync<{ cache: string }>('fs:paths').cache); },
};
