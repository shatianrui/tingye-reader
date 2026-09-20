import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dailyCharacterLimit,TtsQuotaError} from '../../lib/tts-quota';

test('Daily quota defaults safely and unlimited mode must be explicit',()=>{
  for(const value of [undefined,'','NaN','-1','Infinity','999','20.5'])assert.equal(dailyCharacterLimit(value),50000);
  assert.equal(dailyCharacterLimit('200000'),200000);
  assert.equal(dailyCharacterLimit('0'),0);
});
test('Daily and frequency limits expose distinct actionable errors',async()=>{
  const reset=new Date(Date.now()+90000);
  const daily=new TtsQuotaError('daily',50000,reset).response();
  assert.equal(daily.status,429);
  assert.ok(Number(daily.headers.get('Retry-After'))>0);
  const body=await daily.json();
  assert.equal(body.code,'TTS_DAILY_LIMIT');
  assert.equal(body.resetsAt,reset.toISOString());
  assert.match(body.error,/50,000/);
  assert.match(body.error,/北京时间/);
  assert.equal((await new TtsQuotaError('frequency',60,reset).response().json()).code,'TTS_RATE_LIMIT');
});
