import type { VoiceConfig } from './voices';

// Rate is a player property; only the actual voice source requires new audio.
export function voiceSourceChanged(previous:VoiceConfig,next:VoiceConfig) {
  return previous.provider!==next.provider || previous.model!==next.model || previous.voice!==next.voice || previous.apiKey!==next.apiKey || previous.groupId!==next.groupId;
}
