const MAX_WAV_BYTES=8*1024*1024;

// Some GLM responses include an AIGC metadata chunk but report RIFF's length
// four bytes short. Strict decoders then see the final PCM frames as truncated.
// Repair ONLY the container length after verifying every chunk is complete;
// retain every PCM sample and all provider provenance/watermark metadata.
export function normalizeGlmWav(source:Uint8Array):Uint8Array {
  const invalid=()=>new Error('GLM 音频文件不完整或格式异常，请重试。');
  if(source.length<44||source.length>MAX_WAV_BYTES)throw invalid();
  const view=new DataView(source.buffer,source.byteOffset,source.byteLength);
  const tag=(n:number)=>String.fromCharCode(...source.subarray(n,n+4));
  if(tag(0)!=='RIFF'||tag(8)!=='WAVE')throw invalid();
  let p=12,align=0,rate=0,channels=0,bits=0,format=0,dataSize=0;
  while(p+8<=source.length){
    const size=view.getUint32(p+4,true),body=p+8;
    if(body+size+(size%2)>source.length)throw invalid();
    if(tag(p)==='fmt '){
      if(size<16)throw invalid();
      format=view.getUint16(body,true);channels=view.getUint16(body+2,true);rate=view.getUint32(body+4,true);align=view.getUint16(body+12,true);bits=view.getUint16(body+14,true);
    }
    if(tag(p)==='data'){if(dataSize)throw invalid();dataSize=size;}
    p=body+size+(size%2);
  }
  if(p!==source.length||format!==1||bits!==16||channels<1||channels>8||rate<8000||rate>192000||align!==channels*2||!dataSize||dataSize%align)throw invalid();
  if(view.getUint32(4,true)===source.length-8)return source;
  const repaired=new Uint8Array(source);new DataView(repaired.buffer,repaired.byteOffset,repaired.byteLength).setUint32(4,repaired.length-8,true);
  return repaired;
}

export async function readGlmWav(response:Response):Promise<Uint8Array>{
  if(!response.body)throw new Error('GLM 音频文件为空，请重试。');
  if(Number(response.headers.get('content-length'))>MAX_WAV_BYTES){await response.body.cancel().catch(()=>{});throw new Error('GLM 音频文件过大，请重试。');}
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{
    for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>MAX_WAV_BYTES)throw new Error('GLM 音频文件过大，请缩短朗读段落。');chunks.push(next.value);}
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return normalizeGlmWav(bytes);
}
