import {catalog,initialTexts,initialBgn} from './generated-legal';
import {updateMeta} from './updates';
import {secureHeaders} from './security';
import {sessionFor,canRead} from './accounts';
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
export async function sourceIndexPage(db:D1Database,request:Request){
 const session=await sessionFor(db,request);
 if(!session||!canRead(session.account)){const headers=secureHeaders('text/html; charset=utf-8');headers.set('Location',session?'/#aushang':'/#anmelden');return new Response(null,{status:303,headers});}
 const data=await sourceIndex(db),account=session.account,query=new URL(request.url).searchParams.get('q')?.slice(0,180)||'';
 const fold=(value:string)=>value.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss');
 const rows=data.sources.filter(s=>fold(s.title+' '+s.id+' '+s.officialUrl).includes(fold(query)));
 return new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quellenverzeichnis · aushang.</title><link rel="stylesheet" href="/style.css"></head><body><header class="source-header"><a href="/#aushang" class="footer-brand">aushang.</a><nav><a href="/#aushang">Aushangpflichtige Gesetze</a><a href="/#alle-gesetze">Alle Gesetze</a><a href="/#favorites">Favoriten</a></nav></header><main id="main" class="source-index-page"><section class="site-scope"><div><strong>${esc(account.company)} · ${esc(account.work)}</strong><span>${esc(account.street)} ${esc(account.houseNumber)}, ${esc(account.postalCode)} ${esc(account.city)}</span></div><small>Gehört ausschließlich zu diesem Werk und dieser Adresse</small></section><h1>Quellenverzeichnis</h1><p>Letzte vollständig veröffentlichte Quellenprüfung: <strong>${esc(data.meta.lastSuccessfulCheck)}</strong></p><form role="search" class="search-toolbar" method="get"><label class="search-field"><input name="q" type="search" value="${esc(query)}" aria-label="Quellen durchsuchen" placeholder="Titel oder Abkürzung suchen"></label><button class="button primary" type="submit">Suchen</button></form><p>${rows.length} Quellen · <a href="/api/sources">Quellenmetadaten als JSON</a></p><div class="source-table"><table><thead><tr><th>Titel / offizielle Quelle</th><th>Im Portal gespeicherter Fassungsstand</th></tr></thead><tbody>${rows.map(s=>`<tr><td><a href="${esc(s.officialUrl)}" rel="noreferrer">${esc(s.title)}</a><small>${esc(s.officialUrl)}</small></td><td>${s.version.length?s.version.map((v:string)=>esc(v)).join('<br>'):'Original-PDF der BGN; Quellenfassung im Dokument prüfen'}<small>Abruf: ${esc(s.retrieved)}</small></td></tr>`).join('')}</tbody></table></div><p class="directory-footnote">Die monatliche Aktualisierung übernimmt ausschließlich die 44 freigegebenen amtlichen Quellen. Neue Fassungen und das Erfolgsdatum werden erst nach vollständiger Prüfung veröffentlicht. Zusätzliche Themenlinks sind separat im Portal gekennzeichnet.</p></main></body></html>`,{headers:secureHeaders('text/html; charset=utf-8')});
}
