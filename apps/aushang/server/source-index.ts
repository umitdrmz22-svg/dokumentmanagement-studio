import {catalog,initialTexts,initialBgn} from './generated-legal';
import {updateMeta} from './updates';
import {secureHeaders} from './security';
export async function sourceIndex(db:D1Database){
 const meta=await updateMeta(db);
 const rows=meta.activeRun.startsWith('initial')?[]:(await db.prepare("SELECT law_id,json_extract(payload,'$.source') AS source FROM legal_entries WHERE run_id=?").bind(meta.activeRun).all<{law_id:string;source:string}>()).results||[];
 const sources=new Map(rows.map(r=>[r.law_id,JSON.parse(r.source)]));
 return {meta,scope:'Nur öffentliche Quellenmetadaten; keine Konten, Geräte, Werke oder Adressen. Ein Kontrollbericht verändert den Veröffentlichungsstand nicht.',sources:catalog.map(l=>{
  const s=sources.get(l.id)||initialTexts[l.id]?.source||initialBgn.find(b=>b.id===l.id);
  return {id:l.id,title:l.title,officialUrl:l.url,version:s?.version||[],retrieved:s?.retrieved||meta.lastSuccessfulCheck,sha256:s?.sha256||null};
 })};
}
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function sourceIndexPage(db:D1Database){
 const data=await sourceIndex(db);
 return new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Öffentliches Quellenverzeichnis · aushang.</title><style>body{font:16px/1.6 system-ui;margin:40px auto;padding:0 24px;max-width:1200px;color:#173e38;background:#f7f8f5}h1{font:40px Georgia,serif}table{border-collapse:collapse;width:100%;background:white}th,td{padding:14px;text-align:left;border-bottom:1px solid #dce4d8;vertical-align:top}a{color:#173e38}small{display:block;color:#5f6c59}.table{overflow-x:auto}</style></head><body><a href="/">aushang. · Zum Portal</a><h1>Öffentliches Quellenverzeichnis</h1><p>Letzte vollständig veröffentlichte Quellenprüfung: <strong>${esc(data.meta.lastSuccessfulCheck)}</strong></p><p>${esc(data.scope)}</p><p>Die ChatGPT-Automatik ist auf Wunsch des Betreibers pausiert. Die Kontrolle soll extern über Copilot erfolgen; ein dortiger Bericht veröffentlicht keine neuen Portaltexte. Der nächste Prüfzeitpunkt ist erst nach vollständiger Übernahme verifizierter Quelldateien maßgeblich.</p><p><a href="/api/public/sources">Maschinenlesbares Quellenverzeichnis (JSON)</a></p><div class="table"><table><thead><tr><th>Nr.</th><th>Titel / offizielle Quelle</th><th>Im Portal gespeicherter Fassungsstand</th></tr></thead><tbody>${data.sources.map((s,i)=>`<tr><td>${i+1}</td><td><a href="${esc(s.officialUrl)}" rel="noreferrer">${esc(s.title)}</a><small>${esc(s.officialUrl)}</small></td><td>${s.version.length?s.version.map((v:string)=>esc(v)).join('<br>'):'Original-PDF der BGN; Quellenfassung im Dokument prüfen'}<small>Abruf: ${esc(s.retrieved)}</small></td></tr>`).join('')}</tbody></table></div><p>Gesetze werden aus Gesetze im Internet, DGUV-Fassungen von der BGN bezogen. Keine Verlagserläuterungen.</p></body></html>`,{headers:secureHeaders('text/html; charset=utf-8')});
}
