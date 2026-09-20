// Preserve whole paragraphs. Buffer sizing must never cut or rewrite audio.
export const SYNTH_TIMEOUT_MS=45000;
export const MAX_AHEAD_TRACKS=12;
export const MIN_AHEAD_TRACKS=5;
export function bufferedTargetSeconds(recentLatency:number){return Math.max(60,Math.min(120,recentLatency*2+15));}
export function estimatedAudioSeconds(text:string){return Math.max(.5,text.length/7);}
// Early start only with a measured WAV duration covering the outstanding
// request's entire remaining timeout plus a safety margin, even at 2x speed.
export function canStartAhead(duration:number|undefined,remainingDeadlineSeconds:number){
 return duration!==undefined&&duration/2>=Math.max(12,remainingDeadlineSeconds+5);
}
