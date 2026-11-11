import {type Account,requireLicense} from './accounts';
import {bodyJSON,clean,HttpError,json,secureHeaders} from './security';

export function companyUrl(value:unknown){
 if(typeof value!=='string'||value.length>2000||/[\u0000-\u0020\\]/.test(value))throw new HttpError(400,'Bitte eine vollständige HTTPS-Adresse ohne Leerzeichen angeben.');
 let u:URL;try{u=new URL(value);}catch{throw new HttpError(400,'Ungültige Linkadresse.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port)throw new HttpError(400,'Nur HTTPS-Adressen ohne Zugangsdaten oder Sonderport sind erlaubt.');
 for(const key of u.searchParams.keys())if(/^(access_token|token|password|authkey|sig|signature|code)$/i.test(key))throw new HttpError(400,'Keine Zugangsschlüssel oder Passwörter im Link speichern.');
 return u;
}
type Access={account:Account;kind:string;deviceId?:string|null};

export async function bvAPI(db:D1Database,request:Request,s:Access){
 requireLicense(s.account);
 const path=new URL(request.url).pathname,manager=s.kind==='password',now=Math.floor(Date.now()/1000);
 const settings=await db.prepare('SELECT enabled FROM bv_settings WHERE account_id=?').bind(s.account.id).first<{enabled:number}>();
 const manage=()=>{if(!manager)throw new HttpError(403,'BV-Verwaltung erfordert eine Passwortanmeldung.');};
 if(path==='/api/bv-links/settings'&&request.method==='PUT'){
  manage();const b=await bodyJSON(request);if(typeof b.enabled!=='boolean')throw new HttpError(400,'Bitte die BV-Verknüpfungen ausdrücklich aktivieren oder deaktivieren.');
  await db.prepare('INSERT INTO bv_settings (account_id,enabled,updated_at) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at').bind(s.account.id,b.enabled?1:0,now).run();
  return json({ok:true});
 }
 if(path==='/api/bv-links'&&request.method==='GET'){
  if(!manager&&!settings?.enabled)return json({enabled:false,canManage:false,links:[]});
  const trash=manager&&new URL(request.url).searchParams.get('trash')==='1';
  const rows=await db.prepare(`SELECT id,title,url,version,published,deleted_at AS deletedAt FROM bv_links WHERE account_id=? AND deleted_at IS ${trash?'NOT ':''}NULL${manager?'':' AND published=1'} ORDER BY title COLLATE NOCASE`).bind(s.account.id).all();
  return json({enabled:!!settings?.enabled,canManage:manager,links:rows.results||[],...(manager?{trash}:{})});
 }
 const lm=path.match(/^\/api\/bv-links\/([a-f0-9-]{36})(?:\/(open|restore))?$/);
 if(lm?.[2]==='open'&&request.method==='GET'){
  if(!settings?.enabled)throw new HttpError(404,'BV-Links sind noch nicht freigeschaltet.');
  const row=await db.prepare(`SELECT url FROM bv_links WHERE id=? AND account_id=? AND deleted_at IS NULL${manager?'':' AND published=1'}`).bind(lm[1],s.account.id).first<{url:string}>();
  if(!row)throw new HttpError(404,'BV-Link nicht gefunden.');
  const h=secureHeaders('text/plain; charset=utf-8');h.set('Location',companyUrl(row.url).href);
  return new Response(null,{status:303,headers:h});
 }
 manage();if(!settings?.enabled)throw new HttpError(404,'BV-Links sind noch nicht freigeschaltet.');
 if(lm&&!lm[2]&&request.method==='DELETE'){
  const r=await db.prepare('UPDATE bv_links SET deleted_at=?,updated_at=? WHERE id=? AND account_id=? AND deleted_at IS NULL').bind(now,now,lm[1],s.account.id).run();
  if(r.meta.changes!==1)throw new HttpError(404,'BV-Link nicht gefunden.');return json({ok:true});
 }
 if(lm?.[2]==='restore'&&request.method==='POST'){
  const r=await db.prepare('UPDATE bv_links SET deleted_at=NULL,updated_at=? WHERE id=? AND account_id=? AND deleted_at IS NOT NULL').bind(now,lm[1],s.account.id).run();
  if(r.meta.changes!==1)throw new HttpError(404,'BV-Link nicht gefunden.');return json({ok:true});
 }
 if((path==='/api/bv-links'&&request.method==='POST')||(lm&&!lm[2]&&request.method==='PATCH')){
  const b=await bodyJSON(request),title=clean(b.title,'Titel',180),version=typeof b.version==='string'?b.version.trim():'';
  if(version.length>40||/[\u0000-\u001f]/.test(version)||typeof b.published!=='boolean')throw new HttpError(400,'Ungültige Versions- oder Freigabeangabe.');
  const url=companyUrl(b.url);
  if(lm){
   const r=await db.prepare('UPDATE bv_links SET title=?,url=?,version=?,published=?,updated_at=? WHERE id=? AND account_id=? AND deleted_at IS NULL').bind(title,url.href,version,b.published?1:0,now,lm[1],s.account.id).run();
   if(r.meta.changes!==1)throw new HttpError(404,'BV-Link nicht gefunden.');return json({id:lm[1]});
  }
  const id=crypto.randomUUID();
  const r=await db.prepare('INSERT INTO bv_links (id,account_id,title,url,version,published,updated_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM bv_links WHERE account_id=?)<100').bind(id,s.account.id,title,url.href,version,b.published?1:0,now,s.account.id).run();
  if(r.meta.changes!==1)throw new HttpError(409,'Höchstens 100 BV-Links einschließlich Papierkorb sind erlaubt.');return json({id},201);
 }
 throw new HttpError(404,'BV-Funktion nicht gefunden.');
}
