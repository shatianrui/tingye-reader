// The slice of expo-audio's playlist API the narration player uses, on
// HTMLAudioElement. Track changes, finish and failures are reported through
// 'playlistStatusUpdate' like the native AVQueuePlayer-backed playlist.
type Source = { uri: string };
type Listener = (status: Record<string, unknown>) => void;

class AudioPlaylist {
  private readonly audio = new Audio();
  private sources: Source[];
  private index = 0;
  private rate = 1;
  private finished = false;
  private destroyed = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly interval: number;

  constructor({ sources = [], updateInterval = 500 }: { sources?: Source[]; updateInterval?: number } = {}) {
    this.sources = [...sources];
    this.interval = updateInterval;
    this.audio.preload = 'auto';
    (this.audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    this.audio.addEventListener('ended', () => this.advance());
    this.audio.addEventListener('error', () => { if (this.audio.getAttribute('src')) this.emit({ itemFailed: true }); });
    for (const name of ['playing', 'pause', 'waiting', 'canplay', 'loadedmetadata']) this.audio.addEventListener(name, () => this.emit());
    this.load(0);
  }

  get playbackRate() { return this.rate; }
  set playbackRate(value: number) { this.rate = value; this.audio.defaultPlaybackRate = value; this.audio.playbackRate = value; }
  get currentIndex() { return this.index; }
  get trackCount() { return this.sources.length; }
  get playing() { return !this.audio.paused && !this.audio.ended; }

  private load(index: number) {
    this.index = index;
    this.finished = false;
    const source = this.sources[index];
    if (source) this.audio.src = source.uri; else this.audio.removeAttribute('src');
    this.audio.playbackRate = this.rate;
  }
  play() {
    if (this.destroyed || this.finished || !this.audio.getAttribute('src')) return;
    this.audio.playbackRate = this.rate;
    void this.audio.play().catch((error: DOMException) => { if (error?.name !== 'AbortError') this.emit({ itemFailed: true }); });
    this.tick(true);
  }
  pause() { this.audio.pause(); this.tick(false); this.emit(); }
  add(source: Source) { this.sources.push(source); if (this.sources.length === 1) this.load(0); }
  skipTo(index: number) { if (!this.sources[index]) return; this.load(index); this.emit(); }
  next() { if (this.index < this.sources.length - 1) this.skipTo(this.index + 1); }
  previous() { if (this.index > 0) this.skipTo(this.index - 1); }
  clear() { this.sources = []; this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.tick(false); }
  addListener(name: string, listener: Listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
    return { remove: () => { this.listeners.get(name)?.delete(listener); } };
  }
  removeAllListeners(name?: string) { if (name) this.listeners.delete(name); else this.listeners.clear(); }
  destroy() { if (this.destroyed) return; this.clear(); this.destroyed = true; this.listeners.clear(); }
  release() { this.destroy(); }

  private advance() {
    if (this.index < this.sources.length - 1) {
      this.load(this.index + 1);
      this.play();
      this.emit();
    } else {
      this.finished = true;
      this.tick(false);
      this.emit({ didJustFinish: true });
    }
  }
  private tick(on: boolean) {
    if (this.timer) clearInterval(this.timer);
    this.timer = on ? setInterval(() => this.emit(), this.interval) : undefined;
  }
  private emit(extra: Record<string, unknown> = {}) {
    if (this.destroyed) return;
    const a = this.audio;
    const status = {
      id: 'desktop-playlist', currentIndex: this.index, trackCount: this.sources.length,
      currentTime: a.currentTime || 0, duration: Number.isFinite(a.duration) ? a.duration : 0,
      playing: !a.paused && !a.ended, isBuffering: !a.paused && a.readyState < 3, isLoaded: a.readyState >= 2,
      playbackRate: this.rate, loop: 'none', didJustFinish: false, ...extra,
    };
    for (const listener of [...(this.listeners.get('playlistStatusUpdate') ?? [])]) listener(status);
  }
}

export function createAudioPlaylist(options?: { sources?: Source[]; updateInterval?: number }) { return new AudioPlaylist(options); }
export async function setAudioModeAsync(_mode?: unknown) {}
export type AudioPlaylistStatus = Record<string, any>;
