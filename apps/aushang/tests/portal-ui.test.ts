import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {setup,request,site,cookie,grantForTest} from './helpers';

// Run the actual browser controller against the real API with a minimal DOM adapter.
// No production account, password, device key or document is created by these tests.
async function client(app:ReturnType<typeof setup>,session='',hash='',deviceId:string|null=null){
 const listeners:Record<string,Function[]>={},calls:string[]=[],copied:string[]=[],nodes=new Map<string,any>();let currentCookie=session;let intercept:((path:string,result:Response)=>Promise<Response>)|null=null;
 const node=(id:string)=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:false,value:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},scrollIntoView(){},focus(){},showModal(){},close(){},querySelector(){return null;}});return nodes.get(id);};
 const root=node('#app'),location={hash,href:'https://portal.example/'+hash},history={pushState(_a:any,_b:any,h:string){location.hash=h;},replaceState(_a:any,_b:any,h:string){location.hash=h;}};
 const document={title:'',querySelector(selector:string){if(['#app','#update-bar','#update-date','#update-policy','#dialog','#dialog-close','#dialog-content','#dialog-eyebrow','#toast'].includes(selector))return node(selector);if(selector.startsWith('#')&&(root.innerHTML+node('#dialog-content').innerHTML).includes('id="'+selector.slice(1)+'"'))return node(selector);return null;},querySelectorAll(){return [];},addEventListener(type:string,fn:Function){(listeners[type]??=[]).push(fn);},getElementById(id:string){return node('#'+id);}};
 const window={AushangDevice:{activeId:deviceId,async unlock(){},async hasKey(){return false;},url(id:string){return '/geraet/'+id;}},addEventListener(){},scrollTo(){},open(){}};
 const context={document,window,location,history,navigator:{clipboard:{async writeText(value:string){copied.push(value);}}},localStorage:{removeItem(){}},setTimeout:(fn:Function,ms:number)=>{const t=setTimeout(fn as ()=>void,ms);t.unref();return t;},clearTimeout,setInterval:(fn:Function,ms:number)=>{const t=setInterval(fn as ()=>void,ms);t.unref();return t;},clearInterval,URL,FormData:class{constructor(private form:any){}get(key:string){return this.form.values[key]??null;}[Symbol.iterator](){return Object.entries(this.form.values)[Symbol.iterator]();}},fetch:async(path:string,options:any={})=>{calls.push(path);const result=await app.api(request(path,options.method||'GET',options.body?JSON.parse(options.body):undefined,currentCookie));const set=cookie(result);if(set)currentCookie=set;return intercept?await intercept(path,result):result;}};
 vm.runInNewContext(readFileSync(new URL('../web/app.js',import.meta.url),'utf8'),context);
 for(let i=0;i<400&&(!root.innerHTML||root.innerHTML.includes('Firmenzugang wird geöffnet.'));i++)await new Promise(r=>setTimeout(r,5));assert.ok(root.innerHTML,'client initialized');
 const eventButton=(dataset:any)=>({dataset,isConnected:true,disabled:false});
 return {root,calls,copied,location,node,document,setInterceptor(fn:typeof intercept){intercept=fn;},async click(dataset:any){const button=eventButton(dataset);await Promise.all((listeners.click||[]).map(fn=>fn({target:{closest:()=>button},preventDefault(){}})));},async submit(id:string,values:Record<string,string>={},dataset:Record<string,string>={}){const button=eventButton({});await Promise.all((listeners.submit||[]).map(fn=>fn({target:{id,values,dataset,querySelector:()=>button},submitter:{value:'portal'},preventDefault(){}})));}};
}
async function registered(name:string){const app=setup(),password='UI-test lange Passphrase!';const r=await app.api(request('/api/auth/register','POST',{...site,username:name,password}));grantForTest(app.sql,name);return {app,password,session:cookie(r)};}

test('anonymous deep links show only sign-in and never request catalog or topic data',async()=>{
 for(const hash of ['','#aushang','#alle-gesetze','#arbeitssicherheit','#favorites','#documents','#bv','#site','#site-admin','#gesetz/arbzg']){const page=await client(setup(),'',hash);assert.match(page.root.innerHTML,/id="login-form"/);assert.ok(!page.root.innerHTML.includes('Hauptnavigation'));assert.ok(!page.root.innerHTML.includes('law-results'));assert.ok(!page.root.innerHTML.includes('data-view="favorites"'));assert.deepEqual(page.calls,['/api/me']);}
});

