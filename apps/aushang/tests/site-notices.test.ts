import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,request,site,cookie,grantForTest} from './helpers';
import {emptyNotices} from '../server/site-notices';
async function account(app:ReturnType<typeof setup>,username:string){const r=await app.api(request('/api/auth/register','POST',{...site,username,password:'Notice-test lange Passphrase!'}));grantForTest(app.sql,username);return cookie(r);}
async function device(app:ReturnType<typeof setup>,c:string){const p=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);const d=await(await app.api(request('/api/devices','POST',{label:'Notice kiosk',publicKey:await crypto.subtle.exportKey('jwk',p.publicKey)},c))).json() as any;const ch=await(await app.api(request('/api/device/challenge','POST',{deviceId:d.id}))).json() as any;const signature=Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},p.privateKey,new TextEncoder().encode(ch.message))).toString('base64url');return cookie(await app.api(request('/api/device/unlock','POST',{deviceId:d.id,challengeId:ch.challengeId,signature})));}

test('work notices are authenticated, empty by default and drafts remain private to the correct account',async()=>{
 const app=setup(),a=await account(app,'notice-alpha'),b=await account(app,'notice-beta'),r=await device(app,a);
 assert.equal((await app.api(request('/api/site-notices'))).status,401);
 const initial=await(await app.api(request('/api/site-notices','GET',undefined,r))).json() as any;assert.equal(initial.publishedAt,null);assert.equal(initial.published.agg.text,'');assert.equal(initial.draft,undefined);assert.equal(initial.published.agg.status,'applicable');
 const notices=emptyNotices();notices.agg.text='Beschwerdestelle Personalabteilung, Zimmer 12';
 const saved=await app.api(request('/api/site-notices','PUT',{revision:0,notices,accountId:'forged'},a));assert.equal(saved.status,200);const draft=await saved.json() as any;assert.equal(draft.revision,1);
 for(const c of [r,b]){const data=await(await app.api(request('/api/site-notices','GET',undefined,c))).json() as any;assert.equal(data.published.agg.text,'');assert.equal(data.draft?.agg.text.includes('Zimmer 12')||false,false);}
 const catalog=await(await app.api(request('/api/catalog','GET',undefined,a))).json() as any;assert.equal(catalog.siteNotices.draft,undefined);assert.equal(catalog.siteNotices.published.agg.text,'');
 for(const [path,method,body] of [['/api/site-notices','PUT',{revision:0,notices}],['/api/site-notices/publish','POST',{revision:1,authorized:true}]])assert.equal((await app.api(request(path as string,method as string,body,r))).status,403);
 assert.equal((await app.api(request('/api/site-notices/publish','POST',{revision:1,authorized:true},b))).status,409);
 assert.equal((await app.api(request('/api/site-notices/publish','POST',{revision:1},a))).status,400);
 assert.equal((await app.api(request('/api/site-notices/publish','POST',{revision:1,authorized:true},a))).status,200);
 const published=await(await app.api(request('/api/site-notices','GET',undefined,r))).json() as any;assert.equal(published.published.agg.text,notices.agg.text);assert.ok(published.publishedAt);assert.equal(published.draft,undefined);
 notices.agg.text='Neuer noch nicht freigegebener Entwurf';assert.equal((await app.api(request('/api/site-notices','PUT',{revision:2,notices},a))).status,200);assert.equal((await(await app.api(request('/api/site-notices','GET',undefined,r))).json() as any).published.agg.text,'Beschwerdestelle Personalabteilung, Zimmer 12');
 assert.equal((await app.api(request('/api/site-notices','PUT',{revision:2,notices},a))).status,409);
});

test('publication requires meaningful mandatory information, handles applicability and rejects unsafe payloads',async()=>{
 const app=setup(),c=await account(app,'notice-validation');let notices=emptyNotices();
 assert.equal((await app.api(request('/api/site-notices','PUT',{revision:0,notices},c))).status,200);
 assert.equal((await app.api(request('/api/site-notices/publish','POST',{revision:1,authorized:true},c))).status,400);
 notices.agg.status='not_applicable';assert.equal((await app.api(request('/api/site-notices','PUT',{revision:1,notices},c))).status,400);
 notices=emptyNotices();notices.agg.text='Funktionale Beschwerdestelle im Werk';notices['youth-authority']={status:'not_applicable',text:'Keine minderjährigen Beschäftigten nach betrieblicher Prüfung.'};
 assert.equal((await app.api(request('/api/site-notices','PUT',{revision:1,notices},c))).status,200);
 assert.equal((await app.api(request('/api/site-notices/publish','POST',{revision:2,authorized:true},c))).status,200);
 const bad={...notices,secret:{status:'applicable',text:'unknown'}};assert.equal((await app.api(request('/api/site-notices','PUT',{revision:3,notices:bad},c))).status,400);
 notices.agg.text='x'.repeat(2501);assert.equal((await app.api(request('/api/site-notices','PUT',{revision:3,notices},c))).status,400);
 app.sql.prepare('UPDATE accounts SET license_valid_until=0').run();assert.equal((await app.api(request('/api/site-notices','GET',undefined,c))).status,402);
});
