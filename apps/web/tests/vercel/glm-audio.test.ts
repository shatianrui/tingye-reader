import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGlmWav,readGlmWav} from '../../lib/glm-audio';
function wav(shortRiff=false){
  const fmt=Buffer.alloc(24);fmt.write('fmt ');fmt.writeUInt32LE(16,4);fmt.writeUInt16LE(1,8);fmt.writeUInt16LE(1,10);fmt.writeUInt32LE(24000,12);fmt.writeUInt32LE(48000,16);fmt.writeUInt16LE(2,20);fmt.writeUInt16LE(16,22);
  const metadata=Buffer.from('provider-provenance'),chunk=Buffer.alloc(8+metadata.length+(metadata.length%2));chunk.write('AIGC');chunk.writeUInt32LE(metadata.length,4);metadata.copy(chunk,8);
  const data=Buffer.alloc(40);data.write('data');data.writeUInt32LE(32,4);for(let i=8;i<data.length;i+=2)data.writeInt16LE(i*100,i);
  const head=Buffer.alloc(12);head.write('RIFF');head.write('WAVE',8);const result=Buffer.concat([head,fmt,chunk,data]);result.writeUInt32LE(result.length-8-(shortRiff?4:0),4);return result;
}
test('GLM short RIFF container length is repaired without changing PCM or AIGC provenance',()=>{
  const source=wav(true),saved=Buffer.from(source),fixed=normalizeGlmWav(source);
  assert.equal(new DataView(fixed.buffer,fixed.byteOffset,fixed.byteLength).getUint32(4,true),fixed.length-8);
  assert.deepEqual(source,saved,'input must not be mutated');assert.deepEqual(Buffer.from(fixed.subarray(8)),source.subarray(8),'all samples and metadata must remain byte-identical');
  const valid=wav();assert.equal(normalizeGlmWav(valid),valid,'valid file needs no change');
});
test('truncated data, invalid chunks and non-audio bodies are rejected rather than padded',()=>{
  const source=wav(true);assert.throws(()=>normalizeGlmWav(source.subarray(0,-4)),/不完整/);
  const malformed=wav();malformed.writeUInt32LE(0xffffffff,16);assert.throws(()=>normalizeGlmWav(malformed),/不完整/);
  assert.throws(()=>normalizeGlmWav(Buffer.from('{"error":"no audio"}')),/不完整/);
});
test('streamed WAV is completely validated and an oversized body is canceled',async()=>{
  const input=wav(true);let canceled=false;
  const body=new ReadableStream<Uint8Array>({start(c){c.enqueue(input.subarray(0,37));c.enqueue(input.subarray(37));c.close();}});
  const fixed=await readGlmWav(new Response(body));assert.deepEqual(Buffer.from(fixed.subarray(8)),input.subarray(8));
  const huge=new ReadableStream<Uint8Array>({pull(c){c.enqueue(new Uint8Array(8*1024*1024+1));},cancel(){canceled=true;}});
  await assert.rejects(readGlmWav(new Response(huge)),/过大/);assert.equal(canceled,true);
});