test('password sign-in opens the registered site aushang home; every content area has search and favorites',async()=>{
 const {app,password,session}=await registered('ui-site');await app.api(request('/api/favorites','PUT',{favorites:['arbzg']},session));const page=await client(app);await page.submit('login-form',{username:'ui-site',password});
 assert.match(page.location.hash,/#aushang/);assert.match(page.root.innerHTML,/<h1>Aushangpflichtige Gesetze<\/h1>/);assert.ok(page.root.innerHTML.includes(site.work));assert.ok(page.root.innerHTML.includes(site.street));assert.ok(page.root.innerHTML.includes('data-view="favorites"'));
 for(const view of ['collection','arbeitssicherheit','favorites','account','documents','bv']){await page.click({view});assert.ok(/id="(?:library-search|global-library-search)"/.test(page.root.innerHTML),view);if(view==='favorites')assert.ok(page.root.innerHTML.includes('Arbeitszeitgesetz'));}
 await page.click({action:'logout'});assert.match(page.root.innerHTML,/id="login-form"/);assert.ok(!page.root.innerHTML.includes(site.work));assert.ok(!page.root.innerHTML.includes('data-view="favorites"'));
});

test('global search finds technical rules and ordinary work-specific sessions reopen at aushang home',async()=>{
 const {app,session}=await registered('ui-search');const page=await client(app,session);assert.match(page.root.innerHTML,/<h1>Aushangpflichtige Gesetze<\/h1>/);
 await page.click({view:'account'});page.node('#global-law-search').value='ASR';await page.submit('global-library-search');assert.match(page.location.hash,/#search/);assert.ok(page.root.innerHTML.includes('Technische Regel'));assert.ok(page.root.innerHTML.includes('Maßnahmen gegen Brände'));
 await page.click({view:'aushang'});await page.click({law:'arbzg'});assert.ok(page.root.innerHTML.includes('id="global-library-search"'));
});

test('a verified site-specific device session opens the aushang home and its saved favorites',async()=>{
 const {app,session}=await registered('ui-device');await app.api(request('/api/favorites','PUT',{favorites:['arbzg']},session));
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
 const enrolled=await app.api(request('/api/devices','POST',{label:'Test Firmencomputer',publicKey},session));const device=await enrolled.json() as any;
 const challenge=await(await app.api(request('/api/device/challenge','POST',{deviceId:device.id}))).json() as any;const signature=Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(challenge.message))).toString('base64url');
 const unlocked=await app.api(request('/api/device/unlock','POST',{deviceId:device.id,challengeId:challenge.challengeId,signature}));assert.equal(unlocked.status,200);
 const page=await client(app,cookie(unlocked),'',device.id);assert.match(page.root.innerHTML,/<h1>Aushangpflichtige Gesetze<\/h1>/);assert.ok(page.root.innerHTML.includes(site.work));assert.ok(page.root.innerHTML.includes('Freigeschalteter Firmencomputer'));assert.ok(!page.calls.includes('/api/devices'));await page.click({view:'favorites'});assert.ok(page.root.innerHTML.includes('Arbeitszeitgesetz'));
});

test('workplace home exposes publication status and keeps unpublished employer information out of reading views',async()=>{
 const {app,session}=await registered('ui-notices');const empty=await(await app.api(request('/api/site-notices','GET',undefined,session))).json() as any;
 empty.draft.agg.text='Nicht freigegebene interne Entwurfsangabe';await app.api(request('/api/site-notices','PUT',{revision:0,notices:empty.draft},session));
 const page=await client(app,session);assert.ok(page.root.innerHTML.includes('BEKANNTMACHUNGEN IM WERK'));assert.ok(page.root.innerHTML.includes('Noch nicht hinterlegt'));assert.ok(!page.root.innerHTML.includes('Nicht freigegebene interne Entwurfsangabe'));assert.ok(page.root.innerHTML.includes('FÜR DIESES WERK GEMERKT'));assert.ok(page.root.innerHTML.includes('Vollbild'));
 await page.click({view:'site'});assert.ok(page.root.innerHTML.includes('id="global-library-search"'));assert.ok(!page.root.innerHTML.includes('Nicht freigegebene interne Entwurfsangabe'));
 await page.click({view:'site-admin'});for(let i=0;i<100&&!page.root.innerHTML.includes('id="site-notices-form"');i++)await new Promise(r=>setTimeout(r,5));assert.ok(page.root.innerHTML.includes('Nicht freigegebene interne Entwurfsangabe'));assert.ok(page.root.innerHTML.includes('Entwurf speichern'));
});


