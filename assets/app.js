'use strict';
(function(){
  const cfg=window.APP_CONFIG||{};
  localStorage.removeItem('dms-studio-demo-v1');
  const configured=Boolean(cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase?.createClient);
  if(!configured){
    const render=()=>{
      document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;padding:32px;background:#f4f7f8;font-family:Arial,sans-serif;color:#17343d"><section style="max-width:720px;background:#fff;border:1px solid #d8e1e4;border-radius:18px;padding:34px;box-shadow:0 18px 48px rgba(23,52,61,.12)"><p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;color:#657b82">PRODUKTIVBETRIEB</p><h1 style="margin:0 0 14px;font-size:30px">Dokumentenmanagement ist noch nicht verbunden</h1><p style="margin:0 0 18px;line-height:1.55">Die Anwendung verwendet keine Demo- oder Browserdaten mehr. Für Anmeldung, Dokumentversionen und dauerhafte Speicherung müssen Supabase-URL und Publishable Key in der gemeinsamen Plattformkonfiguration hinterlegt und die Datenbankmigrationen ausgeführt sein.</p><strong>Keine Daten wurden lokal angelegt.</strong></section></main>`;
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
    return;
  }
  document.write('<script src="assets/app-core.js?v=5"><\/script><script src="assets/werk-context.js?v=1"><\/script><script src="assets/app-workflow.js?v=5"><\/script><script src="assets/production-auth.js?v=5"><\/script><script src="assets/production-enhancements.js?v=5"><\/script>');
})();
