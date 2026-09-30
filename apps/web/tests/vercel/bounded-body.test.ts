import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedBody} from '../../lib/bounded-body';

test('bounded backup reads reject oversized metadata before reading and stop oversized streams',async()=>{
 let reads=0,destroyed=false;
 const source=()=>({async *[Symbol.asyncIterator](){for(let i=0;i<4;i++){reads++;yield Buffer.from('abcd');}},destroy(){destroyed=true;}});
 await assert.rejects(readBoundedBody(source(),8,9),/reserved size/);
 assert.equal(reads,0);assert.equal(destroyed,true);
 destroyed=false;
 await assert.rejects(readBoundedBody(source(),8,4),/reserved size/);
 assert.equal(reads,3);assert.equal(destroyed,true);
});
test('bounded backup reads accept exact size and propagate storage failures',async()=>{
 async function* valid(){yield Buffer.from('ab');yield Buffer.from('cd');}
 assert.equal((await readBoundedBody(valid(),4,4)).toString(),'abcd');
 async function* failed(){yield Buffer.from('ab');throw Error('disconnected');}
 await assert.rejects(readBoundedBody(failed(),4),/disconnected/);
});
