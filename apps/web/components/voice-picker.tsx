"use client";
import { useState } from "react";
import { voiceOptions } from "@/lib/voices";
import type { VoiceConfig } from "@/lib/speech";
export function VoicePicker({ config, onChange, compact = false }: { config: VoiceConfig; onChange: (config: VoiceConfig) => void; compact?: boolean }) {
  const [custom, setCustom] = useState(false), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const builtins = voiceOptions(config);
  const options = [...builtins, ...(config.extraVoices || []).filter(v => !builtins.some(b => b.value === v.value))];
  const known = options.some(v => v.value === config.voice);
  async function loadVoices() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/tts/voices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: config.provider }) });
      const data = await response.json() as { voices?: { value: string; label: string; model?: string }[]; error?: string };
      if (!response.ok) throw new Error(data.error || "获取失败");
      const voices = (data.voices || []).filter(v => !v.model || v.model === config.model);
      onChange({ ...config, extraVoices: voices }); setMessage(`已加载 ${voices.length} 个当前模型的账户音色`);
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="voice-picker"><label className="form-field">朗读音色<select aria-label={compact ? "当前朗读音色" : "API 朗读音色"} value={custom || !known ? "__custom" : config.voice} onChange={e => { const value = e.target.value; setCustom(value === "__custom"); if (value !== "__custom") onChange({ ...config, voice: value }); }}>
    {options.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}<option value="__custom">自定义 / 复刻音色 ID</option>
  </select></label>{(custom || !known) && <label className="form-field">音色 ID<input aria-label="自定义音色 ID" defaultValue={config.voice} maxLength={200} onBlur={e => { if (e.target.value.trim()) onChange({ ...config, voice: e.target.value.trim() }); }} placeholder={"服务商提供的音色 ID"}/></label>}
  {config.provider === "minimax" && <><button className="secondary-button" disabled={busy} onClick={() => void loadVoices()}>{busy ? "获取中…" : "获取全部音色"}</button>{message && <small role="status">{message}</small>}</>}
  </div>;
}
