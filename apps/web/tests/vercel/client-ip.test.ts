import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clientIp} from '../../lib/client-ip';
const request=(headers:Record<string,string>)=>new Request('https://test.invalid',{headers});
test('only the configured trusted ingress header selects the rate limit bucket',()=>{
 const header='x-tingye-client-ip';
 assert.equal(clientIp(request({'x-tingye-client-ip':'192.0.2.1','x-real-ip':'192.0.2.99','x-vercel-forwarded-for':'192.0.2.99'}),header),'192.0.2.1');
 assert.equal(clientIp(request({'x-tingye-client-ip':'192.0.2.2'}),header),'192.0.2.2');
 assert.equal(clientIp(request({'x-real-ip':'192.0.2.3','x-forwarded-for':'192.0.2.4'}),header),'unknown');
 assert.equal(clientIp(request({'x-tingye-client-ip':'2001:db8::1'}),header),'2001:db8::1');
 assert.equal(clientIp(request({'x-tingye-client-ip':'192.0.2.1, 192.0.2.2'}),header),'unknown');
 assert.equal(clientIp(request({'x-vercel-forwarded-for':'192.0.2.5'}),'x-vercel-forwarded-for'),'192.0.2.5');
});
