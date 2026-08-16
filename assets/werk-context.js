'use strict';

async function waitForDmsEhsAccess(){
  if(globalThis.DefiDevEHSAccess)return globalThis.DefiDevEHSAccess;
  if(!document.querySelector('script[src*="ehs-entitlement-gate.js"]'))return null;
  return await new Promise(resolve=>window.addEventListener('defidev-ehs-entitlement-ready',event=>resolve(globalThis.DefiDevEHSAccess||event.detail||null),{once:true}));
}

loadAll=async function(){
  if(!session){documents=[];members=[];organization=null;render();return;}
  const ehsAccess=await waitForDmsEhsAccess();
  let membershipQuery=sb.from('organization_members').select('organization_id,role,organizations(name)').eq('user_id',session.user.id).eq('status','active');
  if(ehsAccess?.organizationId)membershipQuery=membershipQuery.eq('organization_id',ehsAccess.organizationId);
  else membershipQuery=membershipQuery.limit(1);
  const {data:membership,error}=await membershipQuery.maybeSingle();
  if(error)return notify(error.message);
  organization=membership;
  $('#orgName').textContent=membership?.organizations?.name||'Organisation';
  if(!membership)return;
  const {data:memberRows,error:memberError}=await sb.from('organization_members').select('user_id,role').eq('organization_id',membership.organization_id).eq('status','active');
  if(memberError)return notify(memberError.message);
  const ids=(memberRows||[]).map(x=>x.user_id);
  let profileMap={};
  if(ids.length){
    const {data:profiles}=await sb.from('profiles').select('id,full_name').in('id',ids);
    profileMap=Object.fromEntries((profiles||[]).map(p=>[p.id,p.full_name]));
  }
  members=(memberRows||[]).map(m=>({...m,name:profileMap[m.user_id]||m.user_id}));
  const {data,error:docsError}=await sb.from('documents').select('*').eq('organization_id',membership.organization_id).order('updated_at',{ascending:false});
  if(docsError)return notify(docsError.message);
  documents=data||[];
  fillMemberSelects();
  render();
};
