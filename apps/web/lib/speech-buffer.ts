type Entry = {
  text: string; controller: AbortController; promise: Promise<Blob>;
  resolve: (blob: Blob) => void; reject: (error: unknown) => void;
  state: "queued" | "loading" | "ready"; blob?: Blob; demand: boolean;
};

/** Session-only, bounded lookahead. Never store text or credentials on disk. */
export class SpeechBuffer {
  private entries = new Map<string, Entry>();
  private running = 0;
  private suspended = false;
  constructor(private synthesize: (text: string, signal: AbortSignal) => Promise<Blob>, private changed = () => {}) {}

  get(text: string): Promise<Blob> {
    const entry = this.add(text);
    entry.demand = true;
    this.drain();
    return entry.promise;
  }

  prepare(texts: string[], paused = false) {
    this.suspended = paused;
    const allowed = new Set(texts.slice(0, 7));
    for (const [text, entry] of this.entries) if (!allowed.has(text)) this.remove(entry);
    for (const text of allowed) this.add(text);
    this.drain();
    this.changed();
  }

  ready(texts: string[]) { return texts.filter(text => this.entries.get(text)?.state === "ready").length; }

  clear() {
    for (const entry of this.entries.values()) this.remove(entry);
    this.changed();
  }

  private add(text: string) {
    const found = this.entries.get(text);
    if (found) return found;
    let resolve!: Entry["resolve"], reject!: Entry["reject"];
    const promise = new Promise<Blob>((yes, no) => { resolve = yes; reject = no; });
    // A speculative failure is retried on demand, never an unhandled rejection.
    void promise.catch(() => {});
    const entry: Entry = { text, controller: new AbortController(), promise, resolve, reject, state: "queued", demand: false };
    this.entries.set(text, entry);
    return entry;
  }

  private remove(entry: Entry) {
    if (this.entries.get(entry.text) !== entry) return;
    this.entries.delete(entry.text);
    entry.controller.abort();
    entry.reject(new DOMException("Playback moved", "AbortError"));
  }

  private drain() {
    while (this.running < 2) {
      const waiting = [...this.entries.values()].filter(e => e.state === "queued");
      const entry = waiting.find(e => e.demand) || (!this.suspended ? waiting[0] : undefined);
      if (!entry) return;
      this.running++;
      entry.state = "loading";
      const timeout = setTimeout(() => entry.controller.abort(), 55000);
      void this.synthesize(entry.text, entry.controller.signal).then(blob => {
        if (entry.controller.signal.aborted || this.entries.get(entry.text) !== entry) return;
        if (blob.size > 20 * 1024 * 1024) throw new Error("单段语音过大，请更换语音格式。");
        entry.blob = blob; entry.state = "ready"; entry.resolve(blob);
        let bytes = [...this.entries.values()].reduce((n, e) => n + (e.blob?.size || 0), 0);
        for (const old of [...this.entries.values()].reverse()) {
          if (bytes <= 20 * 1024 * 1024) break;
          if (old !== entry && !old.demand && old.blob) { bytes -= old.blob.size; this.remove(old); }
        }
      }).catch(error => {
        if (this.entries.get(entry.text) === entry) this.entries.delete(entry.text);
        entry.reject(entry.controller.signal.aborted ? new Error("语音预合成超时，请重试。") : error);
      }).finally(() => {
        clearTimeout(timeout); this.running--; this.changed(); this.drain();
      });
    }
  }
}
