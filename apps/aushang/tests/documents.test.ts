import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {createAPI} from '../server/api';
import {database,request,site,cookie,grantForTest} from './helpers';

const pdf=new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');
function environment(){
 const {sql,db}=database(),files=new Map<string,Uint8Array>();
 const bucket={async put(key:string,value:Uint8Array){files.set(key,new Uint8Array(value));},async get(key:string){const value=files.get(key);return value?{body:value}:null;},async delete(key:string){files.delete(key);}} as unknown as R2Bucket;
 return {sql,db,files,bucket,...createAPI({DB:db,BUCKET:bucket,AUTH_RATE_SECRET:'test-only-document-rate-secret'})};
}
async function account(app:ReturnType<typeof environment>,user:string){const r=await app.api(request('/api/auth/register','POST',{...site,username:user,password:'Document-test lange Passphrase!'}));assert.equal(r.status,201);grantForTest(app.sql,user);return cookie(r);}
function upload(c:string,options:{name?:string;mime?:string;bytes?:Uint8Array;published?:boolean;title?:string}={}){const form=new FormData();form.set('file',new Blob([new Uint8Array(options.bytes||pdf).buffer],{type:options.mime||'application/pdf'}),options.name||'Betriebsvereinbarung.pdf');form.set('title',options.title||'Betriebsvereinbarung Arbeitszeit');form.set('category','Betriebsvereinbarung');form.set('version','1.0');form.set('effectiveDate','2026-11-06');form.set('published',String(options.published||false));return new Request('https://portal.example/api/documents',{method:'POST',headers:{Origin:'https://portal.example',Cookie:c},body:form});}
async function reader(app:ReturnType<typeof environment>,c:string){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);const enrolled=await app.api(request('/api/devices','POST',{label:'Document reading kiosk',publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)},c));const {id}=await enrolled.json() as any;const challenge=await(await app.api(request('/api/device/challenge','POST',{deviceId:id}))).json() as any;const signature=Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(challenge.message))).toString('base64url');const r=await app.api(request('/api/device/unlock','POST',{deviceId:id,challengeId:challenge.challengeId,signature}));assert.equal(r.status,200);return cookie(r);}

test('Company documents are opt-in, drafts are private and account boundaries protect every file operation',async()=>{
 const app=environment(),a=await account(app,'docs-alpha'),b=await account(app,'docs-beta');
 assert.equal((await app.api(upload(a))).status,404);assert.equal(app.files.size,0);
 assert.equal((await app.api(request('/api/documents/settings','PUT',{enabled:true},a))).status,200);
 const u=await app.api(upload(a));assert.equal(u.status,201);const item=await u.json() as any;assert.equal(item.published,0);
 const ra=await reader(app,a);assert.equal((await(await app.api(request('/api/documents','GET',undefined,ra))).json() as any).documents.length,0);
 assert.equal((await app.api(request('/api/documents/'+item.id+'/download','GET',undefined,ra))).status,404);
 await app.api(request('/api/documents/settings','PUT',{enabled:true},b));
 assert.equal((await(await app.api(request('/api/documents','GET',undefined,b))).json() as any).documents.length,0);
 for(const [path,method,body] of [[item.id+'/download','GET',undefined],[item.id,'PATCH',{title:'Stolen',category:'Sonstiges',published:true}],[item.id,'DELETE',undefined],[item.id+'/restore','POST',{}]])assert.equal((await app.api(request('/api/documents/'+path,method as string,body,b))).status,404);
 const meta={title:item.title,category:item.category,version:item.version,effectiveDate:item.effectiveDate,published:true,accountId:'spoofed'};
 assert.equal((await app.api(request('/api/documents/'+item.id,'PATCH',meta,a))).status,200);
 const listed=await(await app.api(request('/api/documents','GET',undefined,ra))).json() as any;assert.equal(listed.documents.length,1);assert.equal(JSON.stringify(listed).includes('storageKey'),false);
 const download=await app.api(request('/api/documents/'+item.id+'/download','GET',undefined,ra));assert.equal(download.status,200);assert.match(download.headers.get('Content-Disposition')!,/^attachment;/);assert.match(download.headers.get('Cache-Control')!,/no-store/);assert.deepEqual(new Uint8Array(await download.arrayBuffer()),pdf);
 await app.api(request('/api/documents/settings','PUT',{enabled:false},a));assert.equal((await app.api(request('/api/documents/'+item.id+'/download','GET',undefined,ra))).status,404);assert.equal(app.files.size,1);
});

