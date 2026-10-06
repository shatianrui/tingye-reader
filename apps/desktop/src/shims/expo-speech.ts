// expo-speech on the Web Speech API (Windows SAPI / OneCore voices in Electron).
type Options = {
  language?: string; voice?: string; rate?: number; pitch?: number;
  onStart?: () => void; onDone?: () => void; onStopped?: () => void; onError?: (error: Error) => void;
  onBoundary?: (event: { charIndex: number; charLength: number }) => void;
};
export type Voice = { identifier: string; name: string; quality: string; language: string };
export const VoiceQuality = { Default: 'Default', Enhanced: 'Enhanced' } as const;

let current: (SpeechSynthesisUtterance & { stopped?: boolean }) | null = null;

export function speak(text: string, options: Options = {}) {
  const synth = window.speechSynthesis;
  const utterance: SpeechSynthesisUtterance & { stopped?: boolean } = new SpeechSynthesisUtterance(text);
  utterance.lang = options.language || 'zh-CN';
  if (options.rate) utterance.rate = options.rate;
  if (options.pitch) utterance.pitch = options.pitch;
  if (options.voice) {
    const voice = synth.getVoices().find(v => v.voiceURI === options.voice || v.name === options.voice);
    if (voice) utterance.voice = voice;
  }
  const settle = () => { if (current === utterance) current = null; };
  utterance.onstart = () => options.onStart?.();
  utterance.onboundary = event => options.onBoundary?.({ charIndex: event.charIndex, charLength: event.charLength ?? 0 });
  utterance.onend = () => { settle(); if (utterance.stopped) options.onStopped?.(); else options.onDone?.(); };
  utterance.onerror = event => {
    settle();
    if (utterance.stopped || event.error === 'interrupted' || event.error === 'canceled') options.onStopped?.();
    else options.onError?.(new Error(event.error));
  };
  current = utterance;
  synth.speak(utterance);
}
export async function stop() { if (current) current.stopped = true; window.speechSynthesis.cancel(); }
export async function pause() { window.speechSynthesis.pause(); }
export async function resume() { window.speechSynthesis.resume(); }
export async function isSpeakingAsync() { return window.speechSynthesis.speaking; }
export async function getAvailableVoicesAsync(): Promise<Voice[]> {
  const synth = window.speechSynthesis;
  if (!synth.getVoices().length) {
    await new Promise<void>(resolve => {
      const done = () => { synth.removeEventListener('voiceschanged', done); resolve(); };
      synth.addEventListener('voiceschanged', done);
      setTimeout(done, 1500);
    });
  }
  return synth.getVoices().map(v => ({ identifier: v.voiceURI, name: v.name, quality: VoiceQuality.Default, language: v.lang }));
}
export const maxSpeechInputLength = 32767;
