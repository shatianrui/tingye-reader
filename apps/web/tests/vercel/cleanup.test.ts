import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanup} from '../../lib/cleanup.mjs';

function fakeSql(){
 const mutations:string[]=[];
 const sql=Object.assign(async(parts:TemplateStringsArray|unknown[])=>{
  if(!('raw' in parts))return parts;
  const query=parts.join('?');
  if(query.startsWith('select'))return [{object_path:'orphan.json'}];
  mutations.push(query);return [];
 },{mutations});
 return sql;
}
test('cleanup defaults to a dry run and preserves markers on storage failure',async()=>{
 const sql=fakeSql();let calls=0;
 const files={send:async()=>{calls++;return {Errors:[{Code:'AccessDenied'}]};}};
 assert.deepEqual(await cleanup(sql,files,'books'),{apply:false,objects:1});
 assert.equal(calls,0);assert.equal(sql.mutations.length,0);
 await assert.rejects(cleanup(sql,files,'books',{apply:true}),/markers retained/);
 assert.equal(calls,1);assert.equal(sql.mutations.length,0);
});
test('cleanup deduplicates paths and removes markers after successful object deletion',async()=>{
 const sql=fakeSql();let removed=0;
 const files={send:async(command:{input:{Delete:{Objects:unknown[]}}})=>{assert.equal(sql.mutations.length,0);removed+=command.input.Delete.Objects.length;return {};}};
 assert.deepEqual(await cleanup(sql,files,'books',{apply:true}),{apply:true,objects:1});
 assert.equal(removed,1);assert.equal(sql.mutations.length,6);
});
