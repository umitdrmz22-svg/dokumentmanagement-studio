import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createAPI} from '../server/api';
import {beginUpdate,continueUpdate,publishUpdate,updateMeta} from '../server/updates';
import {catalog} from '../server/generated-legal';
import {database,request,site,cookie,setup,grantForTest} from './helpers';
test('Real registration requires the full site and unauthenticated legal-text access is blocked',async()=>{const app=setup();const missing=await app.api(request('/api/auth/register','POST',{...site,work:'',username:'test-standort',password:'Test-only lange Passphrase!'}));assert.equal(missing.status,400);assert.equal(app.sql.prepare('SELECT count(*) AS n FROM accounts').get()?.n,0);for(const url of ['/api/catalog','/api/texts/arbzg','/api/pdf/dguv1'])assert.equal((await app.api(request(url))).status,401);});
test('Accounts retain their registered address and favorites never cross account boundaries',async()=>{const app=setup();const ra=await app.api(request('/api/auth/register','POST',{...site,username:'test-alpha',password:'Test-only lange Passphrase Alpha!'}));assert.equal(ra.status,201);grantForTest(app.sql,'test-alpha');const ca=cookie(ra);const a=await ra.json() as any;assert.match(a.recoveryCode,/^[a-f0-9]{64}$/);const rb=await app.api(request('/api/auth/register','POST',{...site,work:'Werk Beta',username:'test-beta',password:'Test-only lange Passphrase Beta!'}));assert.equal(rb.status,201);grantForTest(app.sql,'test-beta');const cb=cookie(rb);const meA=await(await app.api(request('/api/me','GET',undefined,ca))).json() as any;assert.equal(meA.account.work,'Werk Alpha');assert.equal(meA.account.postalCode,'12345');assert.equal('password_hash' in meA.account,false);const save=await app.api(request('/api/favorites','PUT',{favorites:['arbzg'],accountId:'test-beta'},ca));assert.equal(save.status,200);const meB=await(await app.api(request('/api/me','GET',undefined,cb))).json() as any;assert.deepEqual(meB.favorites,[]);assert.equal(meB.account.work,'Werk Beta');const cross=await app.api(request('/api/favorites','PUT',{favorites:['agg']},ca,'https://attacker.example'));assert.equal(cross.status,403);const spoof=await(await app.api(request('/api/me?accountId='+meB.account.id,'GET',undefined,ca))).json() as any;assert.equal(spoof.account.work,'Werk Alpha');assert.equal((await app.api(request('/api/account','PATCH',{work:'Another work'},ca))).status,404);});
test('Password change and recovery revoke previous sessions; recovery codes are one-time',async()=>{const app=setup();const pass='Test-only lange Passphrase Alpha!';const registered=await app.api(request('/api/auth/register','POST',{...site,username:'test-password',password:pass}));const oldCookie=cookie(registered),code=(await registered.json() as any).recoveryCode;const login=await app.api(request('/api/auth/login','POST',{username:'test-password',password:pass}));assert.equal(login.status,200);const changed=await app.api(request('/api/auth/password','POST',{currentPassword:pass,newPassword:'Test-only neue Passphrase Delta!'},oldCookie));assert.equal(changed.status,200);for(const c of [oldCookie,cookie(login)])assert.equal((await(await app.api(request('/api/me','GET',undefined,c))).json() as any).account,null);const recovered=await app.api(request('/api/auth/recover','POST',{username:'test-password',recoveryCode:code,newPassword:'Test-only wiederhergestellte Passphrase!'}));assert.equal(recovered.status,200);assert.notEqual((await recovered.json() as any).recoveryCode,code);assert.equal((await app.api(request('/api/auth/recover','POST',{username:'test-password',recoveryCode:code,newPassword:'Test-only wiederhergestellte Passphrase!'}))).status,401);assert.equal((await(await app.api(request('/api/me','GET',undefined,cookie(changed)))).json() as any).account,null);});
test('Maintenance tools reject anonymous and non-owner callers',async()=>{const app=setup();const body={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_update_status',arguments:{}}};assert.equal((await app.mcp(request('/mcp','POST',body))).status,403);const r=request('/mcp','POST',body);r.headers.set('oai-authenticated-user-email','other@tests.invalid');r.headers.set('oai-authenticated-user-id','other');assert.equal((await app.mcp(r)).status,403);});
test('Failed and incomplete source updates keep the previous active version and date',async()=>{const app=setup();const before=await updateMeta(app.db);const run=await beginUpdate(app.db,'owner');await assert.rejects(()=>publishUpdate(app.db,run.runId));const original=globalThis.fetch;globalThis.fetch=async()=>new Response('Unavailable',{status:503});try{await assert.rejects(()=>continueUpdate(app.db,{} as R2Bucket,run.runId));}finally{globalThis.fetch=original;}const after=await updateMeta(app.db);assert.equal(after.activeRun,before.activeRun);assert.equal(after.lastSuccessfulCheck,before.lastSuccessfulCheck);assert.equal(after.lastAttemptStatus,'failed');const second=await beginUpdate(app.db,'owner');for(const law of catalog)await app.db.prepare('INSERT INTO legal_entries (run_id,law_id,payload,source_hash) VALUES (?,?,?,?)').bind(second.runId,law.id,'{}','verified-fixture').run();await app.db.prepare('UPDATE legal_runs SET cursor=? WHERE id=?').bind(catalog.length,second.runId).run();const completed=await publishUpdate(app.db,second.runId);assert.equal(completed.activeRun,second.runId);assert.notEqual(completed.lastSuccessfulCheck,before.lastSuccessfulCheck);});
test('Unattended maintenance requires the separately configured application credential hash',async()=>{const {db}=database();const key='test-only-supported-service-credential-123456789';const {digest}=await import('../server/security');const handler=createAPI({DB:db,MAINTENANCE_KEY_HASH:await digest(key)});const body={action:'status'};assert.equal((await handler.api(request('/api/maintenance','POST',body))).status,403);const r=request('/api/maintenance','POST',body);r.headers.set('x-aushang-service-key',key);assert.equal((await handler.api(r)).status,200);});

async function deviceFixture(){
 const app=setup(),password='Device-test lange Passphrase!';
 const r=await app.api(request('/api/auth/register','POST',{...site,username:'device-owner',password}));assert.equal(r.status,201);
 grantForTest(app.sql,'device-owner');const admin=cookie(r),recoveryCode=(await r.json() as any).recoveryCode;
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
test('Authenticated source metadata never contains customer or device details',async()=>{
 const f=await deviceFixture();assert.equal((await f.app.api(request('/api/public/sources'))).status,401);const r=await f.app.api(request('/api/sources','GET',undefined,f.admin));assert.equal(r.status,200);const value=await r.json() as any;assert.equal(value.sources.length,44);const raw=JSON.stringify(value);for(const secret of [site.company,site.work,site.street,'device-owner',f.device.id])assert.equal(raw.includes(secret),false);
});

function operatorCall(name:string,args:any={},verified=true){const r=request('/mcp','POST',{jsonrpc:'2.0',id:5,method:'tools/call',params:{name,arguments:args}});if(verified){r.headers.set('oai-authenticated-user-email','owner@tests.invalid');r.headers.set('oai-authenticated-user-id','test-only-verified-owner');}return r;}
test('A registration is unpaid and protected content opens only after verified operator payment confirmation',async()=>{
 const app=setup();const r=await app.api(request('/api/auth/register','POST',{...site,username:'paying-customer',password:'Payment-test lange Passphrase!',accessStatus:'active',licenseValidUntil:9999999999}));assert.equal(r.status,201);const c=cookie(r);assert.equal((await r.json() as any).pendingActivation,true);
 let me=await(await app.api(request('/api/me','GET',undefined,c))).json() as any;assert.equal(me.account.accessStatus,'pending');assert.equal(me.account.licenseValidUntil,null);assert.equal(me.access.canRead,false);
 for(const path of ['/api/catalog','/api/texts/arbzg','/api/pdf/dguv1'])assert.equal((await app.api(request(path,'GET',undefined,c))).status,402);
 assert.equal((await app.api(request('/api/favorites','PUT',{favorites:['arbzg']},c))).status,402);
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
 assert.equal((await app.api(request('/api/devices','POST',{label:'Unpaid device',publicKey},c))).status,402);
 const validUntil=(new Date().getUTCFullYear()+1)+'-12-31',args={username:'paying-customer',paymentConfirmed:true,reference:'TEST-INVOICE-01',validUntil};
 assert.equal((await app.mcp(operatorCall('activate_customer_access',args,false))).status,403);
 assert.equal((await app.mcp(operatorCall('activate_customer_access',{...args,paymentConfirmed:false}))).status,400);
 const activated=await app.mcp(operatorCall('activate_customer_access',args));assert.equal(activated.status,200);assert.equal((await activated.json() as any).result.structuredContent.paymentCaptured,false);
 me=await(await app.api(request('/api/me','GET',undefined,c))).json() as any;assert.equal(me.access.canRead,true);assert.equal((await app.api(request('/api/catalog','GET',undefined,c))).status,200);
 assert.equal((await app.api(request('/api/devices','POST',{label:'Paid device',publicKey},c))).status,201);
 assert.equal(app.sql.prepare('SELECT COUNT(*) AS n FROM access_events').get()?.n,1);
 app.sql.prepare('UPDATE accounts SET license_valid_until=0 WHERE username=?').run('paying-customer');assert.equal((await app.api(request('/api/catalog','GET',undefined,c))).status,402);assert.equal((await(await app.api(request('/api/me','GET',undefined,c))).json() as any).access.canRead,false);
});
test('License expiry blocks device proof and an operator suspension revokes all device access',async()=>{
 const f=await deviceFixture();const p=await proof(f),opened=await f.app.api(request('/api/device/unlock','POST',p));assert.equal(opened.status,200);
 f.app.sql.prepare('UPDATE accounts SET license_valid_until=0 WHERE username=?').run('device-owner');assert.equal((await f.app.api(request('/api/catalog','GET',undefined,cookie(opened)))).status,402);assert.equal((await f.app.api(request('/api/device/challenge','POST',{deviceId:f.device.id}))).status,403);
 grantForTest(f.app.sql,'device-owner');assert.equal((await f.app.mcp(operatorCall('suspend_customer_access',{username:'device-owner',reference:'Test cancellation'}))).status,200);
 assert.equal((await f.app.api(request('/api/device/challenge','POST',{deviceId:f.device.id}))).status,403);assert.equal((await(await f.app.api(request('/api/me','GET',undefined,cookie(opened)))).json() as any).account,null);
});
test('Agreed license dates end at the close of the German calendar day in winter and summer',async()=>{
 const {licenseDeadline}=await import('../server/licensing');const year=new Date().getUTCFullYear()+1;
 assert.equal(new Date(licenseDeadline(year+'-01-15')*1000).toISOString(),year+'-01-15T22:59:59.000Z');
 assert.equal(new Date(licenseDeadline(year+'-07-15')*1000).toISOString(),year+'-07-15T21:59:59.000Z');
 assert.throws(()=>licenseDeadline('2020-01-01'));assert.throws(()=>licenseDeadline(year+'-02-30'));
});

test('Additive licensing migration preserves existing credentials, addresses, favorites and device grants',()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;');const files=readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort();
 for(const file of files.slice(0,2))sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 sql.prepare('INSERT INTO accounts (id,username,password_hash,recovery_hash,company,work,street,house_number,postal_code,city,country,access_status,terms_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('legacy-id','legacy-user','unchanged-password-hash','unchanged-recovery-hash',site.company,site.work,site.street,site.houseNumber,site.postalCode,site.city,site.country,'pilot','old-terms',1);
 sql.prepare('INSERT INTO favorites (account_id,law_id) VALUES (?,?)').run('legacy-id','arbzg');
 sql.prepare('INSERT INTO devices (id,account_id,public_key,label,created_at) VALUES (?,?,?,?,?)').run('existing-device','legacy-id','existing-public-key','Existing device',1);
 for(const file of files.slice(2))sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const row=sql.prepare('SELECT * FROM accounts WHERE id=?').get('legacy-id')!;assert.equal(row.password_hash,'unchanged-password-hash');assert.equal(row.company,site.company);assert.equal(row.license_valid_until,null);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM favorites').get()?.n,1);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM devices').get()?.n,1);
});

test('Only the operator can grant an unpaid bounded demo without fabricating a payment or replacing active access',async()=>{
 const app=setup();const registered=await app.api(request('/api/auth/register','POST',{...site,username:'demo-customer',password:'Demo-only lange Test-Passphrase!'}));assert.equal(registered.status,201);const c=cookie(registered);
 const args={username:'demo-customer',reference:'Explicit operator-authorized product test',validUntil:new Date(Date.now()+14*86400000).toISOString().slice(0,10)};
 assert.equal((await app.mcp(operatorCall('grant_demo_access',args,false))).status,403);
 assert.equal((await app.mcp(operatorCall('grant_demo_access',{...args,paymentConfirmed:true}))).status,400);
 assert.equal((await app.mcp(operatorCall('grant_demo_access',{...args,validUntil:new Date(Date.now()+45*86400000).toISOString().slice(0,10)}))).status,400);
 const granted=await app.mcp(operatorCall('grant_demo_access',args));assert.equal(granted.status,200);const result=(await granted.json() as any).result.structuredContent;assert.equal(result.grantType,'demo');assert.equal(result.paymentConfirmed,false);assert.equal(result.paymentCaptured,false);
 assert.equal((await app.api(request('/api/catalog','GET',undefined,c))).status,200);const event=app.sql.prepare('SELECT action,reference FROM access_events').get()!;assert.equal(event.action,'demo');assert.equal(event.reference,args.reference);
 const before=app.sql.prepare('SELECT license_valid_until FROM accounts WHERE username=?').get(args.username)!.license_valid_until;
 assert.equal((await app.mcp(operatorCall('grant_demo_access',args))).status,409);assert.equal(app.sql.prepare('SELECT license_valid_until FROM accounts WHERE username=?').get(args.username)!.license_valid_until,before);
 const listed=await app.mcp(operatorCall('get_customer_requests'));assert.equal((await listed.json() as any).result.structuredContent.customers[0].grantType,'demo');
 await app.mcp(operatorCall('suspend_customer_access',{username:args.username,reference:'End test'}));assert.equal((await app.mcp(operatorCall('grant_demo_access',args))).status,409);
});
