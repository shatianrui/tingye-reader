import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';

// A stale shell-level provider key must not override this project's local keys.
// Never print values, change global environment settings, or bundle this in App.
export function localEnvironment(file, inherited = process.env) {
  try { return {...inherited, ...parseEnv(fs.readFileSync(file, 'utf8'))}; }
  catch (error) { if (error.code === 'ENOENT') return {...inherited}; throw error; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [script, ...args] = process.argv.slice(2);
  if (!script) throw new Error('Provide a Node script to run with project-local configuration.');
  const child = spawn(process.execPath, [script, ...args], {
    stdio: 'inherit', env: localEnvironment(path.resolve('.env.local')),
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', () => { console.error('Could not start the configured command.'); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}
