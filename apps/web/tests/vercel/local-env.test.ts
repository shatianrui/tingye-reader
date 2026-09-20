import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Test the CLI boundary with dummy values only; do not read project credentials.
test('local environment overrides stale inherited keys without changing the parent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tingye-env-'));
  try {
    fs.writeFileSync(path.join(dir, '.env.local'), 'MINIMAX_API_KEY="local-test-key"\nTTS_DAILY_CHARACTERS=0\n');
    fs.writeFileSync(path.join(dir, 'probe.cjs'), `
      const assert=require('node:assert/strict');
      assert.equal(process.env.MINIMAX_API_KEY,'local-test-key');
      assert.equal(process.env.TTS_DAILY_CHARACTERS,'0');
      assert.equal(process.env.TEST_INHERITED,'retained');
    `);
    const env = {...process.env, MINIMAX_API_KEY:'stale-test-key', TEST_INHERITED:'retained'};
    const result = spawnSync(process.execPath, [path.resolve('scripts/with-local-env.mjs'), 'probe.cjs'], {cwd:dir, env, encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(env.MINIMAX_API_KEY, 'stale-test-key');
    fs.unlinkSync(path.join(dir, '.env.local'));
    fs.writeFileSync(path.join(dir, 'probe.cjs'), `require('node:assert/strict').equal(process.env.MINIMAX_API_KEY,'stale-test-key');process.exitCode=7;`);
    const missing = spawnSync(process.execPath, [path.resolve('scripts/with-local-env.mjs'), 'probe.cjs'], {cwd:dir, env, encoding:'utf8'});
    assert.equal(missing.status, 7, 'production without a local file preserves environment and child exit status');
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
});
