// react-native-webview for desktop: the book page runs in a sandboxed iframe
// (opaque origin, scripts only) and talks to the app over postMessage. The
// main process serves `?webview=1` pages with the bridge already injected.
import { createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { parseCommand } from './webview-document';

type Props = {
  source?: { uri?: string };
  style?: unknown;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  onLoadEnd?: () => void;
  [key: string]: unknown;
};
export type WebViewHandle = { injectJavaScript: (code: string) => void; reload: () => void };

export const WebView = forwardRef<WebViewHandle, Props>(function WebView(props, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [revision, setRevision] = useState(0);
  const uri = props.source?.uri;

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const data = event.data as { __tingyeWebView?: string; data?: unknown } | null;
      if (data?.__tingyeWebView === 'message') latest.current.onMessage?.({ nativeEvent: { data: String(data.data) } });
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  useImperativeHandle(ref, () => ({
    injectJavaScript(code: string) {
      const command = parseCommand(code);
      if (command !== undefined) frame.current?.contentWindow?.postMessage({ __tingyeWebView: 'command', command }, '*');
    },
    reload() { setRevision(value => value + 1); },
  }), []);

  if (!uri) return <View style={props.style as never} />;
  return (
    <View style={props.style as never}>
      {createElement('iframe', {
        key: revision, ref: frame, src: uri + (uri.includes('?') ? '&' : '?') + 'webview=1',
        sandbox: 'allow-scripts', title: '书页',
        style: { border: 0, width: '100%', height: '100%', display: 'block', background: 'transparent' },
        // Keyboard paging and space-to-listen work as soon as the page shows.
        onLoad: () => { frame.current?.focus(); latest.current.onLoadEnd?.(); },
      })}
    </View>
  );
});
export default WebView;
