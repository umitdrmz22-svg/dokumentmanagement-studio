import {unzipSync} from 'fflate';
import {type Account,requireLicense} from './accounts';
import {bodyJSON,clean,digest,HttpError,json,secureHeaders} from './security';

const MAX_FILE=10*1024*1024,MAX_STORAGE=100*1024*1024,MAX_FILES=100;
const categories=['Betriebsvereinbarung','Unternehmensrichtlinie','Betriebsanweisung','Sonstiges'];
const fields='id,title,category,version,effective_date AS effectiveDate,original_name AS originalName,mime,size,published,created_at AS createdAt,updated_at AS updatedAt,deleted_at AS deletedAt';
type Session={account:Account;kind:string};
function manager(s:Session){if(s.kind!=='password')throw new HttpError(403,'Zum Verwalten der Firmendokumente bitte mit Benutzername und Passwort anmelden.');}
function metadata(b:Record<string,unknown>){
 const title=clean(b.title,'Dokumenttitel',180),category=clean(b.category,'Dokumentart',40);
 if(!categories.includes(category))throw new HttpError(400,'Bitte eine gültige Dokumentart auswählen.');
 const version=typeof b.version==='string'?b.version.trim():'';if(version.length>40||/[\u0000-\u001f]/.test(version))throw new HttpError(400,'Ungültige Versionsangabe.');
 const effectiveDate=typeof b.effectiveDate==='string'?b.effectiveDate:'';
 if(effectiveDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)||!Number.isFinite(Date.parse(effectiveDate+'T12:00:00Z'))||new Date(effectiveDate+'T12:00:00Z').toISOString().slice(0,10)!==effectiveDate))throw new HttpError(400,'Bitte ein gültiges Dokumentdatum angeben.');
 if(typeof b.published!=='boolean')throw new HttpError(400,'Bitte den Freigabestatus angeben.');
 return {title,category,version,effectiveDate,published:b.published?1:0};
}
async function boundedForm(request:Request){
 const type=request.headers.get('content-type')||'';
 if(!type.startsWith('multipart/form-data;'))throw new HttpError(415,'Bitte ein Dokument über das Uploadformular auswählen.');
 const maximum=MAX_FILE+128*1024;if(Number(request.headers.get('content-length')||0)>maximum)throw new HttpError(413,'Dateien sind bis 10 MB erlaubt.');
 if(!request.body)throw new HttpError(400,'Datei fehlt.');const reader=request.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>maximum){await reader.cancel();throw new HttpError(413,'Dateien sind bis 10 MB erlaubt.');}chunks.push(value);}
 const all=new Uint8Array(length);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
 try{return await new Response(all,{headers:{'Content-Type':type}}).formData();}catch{throw new HttpError(400,'Das Uploadformular konnte nicht gelesen werden.');}
}
export function validateDocument(bytes:Uint8Array,name:string,type:string){
 if(bytes.length===0||bytes.length>MAX_FILE)throw new HttpError(413,'Bitte eine Datei mit höchstens 10 MB auswählen.');
 const lower=name.toLowerCase();
 if(lower.endsWith('.pdf')){
  if(!['application/pdf','application/octet-stream',''].includes(type)||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'||!new TextDecoder().decode(bytes.slice(-2048)).includes('%%EOF'))throw new HttpError(400,'Die Datei ist keine erkennbare PDF-Datei.');
  return 'application/pdf';
 }
 if(lower.endsWith('.docx')){
  if(!['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream','application/zip',''].includes(type)||bytes[0]!==0x50||bytes[1]!==0x4b)throw new HttpError(400,'Die Datei ist kein DOCX-Dokument.');
  try{let count=0;const content=unzipSync(bytes,{filter:f=>{if(++count>1500||f.originalSize>30*1024*1024||/(^|\/)(vbaProject\.bin|.*\.exe|.*\.js)$/i.test(f.name))throw Error();if(['[Content_Types].xml','word/document.xml'].includes(f.name)){if(f.originalSize>2*1024*1024)throw Error();return true;}return false;}});if(!content['[Content_Types].xml']||!content['word/document.xml'])throw Error();}
  catch{throw new HttpError(400,'Die DOCX-Struktur ist ungültig oder überschreitet die erlaubten Grenzen.');}
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
 }
 throw new HttpError(415,'Erlaubt sind PDF und DOCX.');
}
async function enabled(db:D1Database,accountId:string){return (await db.prepare('SELECT enabled FROM document_settings WHERE account_id=?').bind(accountId).first<{enabled:number}>())?.enabled===1;}

export async function documentsAPI(db:D1Database,bucket:R2Bucket|undefined,request:Request,session:Session){
 const path=new URL(request.url).pathname,account=session.account,isManager=session.kind==='password',now=Math.floor(Date.now()/1000);
 if(!isManager)requireLicense(account);
 if(path==='/api/documents/settings'&&request.method==='PUT'){
  manager(session);const b=await bodyJSON(request);if(typeof b.enabled!=='boolean')throw new HttpError(400,'Bitte die gewünschte Einstellung angeben.');
  await db.prepare('INSERT INTO document_settings (account_id,enabled,updated_at) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at').bind(account.id,b.enabled?1:0,now).run();return json({enabled:b.enabled});
 }
 const isEnabled=await enabled(db,account.id);
 if(path==='/api/documents'&&request.method==='GET'){
  const trash=new URL(request.url).searchParams.get('trash')==='1';if(trash&&!isManager)throw new HttpError(403,'Der Papierkorb ist nur in der Zugangsverwaltung sichtbar.');
  const rows=isEnabled?await db.prepare(`SELECT ${fields} FROM company_documents WHERE account_id=? AND deleted_at IS ${trash?'NOT ':''}NULL${isManager?'':' AND published=1'} ORDER BY title COLLATE NOCASE,id`).bind(account.id).all():{results:[]};
  const usage=isManager?await db.prepare('SELECT COALESCE(SUM(size),0) AS bytes,COUNT(*) AS files FROM company_documents WHERE account_id=?').bind(account.id).first():null;
  return json({enabled:isEnabled,documents:rows.results||[],canManage:isManager,usage,limits:{fileBytes:MAX_FILE,totalBytes:MAX_STORAGE,files:MAX_FILES}});
 }
 if(!isEnabled)throw new HttpError(404,'Firmendokumente sind für diesen Zugang nicht aktiviert.');
 if(path==='/api/documents'&&request.method==='POST'){
  manager(session);requireLicense(account);if(!bucket)throw new HttpError(503,'Dokumentenspeicher nicht verfügbar.');
  const form=await boundedForm(request),file=form.get('file');if(!file||typeof file==='string'||typeof file.arrayBuffer!=='function')throw new HttpError(400,'Bitte eine Datei auswählen.');
  const m=metadata({title:form.get('title'),category:form.get('category'),version:form.get('version'),effectiveDate:form.get('effectiveDate'),published:form.get('published')==='true'}),originalName=clean(file.name,'Dateiname',200);
  const bytes=new Uint8Array(await file.arrayBuffer()),mime=validateDocument(bytes,originalName,file.type),id=crypto.randomUUID(),key=`company/${account.id}/${id}`,hash=await digest(bytes);
  await bucket.put(key,bytes,{httpMetadata:{contentType:mime}});
  try{
   const inserted=await db.prepare('INSERT INTO company_documents (id,account_id,title,category,version,effective_date,original_name,mime,size,storage_key,sha256,published,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM company_documents WHERE account_id=?)<? AND (SELECT COALESCE(SUM(size),0) FROM company_documents WHERE account_id=?)+?<=?').bind(id,account.id,m.title,m.category,m.version,m.effectiveDate,originalName,mime,bytes.length,key,hash,m.published,now,now,account.id,MAX_FILES,account.id,bytes.length,MAX_STORAGE).run();
   if(inserted.meta.changes!==1)throw new HttpError(409,'Der Dokumentenspeicher ist voll. Nicht benötigte Dateien im Papierkorb können endgültig gelöscht werden.');
  }catch(error){await bucket.delete(key).catch(()=>{});throw error;}
  return json({id,...m,originalName,mime,size:bytes.length},201);
 }
 const match=path.match(/^\/api\/documents\/([a-f0-9-]{36})(?:\/(download|restore|permanent))?$/);if(!match)throw new HttpError(404,'Dokumentfunktion nicht gefunden.');
 const [,id,action]=match;
 const row=await db.prepare(`SELECT ${fields},storage_key AS storageKey FROM company_documents WHERE id=? AND account_id=?`).bind(id,account.id).first<any>();
 if(!row||(!isManager&&(!row.published||row.deletedAt)))throw new HttpError(404,'Dokument nicht gefunden.');
 if(action==='download'&&request.method==='GET'){
  if(row.deletedAt)throw new HttpError(404,'Das Dokument liegt im Papierkorb.');if(!bucket)throw new HttpError(503,'Dokumentenspeicher nicht verfügbar.');const object=await bucket.get(row.storageKey);if(!object)throw new HttpError(404,'Datei nicht gefunden.');
  const headers=secureHeaders(row.mime);headers.set('Content-Disposition',`attachment; filename="Firmendokument.${row.mime==='application/pdf'?'pdf':'docx'}"; filename*=UTF-8''${encodeURIComponent(row.originalName)}`);headers.set('Content-Security-Policy',"default-src 'none'; sandbox");return new Response(object.body,{headers});
 }
 manager(session);
 if(action==='restore'&&request.method==='POST'){
  await db.prepare('UPDATE company_documents SET deleted_at=NULL,updated_at=? WHERE id=? AND account_id=?').bind(now,id,account.id).run();return json({ok:true});
 }
 if(action==='permanent'&&request.method==='DELETE'){
  if(!row.deletedAt)throw new HttpError(409,'Das Dokument muss zuerst in den Papierkorb verschoben werden.');const b=await bodyJSON(request);if(b.confirm!=='PERMANENT_DELETE')throw new HttpError(400,'Die endgültige Löschung muss ausdrücklich bestätigt werden.');
  if(!bucket)throw new HttpError(503,'Dokumentenspeicher nicht verfügbar.');await bucket.delete(row.storageKey);await db.prepare('DELETE FROM company_documents WHERE id=? AND account_id=?').bind(id,account.id).run();return json({ok:true});
 }
 if(action)throw new HttpError(404,'Dokumentfunktion nicht gefunden.');
 if(request.method==='DELETE'){
  await db.prepare('UPDATE company_documents SET deleted_at=?,updated_at=? WHERE id=? AND account_id=?').bind(now,now,id,account.id).run();return json({ok:true});
 }
 if(request.method==='PATCH'){
  if(row.deletedAt)throw new HttpError(409,'Das Dokument liegt im Papierkorb.');const m=metadata(await bodyJSON(request));
  await db.prepare('UPDATE company_documents SET title=?,category=?,version=?,effective_date=?,published=?,updated_at=? WHERE id=? AND account_id=?').bind(m.title,m.category,m.version,m.effectiveDate,m.published,now,id,account.id).run();return json({id,...m});
 }
 throw new HttpError(405,'Diese Dokumentaktion wird nicht unterstützt.');
}
