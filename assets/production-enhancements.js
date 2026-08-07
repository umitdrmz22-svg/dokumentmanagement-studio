'use strict';
(function(){
  const cfg=window.APP_CONFIG||{};
  if(!cfg.supabaseUrl||!cfg.supabasePublishableKey||!window.supabase?.createClient)return;
  const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let currentView='documents';

  function installStyles(){
    if($('#dmsEnhancementStyles'))return;
    const style=document.createElement('style');
    style.id='dmsEnhancementStyles';
    style.textContent=`
      .dms-prod-panel{background:#fff;border:1px solid #d8e1e4;border-radius:14px;padding:20px;margin-top:16px;box-shadow:0 4px 16px rgba(23,52,61,.04)}
      .dms-prod-panel.hidden{display:none!important}.dms-prod-panel h2{margin:0 0 6px;font-size:20px}.dms-prod-panel>p{margin:0 0 18px;color:#657b82}
      .dms-prod-table-wrap{overflow:auto;border:1px solid #e0e7e9;border-radius:12px}.dms-prod-table{width:100%;border-collapse:collapse;min-width:850px}.dms-prod-table th,.dms-prod-table td{text-align:left;padding:11px 12px;border-bottom:1px solid #edf1f2;vertical-align:top}.dms-prod-table th{font-size:12px;color:#657b82;background:#f7f9fa}.dms-prod-table tr:last-child td{border-bottom:0}
      .dms-prod-status{display:inline-block;padding:4px 7px;border-radius:999px;font-size:12px;font-weight:700;background:#eef3f4}.dms-prod-status.warn{background:#fff5d6;color:#795b00}.dms-prod-status.bad{background:#fde9e7;color:#9b2c22}.dms-prod-status.ok{background:#e5f5ef;color:#17694f}
      .dms-prod-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.dms-prod-card{border:1px solid #e0e7e9;border-radius:12px;padding:14px;background:#fbfcfc}.dms-prod-card small{display:block;color:#657b82;margin-bottom:5px}.dms-prod-card strong{display:block;word-break:break-word}
    `;
    document.head.appendChild(style);
  }

  function applyFormDefaults(){
    const defaults={documentType:'Betriebsanweisung',confidentiality:'intern',revisionLabel:'0'};
    for(const [id,value] of Object.entries(defaults)){
      const el=document.getElementById(id);
      if(el&&!el.value)el.value=value;
    }
  }

  function prepareNav(){
    const map=['documents','tasks','review','audit'];
    $$('.sidebar nav .nav').forEach((btn,i)=>{if(!btn.dataset.view)btn.dataset.view=map[i]||'documents';});
  }

  async function context(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session)return {session:null,membership:null,documents:[]};
    const {data:membership,error:mErr}=await sb.from('organization_members').select('organization_id,role,organizations(name)').eq('user_id',session.user.id).eq('status','active').limit(1).maybeSingle();
    if(mErr)throw mErr;
    if(!membership)return {session,membership:null,documents:[]};
    const {data:documents,error:dErr}=await sb.from('documents').select('*').eq('organization_id',membership.organization_id).order('updated_at',{ascending:false});
    if(dErr)throw dErr;
    return {session,membership,documents:documents||[]};
  }

  function panel(){
    let el=$('#dmsProductionViewPanel');
    if(el)return el;
    el=document.createElement('section');
    el.id='dmsProductionViewPanel';
    el.className='dms-prod-panel hidden';
    const content=$('.content');
    const head=$('.page-head');
    if(content&&head)head.insertAdjacentElement('afterend',el);
    return el;
  }

  function setNativeVisible(visible){
    $$('.metrics,.toolbar,.table-card').forEach(el=>el.classList.toggle('hidden',!visible));
    const btn=$('#newDocument');if(btn)btn.classList.toggle('hidden',!visible);
    panel().classList.toggle('hidden',visible);
  }

  function activate(view){
    currentView=view;
    $$('.sidebar nav .nav').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
  }

  function heading(title,text){
    const h=$('.page-head h1');if(h)h.textContent=title;
    const p=$('.page-head div>p:last-child');if(p)p.textContent=text;
  }

  function statusLabel(status){
    const map={draft:'Entwurf',in_review:'In Prüfung',awaiting_approval:'Freigabe offen',changes_requested:'Änderung erforderlich',approved:'Freigegeben',obsolete:'Ungültig',archived:'Archiviert'};
    return map[status]||status||'—';
  }

  function statusClass(status){
    if(['approved'].includes(status))return 'ok';
    if(['changes_requested','obsolete'].includes(status))return 'bad';
    if(['in_review','awaiting_approval'].includes(status))return 'warn';
    return '';
  }

  function date(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString('de-DE');}

  function openInDocuments(number){
    showDocuments();
    const input=$('#searchInput');
    if(input){input.value=number;input.dispatchEvent(new Event('input',{bubbles:true}));}
  }

  async function showTasks(){
    setNativeVisible(false);activate('tasks');heading('Meine Aufgaben','Dokumente, bei denen Sie als Ersteller, Prüfer oder Freigeber aktuell tätig werden müssen.');
    const el=panel();el.innerHTML='<h2>Meine Aufgaben</h2><p>Daten werden geladen …</p>';
    try{
      const {session,documents}=await context();
      if(!session){el.innerHTML='<h2>Meine Aufgaben</h2><p>Bitte zuerst anmelden.</p>';return;}
      const tasks=documents.filter(d=>(d.status==='in_review'&&d.reviewer_user_id===session.user.id)||(d.status==='awaiting_approval'&&d.approver_user_id===session.user.id)||(d.status==='changes_requested'&&d.creator_user_id===session.user.id));
      const rows=tasks.map(d=>{let task='Bearbeiten';if(d.status==='in_review')task='Prüfen';else if(d.status==='awaiting_approval')task='Freigeben';return `<tr><td><strong>${esc(d.document_number)}</strong><br><small>${esc(d.title)}</small></td><td><span class="dms-prod-status ${statusClass(d.status)}">${esc(statusLabel(d.status))}</span></td><td>${esc(task)}</td><td>${date(d.review_due)}</td><td><button class="btn ghost" type="button" data-open-document="${esc(d.document_number)}">Dokument öffnen</button></td></tr>`;}).join('');
      el.innerHTML=`<h2>Meine Aufgaben</h2><p>${tasks.length} offene persönliche Aufgabe(n).</p><div class="dms-prod-table-wrap"><table class="dms-prod-table"><thead><tr><th>Dokument</th><th>Status</th><th>Aufgabe</th><th>Wiedervorlage</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5">Aktuell keine offenen Aufgaben.</td></tr>'}</tbody></table></div>`;
    }catch(err){el.innerHTML=`<h2>Meine Aufgaben</h2><p>${esc(err.message||err)}</p>`;}
  }

  async function showReviewDue(){
    setNativeVisible(false);activate('review');heading('Wiedervorlage','Fällige und bevorstehende Dokumentprüfungen aus dem organisationsbezogenen Dokumentenbestand.');
    const el=panel();el.innerHTML='<h2>Wiedervorlage</h2><p>Daten werden geladen …</p>';
    try{
      const {session,documents}=await context();
      if(!session){el.innerHTML='<h2>Wiedervorlage</h2><p>Bitte zuerst anmelden.</p>';return;}
      const today=new Date();today.setHours(0,0,0,0);const horizon=new Date(today);horizon.setDate(horizon.getDate()+90);
      const due=documents.filter(d=>d.review_due&&!['obsolete','archived'].includes(d.status)&&new Date(d.review_due)<=horizon).sort((a,b)=>String(a.review_due).localeCompare(String(b.review_due)));
      const rows=due.map(d=>{const overdue=new Date(d.review_due)<today;return `<tr><td><strong>${esc(d.document_number)}</strong><br><small>${esc(d.title)}</small></td><td>${date(d.review_due)}</td><td><span class="dms-prod-status ${overdue?'bad':'warn'}">${overdue?'fällig':'innerhalb 90 Tage'}</span></td><td>${esc(statusLabel(d.status))}</td><td><button class="btn ghost" type="button" data-open-document="${esc(d.document_number)}">Dokument öffnen</button></td></tr>`;}).join('');
      el.innerHTML=`<h2>Wiedervorlage</h2><p>Fällige und in den nächsten 90 Tagen anstehende Prüfungen.</p><div class="dms-prod-table-wrap"><table class="dms-prod-table"><thead><tr><th>Dokument</th><th>Termin</th><th>Bewertung</th><th>Status</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5">Keine Wiedervorlagen im Zeitraum.</td></tr>'}</tbody></table></div>`;
    }catch(err){el.innerHTML=`<h2>Wiedervorlage</h2><p>${esc(err.message||err)}</p>`;}
  }

  async function showAudit(){
    setNativeVisible(false);activate('audit');heading('Audit-Trail','Chronologische Dokumentereignisse für Nachvollziehbarkeit von Erstellung, Prüfung, Freigabe und Revision.');
    const el=panel();el.innerHTML='<h2>Audit-Trail</h2><p>Daten werden geladen …</p>';
    try{
      const {session,membership,documents}=await context();
      if(!session||!membership){el.innerHTML='<h2>Audit-Trail</h2><p>Bitte zuerst anmelden.</p>';return;}
      const ids=documents.map(d=>d.id);
      let events=[];
      if(ids.length){const {data,error}=await sb.from('document_events').select('id,document_id,event_type,from_status,to_status,comment,created_at,actor_user_id').in('document_id',ids).order('created_at',{ascending:false}).limit(200);if(error)throw error;events=data||[];}
      const docMap=Object.fromEntries(documents.map(d=>[d.id,d]));
      const rows=events.map(e=>{const d=docMap[e.document_id]||{};return `<tr><td>${date(e.created_at)}</td><td><strong>${esc(d.document_number||'—')}</strong><br><small>${esc(d.title||'')}</small></td><td>${esc(e.event_type)}</td><td>${esc(e.from_status||'—')} → ${esc(e.to_status||'—')}</td><td>${esc(e.comment||'—')}</td></tr>`;}).join('');
      el.innerHTML=`<h2>Audit-Trail</h2><p>Die letzten ${events.length} protokollierten Ereignisse.</p><div class="dms-prod-table-wrap"><table class="dms-prod-table"><thead><tr><th>Zeitpunkt</th><th>Dokument</th><th>Ereignis</th><th>Statusänderung</th><th>Vermerk</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Noch keine Ereignisse vorhanden.</td></tr>'}</tbody></table></div>`;
    }catch(err){el.innerHTML=`<h2>Audit-Trail</h2><p>${esc(err.message||err)}</p>`;}
  }

  function showDocuments(){
    setNativeVisible(true);activate('documents');heading('Dokumentenübersicht','Gelenkte Dokumente mit eindeutiger Nummer, Version, Prüfung, Freigabe, Gültigkeit und lückenloser Änderungshistorie.');
  }

  function showView(view){if(view==='tasks')return showTasks();if(view==='review')return showReviewDue();if(view==='audit')return showAudit();showDocuments();}

  document.addEventListener('click',event=>{
    const nav=event.target.closest('.sidebar nav .nav');
    if(nav){event.preventDefault();showView(nav.dataset.view||'documents');return;}
    if(event.target.closest('#newDocument'))setTimeout(applyFormDefaults,0);
    const open=event.target.closest('[data-open-document]');if(open){openInDocuments(open.dataset.openDocument);return;}
  });
  document.addEventListener('submit',event=>{if(event.target?.id==='documentForm')applyFormDefaults();},true);
  document.addEventListener('DOMContentLoaded',()=>{installStyles();prepareNav();applyFormDefaults();activate('documents');},{once:true});
})();
