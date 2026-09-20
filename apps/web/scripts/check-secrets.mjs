import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
process.loadEnvFile('.env');
const secret=process.env.GLM_TTS_API_KEY;
if(!secret)throw new Error('Missing local test secret');
async function walk(path){const result=[];for(const entry of await readdir(path,{withFileTypes:true})){const name=path+'/'+entry.name;if(entry.isDirectory())result.push(...await walk(name));else result.push(name)}return result}
const files=[...await walk('dist'),...execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n')];
const leaked=[];for(const path of new Set(files)){try{if((await readFile(path)).includes(Buffer.from(secret)))leaked.push(path)}catch{}}
if(leaked.length)throw new Error('Secret found in '+leaked.join(', '));
console.log('PASS: GLM secret absent from build output and tracked source.');
