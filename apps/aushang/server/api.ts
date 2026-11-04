import { catalog } from './generated-legal';
import { accountFor,createSession,requireAccount } from './accounts';
import { bodyJSON,clean,constantEqual,digest,getSessionToken,hashPassword,HttpError,json,profile,randomToken,rateLimit,requireOrigin,sessionCookie,username,validatePassword,verifyPassword } from './security';
import { beginUpdate,continueUpdate,publishUpdate,readLegalText,readPdf,updateMeta } from './updates';
export const TERMS_VERSION='2026-11-04-pilot';
export function createAPI(env: {DB?:D1Database;BUCKET?:R2Bucket;AUTH_RATE_SECRET?:string;MAINTAINER_EMAIL?:string;SITE_ORIGIN?:string;MAINTENANCE_KEY_HASH?:string}) {
function db(){if(!env.DB)throw new HttpError(503,'Der Dienst ist vorübergehend nicht verfügbar.');return env.DB;}
function rateSecret(){if(!env.AUTH_RATE_SECRET)throw new HttpError(503,'Die Anmeldung ist noch nicht vollständig eingerichtet.');return env.AUTH_RATE_SECRET;}
async function api(request:Request){try{
 const url=new URL(request.url),path=url.pathname;const database=db();
 if(request.method==='POST'&&path==='/api/maintenance'){
  // Application authorization for unattended service access. The platform bearer
  // is obtained through get_site and is never stored here; only its hash is kept.
  const token=request.headers.get('x-aushang-service-key')||'';
  if(!env.MAINTENANCE_KEY_HASH||token.length<24||token.length>4096||!constantEqual(await digest(token),env.MAINTENANCE_KEY_HASH))throw new HttpError(403,'Dieser Wartungszugriff ist nicht autorisiert.');
  const b=await bodyJSON(request);
  if(b.action==='status')return json(await updateMeta(database));
  if(b.action==='begin')return json(await beginUpdate(database,'authorized-service'));
  if(!['continue','publish'].includes(b.action))throw new HttpError(400,'Unbekannte Wartungsaktion.');
  const runId=clean(b.runId,'Update-Lauf',80);if(!/^[a-f0-9-]{36}$/.test(runId))throw new HttpError(400,'Ungültiger Update-Lauf.');
  if(b.action==='publish')return json(await publishUpdate(database,runId));
  if(!env.BUCKET)throw new HttpError(503,'Speicher nicht verfügbar.');return json(await continueUpdate(database,env.BUCKET,runId));
 }
 if(request.method==='GET'&&path==='/api/public/meta')return json(await updateMeta(database));
 if(request.method==='GET'&&path==='/api/me'){
  const account=await accountFor(database,request);if(!account)return json({account:null,meta:await updateMeta(database)});
  const favoriteRows=await database.prepare('SELECT law_id FROM favorites WHERE account_id=? ORDER BY law_id').bind(account.id).all<{law_id:string}>();
  return json({account,favorites:(favoriteRows.results||[]).map(x=>x.law_id),meta:await updateMeta(database)});
 }
 if(['POST','PUT','PATCH','DELETE'].includes(request.method))requireOrigin(request);
 if(request.method==='POST'&&path==='/api/auth/register'){
  const b=await bodyJSON(request);const u=username(b.username),password=validatePassword(b.password);const p=profile(b);if(b.acceptSiteScope!==true||b.businessOnly!==true)throw new HttpError(400,'Bitte den geschäftlichen Einsatz und den Standortbezug bestätigen.');
  await rateLimit(database,request,rateSecret(),'register','all',8,86400);
  const exists=await database.prepare('SELECT id FROM accounts WHERE username=?').bind(u).first();if(exists)throw new HttpError(409,'Dieser Benutzername kann nicht verwendet werden. Bitte einen anderen wählen.');
  const accountId=crypto.randomUUID(),recoveryCode=randomToken(),hash=await hashPassword(password),now=Math.floor(Date.now()/1000);
  try{await database.prepare('INSERT INTO accounts (id,username,password_hash,recovery_hash,company,work,street,house_number,postal_code,city,country,access_status,terms_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(accountId,u,hash,await digest(recoveryCode),p.company,p.work,p.street,p.houseNumber,p.postalCode,p.city,p.country,'pilot',TERMS_VERSION,now).run();}catch(e){if(String(e).includes('UNIQUE'))throw new HttpError(409,'Dieser Benutzername kann nicht verwendet werden. Bitte einen anderen wählen.');throw e;}
  return json({ok:true,recoveryCode},201,{'Set-Cookie':await createSession(database,request,accountId,false)});
 }
 if(request.method==='POST'&&path==='/api/auth/login'){
  const b=await bodyJSON(request),u=username(b.username);const password=typeof b.password==='string'&&b.password.length<=128?b.password:'';
  await rateLimit(database,request,rateSecret(),'login-ip','all',100);const failureKey=await rateLimit(database,request,rateSecret(),'login-user',u,8);
  const row=await database.prepare('SELECT id,password_hash,access_status FROM accounts WHERE username=?').bind(u).first<any>();
  // Match the expensive work for unknown usernames to reduce account enumeration.
  const valid=row?await verifyPassword(password,row.password_hash):(await hashPassword(password),false);
  if(!row||!valid)throw new HttpError(401,'Benutzername oder Passwort ist nicht korrekt.');if(row.access_status==='suspended')throw new HttpError(403,'Dieser Zugang ist derzeit nicht freigeschaltet.');
  await database.prepare('DELETE FROM rate_limits WHERE key=?').bind(failureKey).run();
  return json({ok:true},200,{'Set-Cookie':await createSession(database,request,row.id,b.remember===true)});
 }
 if(request.method==='POST'&&path==='/api/auth/logout'){
  const token=getSessionToken(request);if(token)await database.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true},200,{'Set-Cookie':sessionCookie(request,'',0)});
 }
 if(request.method==='POST'&&path==='/api/auth/recover'){
  const b=await bodyJSON(request),u=username(b.username),password=validatePassword(b.newPassword);await rateLimit(database,request,rateSecret(),'recover-ip','all',15);await rateLimit(database,request,rateSecret(),'recover-user',u,5);
  const row=await database.prepare('SELECT id,recovery_hash FROM accounts WHERE username=?').bind(u).first<any>();const code=typeof b.recoveryCode==='string'?b.recoveryCode.trim().toLowerCase():'';
  if(!row||!(/^[a-f0-9]{64}$/.test(code))||!constantEqual(await digest(code),row.recovery_hash))throw new HttpError(401,'Benutzername oder Wiederherstellungscode ist nicht korrekt.');
  const recoveryCode=randomToken();await database.batch([database.prepare('UPDATE accounts SET password_hash=?,recovery_hash=? WHERE id=?').bind(await hashPassword(password),await digest(recoveryCode),row.id),database.prepare('DELETE FROM sessions WHERE account_id=?').bind(row.id)]);
  return json({ok:true,recoveryCode},200,{'Set-Cookie':await createSession(database,request,row.id,false)});
 }
 const account=await requireAccount(database,request);
 if(request.method==='GET'&&path==='/api/catalog')return json({catalog});
 const match=path.match(/^\/api\/texts\/([a-z0-9]+)$/);if(request.method==='GET'&&match)return json(await readLegalText(database,match[1]));
 const pdf=path.match(/^\/api\/pdf\/(dguv[123])$/);if(request.method==='GET'&&pdf){if(!env.BUCKET)throw new HttpError(503,'Dokumentendienst nicht verfügbar.');return readPdf(database,env.BUCKET,pdf[1]);}
 if(request.method==='PUT'&&path==='/api/favorites'){
  const b=await bodyJSON(request);if(!Array.isArray(b.favorites)||b.favorites.length>catalog.length)throw new HttpError(400,'Ungültige Favoritenliste.');const ids=[...new Set(b.favorites)];if(ids.some(x=>typeof x!=='string'||!catalog.some(l=>l.id===x)))throw new HttpError(400,'Unbekannter Gesetzestitel.');
  await database.batch([database.prepare('DELETE FROM favorites WHERE account_id=?').bind(account.id),...ids.map(id=>database.prepare('INSERT INTO favorites (account_id,law_id) VALUES (?,?)').bind(account.id,id))]);return json({favorites:ids});
 }
 if(request.method==='POST'&&path==='/api/auth/password'){
  const b=await bodyJSON(request),password=validatePassword(b.newPassword);await rateLimit(database,request,rateSecret(),'password',account.id,5);
  const row=await database.prepare('SELECT password_hash FROM accounts WHERE id=?').bind(account.id).first<{password_hash:string}>();if(!row||typeof b.currentPassword!=='string'||b.currentPassword.length>128||!await verifyPassword(b.currentPassword,row.password_hash))throw new HttpError(401,'Das aktuelle Passwort ist nicht korrekt.');
  await database.batch([database.prepare('UPDATE accounts SET password_hash=? WHERE id=?').bind(await hashPassword(password),account.id),database.prepare('DELETE FROM sessions WHERE account_id=?').bind(account.id)]);return json({ok:true},200,{'Set-Cookie':await createSession(database,request,account.id,false)});
 }
 throw new HttpError(404,'Diese Funktion wurde nicht gefunden.');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status,e.status===429?{'Retry-After':'900'}:{});return json({error:'Der Dienst ist vorübergehend nicht verfügbar. Bitte später erneut versuchen.'},503);}}
