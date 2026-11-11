import test from 'node:test';
import assert from 'node:assert/strict';
import {createAPI} from '../server/api';
import {digest} from '../server/security';
import {canRead} from '../server/accounts';
import {setup,request,site,cookie} from './helpers';

const grant={username:'bv-alpha',reference:'Explicit test-only permanent own-site grant',unlimitedConfirmed:true,enableOwnSiteEditing:true};
function operator(name:string,args:any,verified=true){const r=request('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});if(verified){r.headers.set('oai-authenticated-user-email','owner@tests.invalid');r.headers.set('oai-authenticated-user-id','test-only-owner');}return r;}
async function register(app:ReturnType<typeof setup>,username:string){const r=await app.api(request('/api/auth/register','POST',{...site,username,password:'Synthetic permanent BV test password!'}));assert.equal(r.status,201);return cookie(r);}
async function fixture(){const app=setup(),admin=await register(app,'bv-alpha'),other=await register(app,'bv-beta');assert.equal((await app.mcp(operator('grant_permanent_access',grant))).status,200);assert.equal((await app.mcp(operator('grant_permanent_access',{...grant,username:'bv-beta'}))).status,200);return {app,admin,other};}
async function reader(app:ReturnType<typeof setup>,admin:string){const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);const publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey);const enrolled=await app.api(request('/api/devices','POST',{label:'Test-only reader',publicKey},admin));assert.equal(enrolled.status,201);const device=await enrolled.json() as any;const challenge=await(await app.api(request('/api/device/challenge','POST',{deviceId:device.id}))).json() as any;const signature=Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(challenge.message))).toString('base64url');const unlocked=await app.api(request('/api/device/unlock','POST',{deviceId:device.id,challengeId:challenge.challengeId,signature}));assert.equal(unlocked.status,200);return {session:cookie(unlocked),device};}
const link={title:'BV Arbeitszeit',url:'https://company.example/sites/personal/BV.pdf?web=1',version:'2026',published:true};

test('Permanent operator grant is exact-account, unpaid, idempotent and leaves other accounts and credentials unchanged',async()=>{
 const app=setup(),admin=await register(app,'bv-alpha');await register(app,'bv-beta');
 const before=app.sql.prepare('SELECT * FROM accounts WHERE username=?').get('bv-alpha')!;
 const other=app.sql.prepare('SELECT * FROM accounts WHERE username=?').get('bv-beta');
 for(const name of ['get_customer_access','grant_permanent_access'])assert.equal((await app.mcp(operator(name,grant,false))).status,403);
 assert.equal((await app.api(request('/api/maintenance','POST',{action:'customer-permanent',...grant},admin))).status,403);
 assert.equal((await app.mcp(operator('grant_permanent_access',{...grant,paymentConfirmed:true}))).status,400);
 assert.equal((await app.mcp(operator('grant_permanent_access',{...grant,unlimitedConfirmed:false}))).status,400);
 const granted=await app.mcp(operator('grant_permanent_access',grant));assert.equal(granted.status,200);const value=(await granted.json() as any).result.structuredContent;
 assert.deepEqual(value,{username:'bv-alpha',status:'active',permanent:true,validUntil:null,documentsEnabled:true,bvLinksEnabled:true,permissions:'own-site-only',grantType:'permanent-complimentary',paymentConfirmed:false,paymentCaptured:false});
 const after=app.sql.prepare('SELECT * FROM accounts WHERE username=?').get('bv-alpha')!;
 for(const key of ['id','password_hash','recovery_hash','company','work','street','house_number','postal_code','city'])assert.equal(after[key],before[key]);
 assert.deepEqual(app.sql.prepare('SELECT * FROM accounts WHERE username=?').get('bv-beta'),other);
 assert.equal((await app.mcp(operator('grant_permanent_access',grant))).status,200);assert.equal(app.sql.prepare('SELECT COUNT(*) AS n FROM access_events').get()?.n,1);
 assert.deepEqual(app.sql.prepare('SELECT action,valid_until FROM access_events').get(),Object.assign(Object.create(null),{action:'permanent-complimentary',valid_until:null}));
 const exact=(await(await app.mcp(operator('get_customer_access',{username:'bv-alpha'}))).json() as any).result.structuredContent;
 assert.equal(exact.username,'bv-alpha');assert.equal('customers' in exact,false);assert.equal('id' in exact,false);assert.equal('password_hash' in exact,false);
 const me=await(await app.api(request('/api/me','GET',undefined,admin))).json() as any;assert.equal(me.access.canRead,true);assert.equal(me.account.licensePermanent,1);assert.equal(me.account.licenseValidUntil,null);
 assert.ok(canRead({...me.account,licenseValidUntil:1}));assert.equal(canRead({...me.account,accessStatus:'suspended'}),false);
 // Normal account sessions never acquire site-operator privileges.
 assert.equal((await app.api(request('/api/customers','GET',undefined,admin))).status,404);
 assert.equal((await app.mcp(operator('get_customer_access',{username:'bv-beta'},false))).status,403);
});

