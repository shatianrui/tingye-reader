// fetch for http(s) leaves through the main process (Electron net), so the
// cloud API and speech CDNs need no CORS headers for a tingye:// page.
// tingye:, blob: and data: URLs keep the renderer's own fetch.
import { desktop, remoteMessage } from '../desktop';

const nativeFetch = globalThis.fetch.bind(globalThis);
let counter = 0;

async function bodyOf(body: unknown): Promise<string | Uint8Array | undefined> {
  if (body == null) return undefined;
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  if (body instanceof URLSearchParams) return body.toString();
  throw new TypeError('Unsupported request body');
}

export async function fetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const request = input instanceof Request ? input : undefined;
  const url = request ? request.url : String(input);
  if (!/^https?:/i.test(url)) return nativeFetch(input, init);
  const signal = init.signal ?? request?.signal;
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  const headers = new Headers(init.headers ?? request?.headers);
  const body = await bodyOf(init.body ?? (request && request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined));
  const id = `fetch-${Date.now()}-${counter++}`;
  const call = desktop.invoke<{ status: number; statusText: string; headers: [string, string][]; url: string; body: Uint8Array }>('net:fetch', id, {
    url, method: init.method ?? request?.method ?? 'GET', headers: [...headers], body, redirect: init.redirect ?? request?.redirect,
  });
  const aborted = new Promise<never>((_, reject) => {
    signal?.addEventListener('abort', () => { desktop.abort(id); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
  let result;
  try { result = await Promise.race([call, aborted]); }
  catch (error) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    throw new TypeError(remoteMessage(error) || 'Network request failed');
  }
  const empty = result.status === 204 || result.status === 205 || result.status === 304 || (init.method ?? 'GET').toUpperCase() === 'HEAD';
  const response = new Response(empty ? null : result.body, { status: result.status, statusText: result.statusText, headers: result.headers });
  Object.defineProperty(response, 'url', { value: result.url });
  return response;
}

/** Route the global fetch too: the player downloads speech audio with it. */
export function installFetch() { globalThis.fetch = fetch as typeof globalThis.fetch; }