const toolList=[
 {name:'get_update_status',description:'Read the active legal collection version and update status.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'begin_legal_update',description:'Start or resume a monthly official-source update. No account data is read.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'continue_legal_update',description:'Fetch and validate the next three official sources for the run; repeat sequentially until readyToPublish is true.',inputSchema:{type:'object',properties:{runId:{type:'string'}},required:['runId'],additionalProperties:false}},
 {name:'publish_legal_update',description:'Atomically activate a fully validated legal-source run and update its visible date.',inputSchema:{type:'object',properties:{runId:{type:'string'}},required:['runId'],additionalProperties:false}}
];
async function mcp(request:Request){let id:any=null;try{
 const msg=await bodyJSON(request);id=msg.id??null;
 if(msg.method==='server/discover')return json({jsonrpc:'2.0',id,result:{supportedVersions:['2026-07-28'],capabilities:{tools:{}}}});
 if(msg.method==='initialize')return json({jsonrpc:'2.0',id,result:{protocolVersion:'2026-07-28',capabilities:{tools:{}},serverInfo:{name:'aushang-maintenance',version:'1.0.0'}}});
 if(msg.method==='notifications/initialized')return new Response(null,{status:204});
 if(msg.method==='tools/list')return json({jsonrpc:'2.0',id,result:{tools:toolList}});
 if(msg.method!=='tools/call')return json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}},404);
 const owner=request.headers.get('oai-authenticated-user-email')?.toLowerCase();if(!env.MAINTAINER_EMAIL||owner!==env.MAINTAINER_EMAIL.toLowerCase()||!request.headers.get('oai-authenticated-user-id'))throw new HttpError(403,'Nur der verifizierte Betreiber darf die Gesetzessammlung aktualisieren.');
 const database=db(),p=msg.params||{};let result:any;
 if(p.name==='get_update_status')result=await updateMeta(database);
 else if(p.name==='begin_legal_update')result=await beginUpdate(database,owner);
 else if(['continue_legal_update','publish_legal_update'].includes(p.name)){
  const runId=clean(p.arguments?.runId,'Update-Lauf',80);if(!/^[a-f0-9-]{36}$/.test(runId))throw new HttpError(400,'Ungültiger Update-Lauf.');if(p.name==='continue_legal_update'){if(!env.BUCKET)throw new HttpError(503,'Speicher nicht verfügbar.');result=await continueUpdate(database,env.BUCKET,runId);}else result=await publishUpdate(database,runId);
 }else throw new HttpError(404,'Unknown tool');
 return json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result}});
 }catch(e){return json({jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:e instanceof HttpError?e.message:'Update fehlgeschlagen. Der letzte erfolgreiche Stand bleibt aktiv.'}]}},e instanceof HttpError?e.status:503);}}

return {api,mcp};
}
