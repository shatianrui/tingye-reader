import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeGlmWav} from '../lib/glm-audio';
const files=process.argv.slice(2);if(!files.length)throw Error('Provide captured GLM WAV files.');
const reports=[];
for(const file of files){
 const source=fs.readFileSync(file),fixed=normalizeGlmWav(source);
 assert.deepEqual(Buffer.from(fixed.subarray(8)),source.subarray(8));
 const output=file.replace(/\.wav$/i,'-repaired.wav');assert.notEqual(output,file);fs.writeFileSync(output,fixed);
 reports.push({original:path.basename(file),repaired:path.basename(output),originalRiffSize:source.readUInt32LE(4),actualRiffSize:source.length-8,repairedRiffSize:new DataView(fixed.buffer,fixed.byteOffset,fixed.byteLength).getUint32(4,true),allPcmAndMetadataBytesPreserved:true,sha256:createHash('sha256').update(fixed).digest('hex')});
}
console.log(JSON.stringify(reports,null,2));
