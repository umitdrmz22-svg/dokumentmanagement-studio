import test from 'node:test';
import assert from 'node:assert/strict';
import {portalCatalog,portalTopics} from '../server/portal-catalog';
import {setup,request} from './helpers';

test('public directory expands official sources without exposing licensed texts or customer data',async()=>{
 const {api:handle}=setup();const response=await handle(request('/api/public/catalog'));assert.equal(response.status,200);const data=await response.json() as any;
 assert.equal(data.catalog.length,portalCatalog.length);assert.equal(new Set(data.catalog.map((x:any)=>x.id)).size,data.catalog.length);
 assert.ok(data.catalog.filter((x:any)=>x.legalIndex).length>44);assert.ok(data.catalog.find((x:any)=>x.id==='vermbg5').noticeRules.length);
 for(const entry of data.catalog){assert.ok(entry.url.startsWith('https://'));assert.equal(entry.html,undefined);assert.equal(entry.storageKey,undefined);assert.equal(entry.passwordHash,undefined);}
 assert.equal(data.accounts,undefined);assert.equal(data.documents,undefined);
 assert.equal((await handle(request('/api/documents'))).status,401);
 assert.equal((await handle(request('/api/texts/arbzg'))).status,401);
});

test('conditional notice rules and topic references point at distinct available official records',()=>{
 const ids=new Set(portalCatalog.map(x=>x.id));
 for(const topic of portalTopics){assert.ok(topic.items.length);for(const item of topic.items)assert.ok(ids.has(item.recordId));}
 const verm=portalCatalog.find(x=>x.id==='vermbg5')!;assert.equal(verm.hosted,false);assert.match(verm.noticeRules[0].basis,/11/);
 assert.ok(portalCatalog.find(x=>x.id==='agg')!.noticeRules.some(x=>x.basis.includes('12')));
 assert.equal(portalCatalog.find(x=>x.id==='iso14001')?.hosted,false);
});