test('permanent own-site manager adds, edits and shares BV links without computer approval controls',async()=>{
 const {app,session}=await registered('ui-bv');const {grantPermanentAccess}=await import('../server/licensing');await grantPermanentAccess(app.db,{username:'ui-bv',reference:'Test-only permanent UI',unlimitedConfirmed:true,enableOwnSiteEditing:true},'test-owner');
 const page=await client(app,session);await page.click({view:'account'});assert.ok(page.root.innerHTML.includes('Unbefristet freigeschaltet'));assert.ok(!page.root.innerHTML.includes('1970'));
 await page.click({view:'bv'});for(let i=0;i<100&&!page.root.innerHTML.includes('BV-Link hinzufügen');i++)await new Promise(r=>setTimeout(r,5));
 assert.ok(page.root.innerHTML.includes('BV-Link hinzufügen'));assert.ok(page.root.innerHTML.includes('id="global-library-search"'));assert.ok(!page.root.innerHTML.includes('Gerätefreigaben'));assert.ok(!page.root.innerHTML.includes('Firmencomputer-Freigabe erforderlich'));
 await page.click({bvAction:'new'});assert.ok(page.node('#dialog-content').innerHTML.includes('id="bv-link-form"'));
 await page.submit('bv-link-form',{title:'BV Arbeitszeit',url:'https://company.example/BV.pdf',version:'2026',published:'on'});
 assert.ok(page.root.innerHTML.includes('BV Arbeitszeit'));assert.ok(page.root.innerHTML.includes('Link kopieren'));
 const rows=await(await app.api(request('/api/bv-links','GET',undefined,session))).json() as any;const id=rows.links[0].id;
 await page.click({bvAction:'copy',id});assert.deepEqual(page.copied,['https://company.example/BV.pdf']);
 await page.click({bvAction:'edit',id});await page.submit('bv-link-form',{title:'BV Arbeitszeit aktuell',url:'https://company.example/BV-v2.pdf',version:'2027',published:'on'},{id});assert.ok(page.root.innerHTML.includes('BV Arbeitszeit aktuell'));
 await page.click({bvAction:'delete',id});assert.ok(!page.root.innerHTML.includes('BV Arbeitszeit aktuell'));await page.click({bvAction:'trash'});assert.ok(page.root.innerHTML.includes('BV Arbeitszeit aktuell'));await page.click({bvAction:'restore',id});await page.click({bvAction:'active'});assert.ok(page.root.innerHTML.includes('BV Arbeitszeit aktuell'));
 await page.click({action:'logout'});assert.ok(!page.root.innerHTML.includes('BV Arbeitszeit aktuell'));assert.ok(!page.root.innerHTML.includes('BV-Link hinzufügen'));
});

test('Angaben neu laden awaits a fresh published response and reports success without publishing a draft',async()=>{
 const {app,session}=await registered('ui-reload-notices');const page=await client(app,session);await page.click({view:'site'});
 const state=await(await app.api(request('/api/site-notices','GET',undefined,session))).json() as any;
 state.draft.agg.text='Beschwerdestelle Personalabteilung, Raum 12';
 assert.equal((await app.api(request('/api/site-notices','PUT',{revision:0,notices:state.draft},session))).status,200);
 assert.equal((await app.api(request('/api/site-notices/publish','POST',{revision:1,authorized:true},session))).status,200);
 const count=page.calls.filter(p=>p==='/api/site-notices').length;
 await page.click({kioskAction:'reload-notices'});
 assert.equal(page.calls.filter(p=>p==='/api/site-notices').length,count+1);
 assert.ok(page.root.innerHTML.includes('Beschwerdestelle Personalabteilung, Raum 12'));
 assert.equal(page.node('#toast').textContent,'Werkangaben neu geladen.');
 state.draft.agg.text='Unveröffentlichter nächster Entwurf';
 await app.api(request('/api/site-notices','PUT',{revision:2,notices:state.draft},session));
 await page.click({kioskAction:'reload-notices'});
 assert.ok(page.root.innerHTML.includes('Beschwerdestelle Personalabteilung, Raum 12'));assert.ok(!page.root.innerHTML.includes('Unveröffentlichter nächster Entwurf'));
});


test('manual notice reload supersedes a pending older response; failures show a message and preserve published information',async()=>{
 const {app,session}=await registered('ui-reload-race');const page=await client(app,session);await page.click({view:'site'});
 const state=await(await app.api(request('/api/site-notices','GET',undefined,session))).json() as any;
 state.draft.agg.text='Aktuelle veröffentlichte Werkangabe';await app.api(request('/api/site-notices','PUT',{revision:0,notices:state.draft},session));await app.api(request('/api/site-notices/publish','POST',{revision:1,authorized:true},session));
 let release:(value:Response)=>void=()=>{};let started=false;
 page.setInterceptor(async(path,response)=>{if(path==='/api/site-notices'&&!started){started=true;return new Promise<Response>(resolve=>{release=resolve;});}return response;});
 const pending=page.click({kioskAction:'reload-notices'});for(let i=0;i<100&&!started;i++)await new Promise(r=>setTimeout(r,5));assert.ok(started);
 await page.click({kioskAction:'reload-notices'});assert.ok(page.root.innerHTML.includes('Aktuelle veröffentlichte Werkangabe'));
 release(new Response(JSON.stringify({...state,published:{...state.published,agg:{status:'applicable',text:'Veraltete Antwort'}}}),{headers:{'Content-Type':'application/json'}}));await pending;
 assert.ok(page.root.innerHTML.includes('Aktuelle veröffentlichte Werkangabe'));assert.ok(!page.root.innerHTML.includes('Veraltete Antwort'));
 page.setInterceptor(async(path,response)=>{if(path==='/api/site-notices')throw Error('Verbindung unterbrochen. Bitte erneut versuchen.');return response;});
 await page.click({kioskAction:'reload-notices'});assert.match(page.node('#toast').textContent,/Verbindung unterbrochen/);assert.ok(page.root.innerHTML.includes('Aktuelle veröffentlichte Werkangabe'));
 page.setInterceptor(null);await page.click({kioskAction:'reload-notices'});assert.equal(page.node('#toast').textContent,'Werkangaben neu geladen.');
});
