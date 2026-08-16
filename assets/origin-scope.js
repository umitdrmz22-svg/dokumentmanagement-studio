'use strict';

let dmsOriginWerk=null;
const dmsScopeLabels={werk:'Werk / Standort',germany:'Deutschland',international:'International'};

function currentDmsWerk(){
  const access=globalThis.DefiDevEHSAccess||{};
  return access.selectedWerk || (Array.isArray(access.works)&&access.works.length===1?access.works[0]:null) || dmsOriginWerk;
}

function ensureOriginScopeFields(){
  if(document.querySelector('#documentScope'))return;
  const department=document.querySelector('#department')?.closest('label');
  if(!department)return;
  const scope=document.createElement('label');
  scope.innerHTML='Geltungsbereich<select id="documentScope"><option value="werk">Werk / Standort</option><option value="germany">Deutschland</option><option value="international">International</option></select>';
  const origin=document.createElement('label');
  origin.innerHTML='Herkunftswerk<input id="originWerkDisplay" readonly aria-readonly="true" title="Wird beim Anlegen festgeschrieben und kann später nicht geändert werden.">';
  department.after(scope,origin);
}

function scopeOf(d){return ['werk','germany','international'].includes(d?.scope)?d.scope:'werk';}
function originLabel(d){
  const werk=currentDmsWerk();
  if(d?.origin_werk_id && werk?.id===d.origin_werk_id)return [werk.name,werk.code].filter(Boolean).join(' · ');
  if(d?.origin_werk_id)return 'Festgeschriebenes Herkunftswerk';
  return werk?[werk.name,werk.code].filter(Boolean).join(' · '):'Werk-Kontext nicht geladen';
}

const baseOpenForm=openForm;
openForm=function(d=null){
  ensureOriginScopeFields();
  baseOpenForm(d);
  const scope=document.querySelector('#documentScope');
  const origin=document.querySelector('#originWerkDisplay');
  if(scope){scope.value=scopeOf(d);scope.disabled=Boolean(d&&!['draft','changes_requested'].includes(d.status));}
  if(origin){origin.value=originLabel(d);origin.disabled=false;origin.readOnly=true;}
};

const baseFormPayload=formPayload;
formPayload=function(){
  const payload=baseFormPayload();
  payload.scope=document.querySelector('#documentScope')?.value||'werk';
  return payload;
};

saveDocument=async function(e){
  e.preventDefault();
  const id=$('#documentId').value,d=id?documents.find(x=>x.id===id):null;
  if(d&&!['draft','changes_requested'].includes(d.status))return $('#formMessage').textContent='Dieses Dokument ist nicht bearbeitbar.';
  const file=$('#documentFile').files[0];
  if((!d||!d.current_file_path)&&!file)return $('#formMessage').textContent='Für diese Version ist eine Datei erforderlich.';
  const payload=formPayload();
  if(!payload.document_number||!payload.title||!payload.change_note)return $('#formMessage').textContent='Bitte alle Pflichtfelder ausfüllen.';
  if(hasCloud){
    if(!session||!organization)return $('#formMessage').textContent='Bitte zuerst anmelden.';
    const originWerk=currentDmsWerk();
    if(!d&&(!originWerk?.id||!originWerk?.organizationId))return $('#formMessage').textContent='Werk-Kontext konnte nicht bestimmt werden. Bitte über das EHS-Dashboard erneut öffnen.';
    if(!d&&String(originWerk.organizationId)!==String(organization.organization_id))return $('#formMessage').textContent='Werk und Organisation stimmen nicht überein.';
    const docId=id||crypto.randomUUID();let fileMeta=null;
    if(file){
      const nextVersion=d?Number(d.current_version||0)+1:1;
      const path=`${organization.organization_id}/${docId}/v${nextVersion}/${Date.now()}-${safeName(file.name)}`;
      const {error:uploadError}=await sb.storage.from('documents').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
      if(uploadError)return $('#formMessage').textContent=uploadError.message;
      fileMeta={path,nextVersion,name:file.name,mime:file.type||'application/octet-stream',size:file.size};
    }
    const docData={organization_id:organization.organization_id,document_number:payload.document_number,title:payload.title,document_type:payload.document_type,category:payload.category,department:payload.department,scope:payload.scope,revision_label:payload.revision_label,valid_from:payload.valid_from,review_due:payload.review_due,document_owner:payload.document_owner,reviewer_user_id:payload.reviewer_user_id,approver_user_id:payload.approver_user_id,confidentiality:payload.confidentiality,keywords:payload.keywords};
    if(d){
      const {error}=await sb.from('documents').update(docData).eq('id',docId);if(error)return $('#formMessage').textContent=error.message;
    }else{
      const {error}=await sb.from('documents').insert({id:docId,...docData,origin_werk_id:originWerk.id,creator_user_id:session.user.id,status:'draft'});if(error)return $('#formMessage').textContent=error.message;
    }
    if(fileMeta){
      const {error}=await sb.from('document_versions').insert({document_id:docId,version_number:fileMeta.nextVersion,revision_label:payload.revision_label,file_path:fileMeta.path,original_file_name:fileMeta.name,mime_type:fileMeta.mime,file_size:fileMeta.size,change_note:payload.change_note,created_by:session.user.id});if(error)return $('#formMessage').textContent=error.message;
    }
    await loadAll();
  }else{
    if(d){Object.assign(d,payload,{updated_at:new Date().toISOString()});}
    else return $('#formMessage').textContent='Produktivbetrieb benötigt eine Online-Verbindung.';
    saveDemo();render();
  }
  $('#documentDialog').close();
};

const baseLoadAll=loadAll;
loadAll=async function(){
  await baseLoadAll();
  const access=globalThis.DefiDevEHSAccess||{};
  dmsOriginWerk=access.selectedWerk || (Array.isArray(access.works)&&access.works.length===1?access.works[0]:null) || dmsOriginWerk;
  ensureOriginScopeFields();
};

const baseRowHtml=rowHtml;
rowHtml=function(d){
  const html=baseRowHtml(d);
  const label=dmsScopeLabels[scopeOf(d)]||'Werk / Standort';
  return html.replace('</strong><small>',`</strong><small>${esc(label)} · `);
};

document.addEventListener('DOMContentLoaded',()=>{ensureOriginScopeFields();},{once:true});
