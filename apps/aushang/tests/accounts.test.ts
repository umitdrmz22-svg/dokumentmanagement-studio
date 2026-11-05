import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createAPI} from '../server/api';
import {beginUpdate,continueUpdate,publishUpdate,updateMeta} from '../server/updates';
import {catalog} from '../server/generated-legal';
function database(){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));class Q{constructor(public query:string,public values:any[]=[]){ }bind(...values:any[]){return new Q(this.query,values);}async first(){return sql.prepare(this.query).get(...this.values)||null;}async all(){return {results:sql.prepare(this.query).all(...this.values)};}async run(){const r=sql.prepare(this.query).run(...this.values);return {success:true,meta:{changes:r.changes}};}}const db={prepare:(q:string)=>new Q(q),async batch(qs:Q[]){sql.exec('BEGIN');try{const results=[];for(const q of qs)results.push(await q.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};return {sql,db:db as unknown as D1Database};}
const base='https://portal.example';
function request(path:string,method='GET',body?:any,cookie='',origin=base){return new Request(base+path,{method,headers:{...(method!=='GET'?{Origin:origin}:{}),...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});}
const site={company:'Musterbetrieb GmbH',work:'Werk Alpha',street:'Musterstraße',houseNumber:'1',postalCode:'12345',city:'Musterstadt',country:'Deutschland',acceptSiteScope:true,businessOnly:true};
const cookie=(r:Response)=>(r.headers.get('Set-Cookie')||'').split(';')[0];
function setup(){const {sql,db}=database();const app=createAPI({DB:db,AUTH_RATE_SECRET:'test-only-rate-secret',MAINTAINER_EMAIL:'owner@tests.invalid'});return {sql,db,...app};}
test('Real registration requires the full site and unauthenticated legal-text access is blocked',async()=>{const app=setup();const missing=await app.api(request('/api/auth/register','POST',{...site,work:'',username:'test-standort',password:'Test-only lange Passphrase!'}));assert.equal(missing.status,400);assert.equal(app.sql.prepare('SELECT count(*) AS n FROM accounts').get()?.n,0);for(const url of ['/api/catalog','/api/texts/arbzg','/api/pdf/dguv1'])assert.equal((await app.api(request(url))).status,401);});
test('Accounts retain their registered address and favorites never cross account boundaries',async()=>{const app=setup();const ra=await app.api(request('/api/auth/register','POST',{...site,username:'test-alpha',password:'Test-only lange Passphrase Alpha!'}));assert.equal(ra.status,201);const ca=cookie(ra);const a=await ra.json() as any;assert.match(a.recoveryCode,/^[a-f0-9]{64}$/);const rb=await app.api(request('/api/auth/register','POST',{...site,work:'Werk Beta',username:'test-beta',password:'Test-only lange Passphrase Beta!'}));assert.equal(rb.status,201);const cb=cookie(rb);const meA=await(await app.api(request('/api/me','GET',undefined,ca))).json() as any;assert.equal(meA.account.work,'Werk Alpha');assert.equal(meA.account.postalCode,'12345');assert.equal('password_hash' in meA.account,false);const save=await app.api(request('/api/favorites','PUT',{favorites:['arbzg'],accountId:'test-beta'},ca));assert.equal(save.status,200);const meB=await(await app.api(request('/api/me','GET',undefined,cb))).json() as any;assert.deepEqual(meB.favorites,[]);assert.equal(meB.account.work,'Werk Beta');const cross=await app.api(request('/api/favorites','PUT',{favorites:['agg']},ca,'https://attacker.example'));assert.equal(cross.status,403);const spoof=await(await app.api(request('/api/me?accountId='+meB.account.id,'GET',undefined,ca))).json() as any;assert.equal(spoof.account.work,'Werk Alpha');assert.equal((await app.api(request('/api/account','PATCH',{work:'Another work'},ca))).status,404);});
test('Password change and recovery revoke previous sessions; recovery codes are one-time',async()=>{const app=setup();const pass='Test-only lange Passphrase Alpha!';const registered=await app.api(request('/api/auth/register','POST',{...site,username:'test-password',password:pass}));const oldCookie=cookie(registered),code=(await registered.json() as any).recoveryCode;const login=await app.api(request('/api/auth/login','POST',{username:'test-password',password:pass}));assert.equal(login.status,200);const changed=await app.api(request('/api/auth/password','POST',{currentPassword:pass,newPassword:'Test-only neue Passphrase Delta!'},oldCookie));assert.equal(changed.status,200);for(const c of [oldCookie,cookie(login)])assert.equal((await(await app.api(request('/api/me','GET',undefined,c))).json() as any).account,null);const recovered=await app.api(request('/api/auth/recover','POST',{username:'test-password',recoveryCode:code,newPassword:'Test-only wiederhergestellte Passphrase!'}));assert.equal(recovered.status,200);assert.notEqual((await recovered.json() as any).recoveryCode,code);assert.equal((await app.api(request('/api/auth/recover','POST',{username:'test-password',recoveryCode:code,newPassword:'Test-only wiederhergestellte Passphrase!'}))).status,401);assert.equal((await(await app.api(request('/api/me','GET',undefined,cookie(changed)))).json() as any).account,null);});
test('Maintenance tools reject anonymous and non-owner callers',async()=>{const app=setup();const body={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_update_status',arguments:{}}};assert.equal((await app.mcp(request('/mcp','POST',body))).status,403);const r=request('/mcp','POST',body);r.headers.set('oai-authenticated-user-email','other@tests.invalid');r.headers.set('oai-authenticated-user-id','other');assert.equal((await app.mcp(r)).status,403);});
test('Failed and incomplete source updates keep the previous active version and date',async()=>{const app=setup();const before=await updateMeta(app.db);const run=await beginUpdate(app.db,'owner');await assert.rejects(()=>publishUpdate(app.db,run.runId));const original=globalThis.fetch;globalThis.fetch=async()=>new Response('Unavailable',{status:503});try{await assert.rejects(()=>continueUpdate(app.db,{} as R2Bucket,run.runId));}finally{globalThis.fetch=original;}const after=await updateMeta(app.db);assert.equal(after.activeRun,before.activeRun);assert.equal(after.lastSuccessfulCheck,before.lastSuccessfulCheck);assert.equal(after.lastAttemptStatus,'failed');const second=await beginUpdate(app.db,'owner');for(const law of catalog)await app.db.prepare('INSERT INTO legal_entries (run_id,law_id,payload,source_hash) VALUES (?,?,?,?)').bind(second.runId,law.id,'{}','verified-fixture').run();await app.db.prepare('UPDATE legal_runs SET cursor=? WHERE id=?').bind(catalog.length,second.runId).run();const completed=await publishUpdate(app.db,second.runId);assert.equal(completed.activeRun,second.runId);assert.notEqual(completed.lastSuccessfulCheck,before.lastSuccessfulCheck);});
test('Unattended maintenance requires the separately configured application credential hash',async()=>{const {db}=database();const key='test-only-supported-service-credential-123456789';const {digest}=await import('../server/security');const handler=createAPI({DB:db,MAINTENANCE_KEY_HASH:await digest(key)});const body={action:'status'};assert.equal((await handler.api(request('/api/maintenance','POST',body))).status,403);const r=request('/api/maintenance','POST',body);r.headers.set('x-aushang-service-key',key);assert.equal((await handler.api(r)).status,200);});

async function deviceFixture(){
 const app=setup(),password='Device-test lange Passphrase!';
 const r=await app.api(request('/api/auth/register','POST',{...site,username:'device-owner',password}));assert.equal(r.status,201);
 const admin=cookie(r),recoveryCode=(await r.json() as any).recoveryCode;
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
 const enrolled=await app.api(request('/api/devices','POST',{label:'Firmencomputer A',publicKey},admin));assert.equal(enrolled.status,201);
 return {app,password,admin,recoveryCode,pair,device:await enrolled.json() as any};
}
async function proof(f:Awaited<ReturnType<typeof deviceFixture>>,key=f.pair.privateKey){
 const c=await f.app.api(request('/api/device/challenge','POST',{deviceId:f.device.id}));assert.equal(c.status,200);const challenge=await c.json() as any;
 const signature=Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(challenge.message))).toString('base64url');
 return {deviceId:f.device.id,challengeId:challenge.challengeId,signature};
}
test('Copied device links and wrong browser keys do not unlock; signed proofs are single-use',async()=>{
 const f=await deviceFixture();assert.match(f.device.path,/^\/geraet\/[a-f0-9-]{36}$/);assert.equal(Object.keys(f.device).some(k=>/password|token|private/i.test(k)),false);
 assert.equal((await f.app.api(request('/api/catalog'))).status,401);
 const other=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const wrong=await proof(f,other.privateKey);assert.equal((await f.app.api(request('/api/device/unlock','POST',wrong))).status,401);
 const p=await proof(f);const r=await f.app.api(request('/api/device/unlock','POST',p));assert.equal(r.status,200);
 assert.equal((await f.app.api(request('/api/device/unlock','POST',p))).status,401);
 const me=await(await f.app.api(request('/api/me','GET',undefined,cookie(r)))).json() as any;assert.equal(me.account.work,site.work);assert.equal(me.access.kind,'device');assert.equal(me.access.deviceId,f.device.id);assert.equal('public_key' in me.account,false);
 assert.equal((await f.app.api(request('/api/catalog','GET',undefined,cookie(r)))).status,200);
 assert.equal((await f.app.api(request('/api/devices','GET',undefined,cookie(r)))).status,403);
 assert.equal((await f.app.api(request('/api/auth/password','POST',{currentPassword:f.password,newPassword:'Another lange Device-Passphrase!'},cookie(r)))).status,403);
 const cross=await proof(f);assert.equal((await f.app.api(request('/api/device/unlock','POST',cross,'','https://attacker.example'))).status,403);
});
test('A durable device key opens again after session expiry and revocation immediately blocks old links',async()=>{
 const f=await deviceFixture();let p=await proof(f);const r=await f.app.api(request('/api/device/unlock','POST',p));assert.equal(r.status,200);const readerCookie=cookie(r);
 f.app.sql.prepare('UPDATE sessions SET expires_at=0 WHERE device_id=?').run(f.device.id);
 assert.equal((await(await f.app.api(request('/api/me','GET',undefined,readerCookie))).json() as any).account,null);
 p=await proof(f);const reopened=await f.app.api(request('/api/device/unlock','POST',p));assert.equal(reopened.status,200);
 const pending=await proof(f);assert.equal((await f.app.api(request('/api/devices/'+f.device.id,'DELETE',undefined,f.admin))).status,200);
 assert.equal((await f.app.api(request('/api/catalog','GET',undefined,cookie(reopened)))).status,401);
 assert.equal((await f.app.api(request('/api/device/unlock','POST',pending))).status,401);
 assert.equal((await f.app.api(request('/api/device/challenge','POST',{deviceId:f.device.id}))).status,403);
});
test('Challenges expire, account boundaries hold, and password recovery revokes device keys',async()=>{
 const f=await deviceFixture();const pending=await proof(f);f.app.sql.prepare('UPDATE device_challenges SET expires_at=0').run();assert.equal((await f.app.api(request('/api/device/unlock','POST',pending))).status,401);
 const other=await f.app.api(request('/api/auth/register','POST',{...site,username:'device-other',password:'Other test-only lange Passphrase!'}));assert.equal((await f.app.api(request('/api/devices/'+f.device.id,'DELETE',undefined,cookie(other)))).status,404);
 const recover=await f.app.api(request('/api/auth/recover','POST',{username:'device-owner',recoveryCode:f.recoveryCode,newPassword:'Device recovery lange Passphrase!'}));assert.equal(recover.status,200);
 assert.equal((await f.app.api(request('/api/device/challenge','POST',{deviceId:f.device.id}))).status,403);
});
test('Public source metadata never contains customer or device details',async()=>{
 const f=await deviceFixture();const r=await f.app.api(request('/api/public/sources'));assert.equal(r.status,200);const value=await r.json() as any;assert.equal(value.sources.length,44);const raw=JSON.stringify(value);for(const secret of [site.company,site.work,site.street,'device-owner',f.device.id])assert.equal(raw.includes(secret),false);
});
