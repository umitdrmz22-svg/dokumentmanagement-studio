'use strict';
(function(){
  const cfg=window.APP_CONFIG||{};
  const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const apply=session=>{
    const badge=document.querySelector('#connectionBadge');
    const newButton=document.querySelector('#newDocument');
    if(!session){
      if(badge){badge.textContent='Anmeldung erforderlich';badge.className='badge';}
      const org=document.querySelector('#orgName');if(org)org.textContent='Organisation';
      const user=document.querySelector('#userLabel');if(user)user.textContent='Nicht angemeldet';
      if(newButton)newButton.disabled=true;
      setTimeout(()=>{const dialog=document.querySelector('#authDialog');if(dialog&&!dialog.open)dialog.showModal();},0);
      return;
    }
    if(newButton)newButton.disabled=false;
  };
  const init=async()=>{
    const {data}=await client.auth.getSession();
    apply(data.session);
    client.auth.onAuthStateChange((_event,session)=>apply(session));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