test('Scoped service operation requires its existing application credential and returns only the selected account',async()=>{
 const app=setup();await register(app,'bv-alpha');await register(app,'bv-beta');const key='test-only-supported-service-key-permanent-123456';const handler=createAPI({DB:app.db,MAINTENANCE_KEY_HASH:await digest(key)});
 const req=request('/api/maintenance','POST',{action:'customer-permanent',...grant});req.headers.set('x-aushang-service-key',key);const r=await handler.api(req);assert.equal(r.status,200);assert.equal((await r.json() as any).username,'bv-alpha');
 const get=request('/api/maintenance','POST',{action:'customer-get',username:'bv-alpha'});get.headers.set('x-aushang-service-key',key);assert.equal((await(await handler.api(get)).json() as any).permanent,true);assert.equal(app.sql.prepare('SELECT access_status FROM accounts WHERE username=?').get('bv-beta')?.access_status,'pending');
 await app.mcp(operator('suspend_customer_access',{username:'bv-alpha',reference:'Test-only suspension'}));assert.equal((await app.mcp(operator('grant_permanent_access',grant))).status,409);
});

test('BV links are isolated per Werk; drafts, trash and management remain password-only',async()=>{
 const {app,admin,other}=await fixture(),read=await reader(app,admin);
 assert.equal((await app.api(request('/api/bv-links'))).status,401);
 const added=await app.api(request('/api/bv-links','POST',{...link,accountId:'bv-beta'},admin));assert.equal(added.status,201);const {id}=await added.json() as any;
 const draft=await app.api(request('/api/bv-links','POST',{...link,title:'Private draft',published:false},admin));const draftId=(await draft.json() as any).id;
 const own=await(await app.api(request('/api/bv-links','GET',undefined,read.session))).json() as any;assert.equal(own.links.length,1);assert.equal(own.links[0].id,id);assert.equal(own.canManage,false);assert.equal(own.links[0].url,link.url);
 assert.deepEqual((await(await app.api(request('/api/bv-links','GET',undefined,other))).json() as any).links,[]);
 for(const [method,path,body] of [['PATCH','/api/bv-links/'+id,link],['DELETE','/api/bv-links/'+id,undefined],['POST','/api/bv-links/'+id+'/restore',{}],['GET','/api/bv-links/'+id+'/open',undefined]] as const)assert.equal((await app.api(request(path,method,body,other))).status,404);
 for(const [method,path,body] of [['POST','/api/bv-links',link],['PATCH','/api/bv-links/'+id,link],['DELETE','/api/bv-links/'+id,undefined],['PUT','/api/bv-links/settings',{enabled:false}]] as const)assert.equal((await app.api(request(path,method,body,read.session))).status,403);
 assert.equal((await app.api(request('/api/bv-links/'+draftId+'/open','GET',undefined,read.session))).status,404);
 assert.equal((await app.api(request('/api/bv-links/'+draftId+'/open','GET',undefined,admin))).status,303);
 assert.equal((await app.api(request('/api/bv-links/'+id,'DELETE',undefined,admin))).status,200);
 assert.equal((await app.api(request('/api/bv-links/'+id+'/open','GET',undefined,read.session))).status,404);
 assert.equal((await(await app.api(request('/api/bv-links?trash=1','GET',undefined,read.session))).json() as any).links.length,0);
 assert.equal((await(await app.api(request('/api/bv-links?trash=1','GET',undefined,admin))).json() as any).links.length,1);
 assert.equal((await app.api(request('/api/bv-links/'+id+'/restore','POST',{},admin))).status,200);
});

test('BV sharing works for own logged-in readers without extra device approval; no file is copied or fetched',async()=>{
 const {app,admin}=await fixture(),read=await reader(app,admin);const added=await app.api(request('/api/bv-links','POST',link,admin)),{id}=await added.json() as any;
 const original=globalThis.fetch;let fetched=false;globalThis.fetch=async()=>{fetched=true;throw Error('No target fetch expected');};
 try{for(const session of [admin,read.session]){const opened=await app.api(request('/api/bv-links/'+id+'/open','GET',undefined,session));assert.equal(opened.status,303);assert.equal(opened.headers.get('Location'),link.url);assert.match(opened.headers.get('Cache-Control')||'',/no-store/);assert.equal(opened.headers.get('Referrer-Policy'),'no-referrer');}}finally{globalThis.fetch=original;}
 assert.equal(fetched,false);assert.equal(app.sql.prepare('SELECT COUNT(*) AS n FROM company_documents').get()?.n,0);
 assert.equal((await app.api(request('/api/bv-links/'+id+'/open'))).status,401);
 await app.api(request('/api/bv-links/settings','PUT',{enabled:false},admin));assert.equal((await(await app.api(request('/api/bv-links','GET',undefined,read.session))).json() as any).links.length,0);assert.equal((await app.api(request('/api/bv-links/'+id+'/open','GET',undefined,read.session))).status,404);
 await app.api(request('/api/bv-links/settings','PUT',{enabled:true},admin));
 await app.api(request('/api/devices/'+read.device.id,'DELETE',undefined,admin));assert.equal((await app.api(request('/api/bv-links','GET',undefined,read.session))).status,401);
});

test('BV rejects unsafe URLs, origin spoofing and expired ordinary licenses',async()=>{
 const {app,admin}=await fixture();
 for(const url of ['javascript:alert(1)','http://company.example/bv','https://user:pass@company.example/bv','https://company.example:444/bv','https://company.example/bv?token=secret','https://company.example/bv?password=secret','https://company.example/has space'])assert.equal((await app.api(request('/api/bv-links','POST',{...link,url},admin))).status,400,url);
 assert.equal((await app.api(request('/api/bv-links','POST',link,admin,'https://attacker.example'))).status,403);
 app.sql.prepare('UPDATE accounts SET license_permanent=0,license_valid_until=0 WHERE username=?').run('bv-alpha');assert.equal((await app.api(request('/api/bv-links','GET',undefined,admin))).status,402);
});
