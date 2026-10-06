// OriginalReader only ever injects `window.readerCommand(<json>);true;`.
// Decoding it here means the book frame never needs eval: the bridge inside
// the frame (electron/webview-document.cjs) calls readerCommand directly.
const COMMAND = /^window\.readerCommand&&window\.readerCommand\(([\s\S]*)\);true;$/;

export function parseCommand(code: string): unknown {
  const match = COMMAND.exec(code.trim());
  if (!match) return undefined;
  try { return JSON.parse(match[1]); } catch { return undefined; }
}
