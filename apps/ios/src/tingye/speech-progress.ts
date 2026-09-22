// An estimate for providers returning audio without word timestamps. This
// analyzes a read-only WAV envelope; the actual audio bytes are never cut.
export type SpeechEnvelope = { duration: number; cumulative: number[]; total: number };
export function wavEnvelope(bytes: Uint8Array): SpeechEnvelope | undefined {
  if(bytes.length<44)return;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const tag=(n:number)=>String.fromCharCode(...bytes.subarray(n,n+4));
  if(tag(0)!=='RIFF'||tag(8)!=='WAVE')return;
  let format=0,channels=0,rate=0,bits=0,dataOffset=0,dataSize=0;
  for(let p=12;p+8<=bytes.length;){
    const size=view.getUint32(p+4,true),body=p+8;
    if(body+size>bytes.length)return;
    if(tag(p)==='fmt '&&size>=16){format=view.getUint16(body,true);channels=view.getUint16(body+2,true);rate=view.getUint32(body+4,true);bits=view.getUint16(body+14,true);}
    if(tag(p)==='data'){dataOffset=body;dataSize=size;}
    p=body+size+(size%2);
  }
  if(format!==1||bits!==16||channels<1||channels>8||rate<8000||rate>192000||!dataSize)return;
  const frames=Math.floor(dataSize/(channels*2)),step=Math.max(1,Math.round(rate*.02)),energy:number[]=[];
  let peak=0;
  for(let frame=0;frame<frames;frame+=step){
    let squares=0,count=0;
    for(let i=frame;i<Math.min(frame+step,frames);i+=4){for(let ch=0;ch<channels;ch++){const sample=view.getInt16(dataOffset+(i*channels+ch)*2,true)/32768;squares+=sample*sample;count++;}}
    const rms=Math.sqrt(squares/Math.max(1,count));energy.push(rms);peak=Math.max(peak,rms);
  }
  if(peak<.001)return;
  const threshold=Math.max(.001,peak*.035),first=energy.findIndex(e=>e>=threshold);
  let last=energy.length-1;while(last>first&&energy[last]<threshold)last--;
  const cumulative=[0];
  for(let i=0;i<energy.length;i++)cumulative.push(cumulative[i]+(i<first||i>last?0:energy[i]>=threshold?1:.08));
  return {duration:frames/rate,cumulative,total:cumulative.at(-1)!};
}

export function estimatedSpeechOffset(text:string,start:number,currentTime:number,duration:number,envelope?:SpeechEnvelope) {
  if(!Number.isFinite(currentTime)||!Number.isFinite(duration)||duration<=0||currentTime<=0)return start;
  let ratio=Math.min(1,currentTime/duration);
  if(envelope?.total){
    // currentTime and duration are both in the native player's clock domain;
    // envelope.duration is a separate WAV-header estimate that can drift from
    // it (see player.ts, where audio.duration gets overwritten by the real
    // native status.duration). Map the native-domain fraction onto the
    // envelope's own index range, never divide currentTime by envelope.duration.
    const point=Math.min(envelope.cumulative.length-1,currentTime/duration*(envelope.cumulative.length-1));
    const i=Math.floor(point),a=envelope.cumulative[i],b=envelope.cumulative[Math.min(i+1,envelope.cumulative.length-1)];
    ratio=(a+(b-a)*(point-i))/envelope.total;
  }
  const units=Array.from(text).map(char=>({char,weight:/\s/u.test(char)?.08:/[，,、；;：:]/u.test(char)?.4:/[。.!！？?]/u.test(char)?.7:/[“”‘’"「」『』]/u.test(char)?0:/[a-z]/iu.test(char)?.38:1}));
  const target=units.reduce((sum,u)=>sum+u.weight,0)*ratio;
  let spoken=0,offset=start;
  for(const unit of units){if(spoken+unit.weight>target+1e-9)break;spoken+=unit.weight;offset+=unit.char.length;}
  return offset;
}
