'use strict';
(function(){
  const demo=new URLSearchParams(location.search).get('demo')==='1';
  if(demo){
    window.APP_CONFIG=Object.freeze({appName:'Dokumentenmanagement Studio · Präsentationsmodus',productionOnly:false,supabaseUrl:'',supabasePublishableKey:''});
    document.documentElement.dataset.appMode='demo';
    document.write('<script src="assets/app-core.js?v=7"><\/script><script src="assets/demo-enhancements.js?v=2"><\/script>');
    return;
  }
  const cfg=window.APP_CONFIG||{};
  localStorage.removeItem('dms-studio-demo-v1');
  const configured=Boolean(cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase?.createClient);
  if(!configured){
    const render=()=>{document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;padding:32px;background:#f4f7f8;font-family:Arial,sans-serif;color:#17343d"><section style="max-width:720px;background:#fff;border:1px solid #d8e1e4;border-radius:18px;padding:34px"><p>PRODUKTIVBETRIEB</p><h1>Dokumentenmanagement ist noch nicht verbunden</h1><p>Für Anmeldung, Dokumentversionen und dauerhafte Speicherung ist die gemeinsame Plattformverbindung erforderlich.</p></section></main>`;};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();return;
  }
  document.write('<script src="assets/app-core.js?v=6"><\/script><script src="assets/werk-context.js?v=1"><\/script><script src="assets/origin-scope.js?v=1"><\/script><script src="assets/app-workflow.js?v=5"><\/script><script src="assets/production-auth.js?v=5"><\/script><script src="assets/production-enhancements.js?v=5"><\/script>');
})();