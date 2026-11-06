import test from 'node:test';
import assert from 'node:assert/strict';
import {portalCatalog,portalTopics} from '../server/portal-catalog';
import {setup,request,site,cookie,grantForTest} from './helpers';
import {sourceIndexPage} from '../server/source-index';

test('catalog, topics and source indexes require an authenticated licensed site account',async()=>{
 const app=setup(),handle=app.api;
 const paths=['/api/catalog','/api/public/catalog','/api/sources','/api/public/sources','/api/texts/arbzg','/api/pdf/dguv1','/api/favorites','/api/documents'];
 for(const path of paths)assert.equal((await handle(request(path))).status,401,path);
 const registered=await handle(request('/api/auth/register','POST',{...site,username:'catalog-owner',password:'Catalog-test lange Passphrase!'}));const c=cookie(registered);
 for(const path of paths.slice(0,6))assert.equal((await handle(request(path,'GET',undefined,c))).status,402,path);
 grantForTest(app.sql,'catalog-owner');
 const response=await handle(request('/api/catalog','GET',undefined,c));assert.equal(response.status,200);const data=await response.json() as any;assert.equal(data.topics.length,5);
 assert.equal(data.catalog.length,portalCatalog.length);assert.equal(new Set(data.catalog.map((x:any)=>x.id)).size,data.catalog.length);
 assert.ok(data.catalog.filter((x:any)=>x.legalIndex).length>44);assert.ok(data.catalog.find((x:any)=>x.id==='vermbg5').noticeRules.length);
 for(const entry of data.catalog){assert.ok(entry.url.startsWith('https://'));assert.equal(entry.html,undefined);assert.equal(entry.storageKey,undefined);assert.equal(entry.passwordHash,undefined);}
 assert.equal(data.accounts,undefined);assert.equal(data.documents,undefined);
 assert.equal((await handle(request('/api/public/catalog','GET',undefined,c))).status,200);
 app.sql.prepare('UPDATE accounts SET license_valid_until=0').run();
 for(const path of paths.slice(0,6))assert.equal((await handle(request(path,'GET',undefined,c))).status,402,path);
});

test('conditional notice rules and topic references point at distinct available official records',()=>{
 const ids=new Set(portalCatalog.map(x=>x.id));
 for(const topic of portalTopics){assert.ok(topic.items.length);for(const item of topic.items)assert.ok(ids.has(item.recordId));}
 const verm=portalCatalog.find(x=>x.id==='vermbg5')!;assert.equal(verm.hosted,false);assert.match(verm.noticeRules[0].basis,/11/);
 assert.ok(portalCatalog.find(x=>x.id==='agg')!.noticeRules.some(x=>x.basis.includes('12')));
 assert.equal(portalCatalog.find(x=>x.id==='iso14001')?.hosted,false);
 assert.ok(portalCatalog.find(x=>x.id==='ladschlg')!.noticeRules.some(x=>x.basis.includes('21')));
 assert.ok(portalCatalog.find(x=>x.id==='dguv3')!.noticeRules.some(x=>x.basis.includes('12')));
});

test('source directory HTML redirects anonymous readers and binds displayed location to the session',async()=>{
 const app=setup();const anonymous=await sourceIndexPage(app.db,request('/quellen'));assert.equal(anonymous.status,303);assert.equal(anonymous.headers.get('Location'),'/#anmelden');assert.equal(await anonymous.text(),'');
 const r=await app.api(request('/api/auth/register','POST',{...site,username:'source-owner',password:'Sources-test lange Passphrase!'}));const c=cookie(r);
 assert.equal((await sourceIndexPage(app.db,request('/quellen','GET',undefined,c))).status,303);grantForTest(app.sql,'source-owner');
 const response=await sourceIndexPage(app.db,request('/quellen?q=Arbeitszeit&work=Attacker','GET',undefined,c));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');const html=await response.text();assert.ok(html.includes(site.work));assert.ok(!html.includes('Attacker'));assert.ok(html.includes('Quellen durchsuchen'));assert.ok(html.includes('Arbeitszeitgesetz'));assert.ok(!html.includes('Mutterschutzgesetz'));
});