test('Device readers cannot upload, publish, enable, delete or inspect the trash',async()=>{
 const app=environment(),a=await account(app,'docs-reader'),r=await reader(app,a);await app.api(request('/api/documents/settings','PUT',{enabled:true},a));const item=await(await app.api(upload(a,{published:true}))).json() as any;
 assert.equal((await app.api(upload(r))).status,403);assert.equal((await app.api(request('/api/documents/settings','PUT',{enabled:false},r))).status,403);
 assert.equal((await app.api(request('/api/documents/'+item.id,'PATCH',{title:item.title,category:item.category,published:false},r))).status,403);
 assert.equal((await app.api(request('/api/documents/'+item.id,'DELETE',undefined,r))).status,403);assert.equal((await app.api(request('/api/documents?trash=1','GET',undefined,r))).status,403);
});

test('Trash can be restored; permanent deletion requires a separate explicit request and frees private storage',async()=>{
 const app=environment(),a=await account(app,'docs-trash');await app.api(request('/api/documents/settings','PUT',{enabled:true},a));const item=await(await app.api(upload(a))).json() as any;
 assert.equal((await app.api(request('/api/documents/'+item.id+'/permanent','DELETE',{confirm:'PERMANENT_DELETE'},a))).status,409);
 await app.api(request('/api/documents/'+item.id,'DELETE',undefined,a));assert.equal((await app.api(request('/api/documents/'+item.id+'/download','GET',undefined,a))).status,404);assert.equal(app.files.size,1);
 assert.equal((await app.api(request('/api/documents/'+item.id+'/restore','POST',{},a))).status,200);assert.equal((await app.api(request('/api/documents/'+item.id+'/download','GET',undefined,a))).status,200);
 await app.api(request('/api/documents/'+item.id,'DELETE',undefined,a));assert.equal((await app.api(request('/api/documents/'+item.id+'/permanent','DELETE',{},a))).status,400);
 assert.equal((await app.api(request('/api/documents/'+item.id+'/permanent','DELETE',{confirm:'PERMANENT_DELETE'},a))).status,200);assert.equal(app.files.size,0);
});

test('File type checks reject renamed HTML and malformed DOCX; valid DOCX downloads as an attachment',async()=>{
 const app=environment(),a=await account(app,'docs-format');await app.api(request('/api/documents/settings','PUT',{enabled:true},a));
 assert.equal((await app.api(upload(a,{bytes:strToU8('<html>not a PDF</html>')}))).status,400);
 assert.equal((await app.api(upload(a,{name:'Policy.html',mime:'text/html'}))).status,415);
 assert.equal((await app.api(upload(a,{name:'Policy.docx',mime:'application/zip',bytes:strToU8('PKinvalid')}))).status,400);
 const docx=zipSync({'[Content_Types].xml':strToU8('<Types/>'),'word/document.xml':strToU8('<w:document/>')});
 const good=await app.api(upload(a,{name:'Policy.docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',bytes:docx}));assert.equal(good.status,201);
 const id=(await good.json() as any).id;const response=await app.api(request('/api/documents/'+id+'/download','GET',undefined,a));assert.match(response.headers.get('Content-Disposition')!,/attachment/);assert.match(response.headers.get('Content-Type')!,/wordprocessingml/);
});

test('Expired customers can retrieve their own documents through password management; expired readers cannot access them',async()=>{
 const app=environment(),a=await account(app,'docs-expired');await app.api(request('/api/documents/settings','PUT',{enabled:true},a));const item=await(await app.api(upload(a,{published:true}))).json() as any,r=await reader(app,a);
 app.sql.prepare('UPDATE accounts SET license_valid_until=0 WHERE username=?').run('docs-expired');
 assert.equal((await app.api(request('/api/documents/'+item.id+'/download','GET',undefined,a))).status,200);
 assert.equal((await app.api(upload(a))).status,402);assert.equal((await app.api(request('/api/documents/'+item.id+'/download','GET',undefined,r))).status,402);
});
