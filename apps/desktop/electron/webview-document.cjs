'use strict';
// Book pages are written for WKWebView: resources are file: URLs and the page
// CSP names file:. On desktop they are tingye:// URLs, so when the WebView shim
// loads a page (…/page.html?webview=1) the main process adds tingye: to the
// image/font/media sources and injects the react-native-webview bridge with
// the page's script nonce. The frame keeps its own strict, no-eval policy.

/** Nonce the reader page CSP allows (src/tingye/original-page.ts, pdf-page.ts in apps/ios). */
const READER_NONCE = 'tingye-reader';

const BRIDGE = "(function(){var host=window.parent;window.ReactNativeWebView={postMessage:function(data){host.postMessage({__tingyeWebView:'message',data:String(data)},'*');}};window.addEventListener('message',function(event){if(event.source!==host)return;var d=event.data;if(!d||d.__tingyeWebView!=='command')return;if(typeof window.readerCommand==='function')window.readerCommand(d.command);});})();";

const CSP = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i;

function prepareDocument(html) {
  let out = String(html).replace(CSP, (_match, open, policy, close) =>
    open + policy.replace(/\b(img-src|font-src|media-src)\b([^;]*)/g, (_d, directive, sources) => `${directive}${sources} tingye:`) + close);
  const script = `<script nonce="${READER_NONCE}">${BRIDGE}</script>`;
  const meta = /<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i.exec(out);
  if (meta) out = out.slice(0, meta.index + meta[0].length) + script + out.slice(meta.index + meta[0].length);
  else if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, match => match + script);
  else out = script + out;
  return out;
}

module.exports = { prepareDocument, READER_NONCE };
