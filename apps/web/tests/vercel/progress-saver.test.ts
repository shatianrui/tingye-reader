import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProgressSaver,type ProgressWrite} from '../../lib/progress-saver';
const value=(position:number):ProgressWrite=>({id:'book',chapter:0,position,updatedAt:position+1});
test('continuous position changes still save at the first deadline',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 const writes:ProgressWrite[]=[],saver=createProgressSaver(async p=>{writes.push(p);},()=>{});
 saver.schedule(value(0));context.mock.timers.tick(500);saver.schedule(value(1));
 context.mock.timers.tick(200);await saver.flush();assert.equal(writes[0].position,1);
 saver.schedule(value(2));context.mock.timers.tick(500);saver.schedule(value(3));
 context.mock.timers.tick(200);await saver.flush();assert.deepEqual(writes.map(p=>p.position),[1,3]);
});
test('switching books flushes before the deadline and failed writes can retry',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 const writes:ProgressWrite[]=[];let fail=true;
 const saver=createProgressSaver(async p=>{if(fail)throw Error('disk unavailable');writes.push(p);},()=>{});
 saver.schedule(value(5));await assert.rejects(saver.flush(),/disk unavailable/);
 fail=false;await saver.flush();assert.equal(writes[0].position,5);
 context.mock.timers.tick(1000);assert.equal(writes.length,1);
});
