'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
 q('#connectionBadge').textContent='BGN Demo · lokal';q('#connectionBadge').className='badge demo';q('#orgName').textContent='Musterwerk Lebensmittel GmbH';q('#userLabel').textContent='Präsentationsdaten · nur dieses Gerät';q('#authButton')?.classList.add('hidden');q('#logoutButton')?.classList.add('hidden');
 const n=document.createElement('div');n.style.cssText='margin:0 0 18px;padding:12px 14px;border:1px solid #efd27b;border-radius:10px;background:#fff8df';n.innerHTML='<strong>Präsentationsmodus</strong> · Fiktive lokale Dokumente. Keine Übertragung an ein Backend. <button id="resetDmsDemo" class="btn ghost" type="button">Demo zurücksetzen</button>';q('.content')?.prepend(n);
 q('#resetDmsDemo')?.addEventListener('click',()=>{localStorage.removeItem('dms-studio-demo-v1');location.reload();});
 const tabs=qa('.sidebar nav .nav');
 const activate=(idx)=>{tabs.forEach((x,i)=>x.classList.toggle('active',i===idx));q('#searchInput').value='';q('#filterStatus').value='';q('#filterType').value='';
   if(idx===1)q('#filterStatus').value='in_review';
   if(idx===2){q('#searchInput').value='BA-GS-014';}
   if(idx===3){q('#searchInput').value='VA-EHS-001';}
   q('#searchInput').dispatchEvent(new Event('input',{bubbles:true}));
 };
 tabs.forEach((b,i)=>b.addEventListener('click',()=>activate(i)));
},{once:true});