import type { VoiceConfig } from "./speech";
export type VoiceOption = { value: string; label: string };
export function voiceOptions(config: VoiceConfig): VoiceOption[] {
  if (config.provider === "glm") return [["tongtong", "彤彤"], ["chuichui", "锤锤"], ["xiaochen", "小陈"], ["jam", "Jam"], ["kazi", "Kazi"], ["douji", "Douji"], ["luodo", "Luodo"]].map(([value, label]) => ({ value, label: `${label} · ${value}` }));
  if(config.provider === "minimax")return [{value:"male-qn-qingse",label:"青涩青年"}];
  return [];
}
