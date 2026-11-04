import { catalog,initialTexts,initialBgn } from './generated-legal';
import { fetchOfficialLaw,parseOfficialArchive } from './legal-parser';
import { digest,HttpError } from './security';
const lawIds=new Set(catalog.map(x=>x.id));
export async function updateMeta(db:D1Database){
 const rows=await db.prepare('SELECT key,value FROM legal_settings').all<{key:string,value:string}>();const settings=Object.fromEntries((rows.results||[]).map(x=>[x.key,x.value]));
 const active=settings.active_run?await db.prepare('SELECT id,finished_at,changed FROM legal_runs WHERE id=? AND status=?').bind(settings.active_run,'complete').first<any>():null;
 const latest=await db.prepare('SELECT status,started_at,finished_at FROM legal_runs ORDER BY started_at DESC LIMIT 1').first<any>();
 return {activeRun:active?.id||'initial-2026-11-04',lastSuccessfulCheck:active?.finished_at?new Date(active.finished_at*1000).toISOString():'2026-11-04T00:00:00.000Z',lastAttemptStatus:latest?.status||'initial',lastChanged:settings.last_changed||null,checkPolicy:'Monatlich am 1. um 06:00 Uhr (Europe/Berlin)',total:catalog.length};
}
export async function readLegalText(db:D1Database,id:string){if(!lawIds.has(id)||!initialTexts[id])throw new HttpError(404,'Gesetz nicht gefunden.');const m=await updateMeta(db);if(m.activeRun.startsWith('initial'))return initialTexts[id];const row=await db.prepare('SELECT payload FROM legal_entries WHERE run_id=? AND law_id=?').bind(m.activeRun,id).first<{payload:string}>();if(!row)throw new HttpError(503,'Der Gesetzestext ist vorübergehend nicht verfügbar.');return JSON.parse(row.payload);}
export async function readPdf(db:D1Database,bucket:R2Bucket,id:string){if(!initialBgn.some(x=>x.id===id))throw new HttpError(404,'Dokument nicht gefunden.');const m=await updateMeta(db);if(!m.activeRun.startsWith('initial')){const obj=await bucket.get(`legal/${m.activeRun}/${id}.pdf`);if(obj)return new Response(obj.body,{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 const source=initialBgn.find(x=>x.id===id)!;const r=await fetch(source.source,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new HttpError(503,'Die PDF-Quelle ist derzeit nicht erreichbar.');return new Response(r.body,{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export async function beginUpdate(db:D1Database,owner:string){
 const now=Math.floor(Date.now()/1000);const existing=await db.prepare('SELECT id,started_at,cursor FROM legal_runs WHERE status=? ORDER BY started_at DESC LIMIT 1').bind('running').first<any>();
 if(existing&&existing.started_at>now-7200)return {runId:existing.id,cursor:existing.cursor,status:'running',total:catalog.length};
 if(existing)await db.prepare('UPDATE legal_runs SET status=?,error=?,finished_at=? WHERE id=?').bind('failed','Previous run timed out',now,existing.id).run();
 const runId=crypto.randomUUID();await db.prepare('INSERT INTO legal_runs (id,status,cursor,started_at,changed,owner) VALUES (?,?,0,?,0,?)').bind(runId,'running',now,owner).run();
 await db.batch([db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),db.prepare('DELETE FROM rate_limits WHERE reset_at<?').bind(now)]);
 return {runId,cursor:0,status:'running',total:catalog.length};
}
export async function continueUpdate(db:D1Database,bucket:R2Bucket,runId:string){
 const run=await db.prepare('SELECT id,status,cursor,changed FROM legal_runs WHERE id=?').bind(runId).first<any>();if(!run)throw new HttpError(404,'Update-Lauf nicht gefunden.');if(run.status!=='running')return {runId,status:run.status,cursor:run.cursor,total:catalog.length};
 const start=run.cursor;const batch=catalog.slice(start,start+3);const previous=await updateMeta(db);let changed=run.changed;
 try{
  for(const item of batch){
   let hash:string,payload:any;
   if(item.localPdf){const source=initialBgn.find(x=>x.id===item.id)!;const r=await fetch(source.source,{redirect:'error',signal:AbortSignal.timeout(24000)});if(!r.ok)throw Error('PDF source HTTP '+r.status);const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>8_000_000||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('Invalid source PDF');hash=await digest(bytes);await bucket.put(`legal/${runId}/${item.id}.pdf`,bytes,{httpMetadata:{contentType:'application/pdf'}});payload={source:{id:item.id,url:source.source,sha256:hash,retrieved:new Date().toISOString()},pdf:true};}
   else{payload=await fetchOfficialLaw({...item,sourceFile:initialTexts[item.id]?.source.sourceFile},initialTexts[item.id]?.source.pdfUrl);hash=payload.source.sha256;}
   const old=previous.activeRun.startsWith('initial')?(initialTexts[item.id]?.source.sha256||initialBgn.find(x=>x.id===item.id)?.sha256):(await db.prepare('SELECT source_hash FROM legal_entries WHERE run_id=? AND law_id=?').bind(previous.activeRun,item.id).first<{source_hash:string}>())?.source_hash;
   if(old!==hash)changed=1;
   await db.prepare('INSERT INTO legal_entries (run_id,law_id,payload,source_hash) VALUES (?,?,?,?) ON CONFLICT(run_id,law_id) DO UPDATE SET payload=excluded.payload,source_hash=excluded.source_hash').bind(runId,item.id,JSON.stringify(payload),hash).run();
  }
  const cursor=start+batch.length;await db.prepare('UPDATE legal_runs SET cursor=?,changed=? WHERE id=? AND status=? AND cursor=?').bind(cursor,changed,runId,'running',start).run();
  return {runId,status:'running',cursor,total:catalog.length,readyToPublish:cursor===catalog.length};
 }catch(error){await db.prepare('UPDATE legal_runs SET status=?,error=?,finished_at=? WHERE id=?').bind('failed',String(error).slice(0,240),Math.floor(Date.now()/1000),runId).run();throw new HttpError(502,'Eine offizielle Quelle konnte nicht vollständig geprüft werden. Der letzte erfolgreiche Stand bleibt aktiv.');}
}
export async function publishUpdate(db:D1Database,runId:string){
 const run=await db.prepare('SELECT status,cursor,changed FROM legal_runs WHERE id=?').bind(runId).first<any>();if(!run||run.status!=='running'||run.cursor!==catalog.length)throw new HttpError(409,'Der Update-Lauf ist noch nicht vollständig erfolgreich.');
 const count=await db.prepare('SELECT COUNT(*) AS count FROM legal_entries WHERE run_id=?').bind(runId).first<{count:number}>();if(count?.count!==catalog.length)throw new HttpError(409,'Es fehlen geprüfte Quellen.');
 const now=Math.floor(Date.now()/1000);const ops=[db.prepare('UPDATE legal_runs SET status=?,finished_at=? WHERE id=?').bind('complete',now,runId),db.prepare('INSERT INTO legal_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('active_run',runId)];
 if(run.changed)ops.push(db.prepare('INSERT INTO legal_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('last_changed',new Date().toISOString()));
 await db.batch(ops);return updateMeta(db);
}

export async function maintenanceStatus(db:D1Database){const meta=await updateMeta(db);const latestRun=await db.prepare('SELECT id,status,cursor,error FROM legal_runs ORDER BY started_at DESC LIMIT 1').first();return {...meta,latestRun};}
export async function stageOfficialSource(db:D1Database,bucket:R2Bucket,runId:string,lawId:string,bytes:Uint8Array){
 const run=await db.prepare('SELECT id,status,cursor,changed FROM legal_runs WHERE id=?').bind(runId).first<any>();
 if(!run||run.status!=='running')throw new HttpError(409,'Kein aktiver Update-Lauf.');const item=catalog[run.cursor];
 if(!item||item.id!==lawId)throw new HttpError(409,'Die Quelle entspricht nicht dem nächsten Eintrag des Update-Laufs.');
 if(bytes.length>3_000_000)throw new HttpError(413,'Die Quelldatei überschreitet die festgelegte Grenze.');
 try{
  let payload:any,hash:string;
  if(item.localPdf){if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('Ungültige PDF-Datei');hash=await digest(bytes);await bucket.put(`legal/${runId}/${item.id}.pdf`,bytes,{httpMetadata:{contentType:'application/pdf'}});payload={source:{id:item.id,url:item.url,sha256:hash,retrieved:new Date().toISOString()},pdf:true};}
  else{payload=await parseOfficialArchive({...item,sourceFile:initialTexts[item.id].source.sourceFile},bytes,initialTexts[item.id].source.pdfUrl);hash=payload.source.sha256;}
  const previous=await updateMeta(db);const old=previous.activeRun.startsWith('initial')?(initialTexts[item.id]?.source.sha256||initialBgn.find(x=>x.id===item.id)?.sha256):(await db.prepare('SELECT source_hash FROM legal_entries WHERE run_id=? AND law_id=?').bind(previous.activeRun,item.id).first<{source_hash:string}>())?.source_hash;
  const changed=run.changed||old!==hash?1:0;
  await db.batch([db.prepare('INSERT INTO legal_entries (run_id,law_id,payload,source_hash) VALUES (?,?,?,?)').bind(runId,item.id,JSON.stringify(payload),hash),db.prepare('UPDATE legal_runs SET cursor=?,changed=? WHERE id=? AND cursor=? AND status=?').bind(run.cursor+1,changed,runId,run.cursor,'running')]);
  return {runId,lawId,sourceHash:hash,status:'running',cursor:run.cursor+1,total:catalog.length,readyToPublish:run.cursor+1===catalog.length};
 }catch(e){const message=`${item.id}: ${String(e).slice(0,180)}`;await db.prepare('UPDATE legal_runs SET status=?,error=?,finished_at=? WHERE id=?').bind('failed',message,Math.floor(Date.now()/1000),runId).run();throw new HttpError(502,'Die Quelldatei konnte nicht vollständig geprüft werden: '+message);}
}
