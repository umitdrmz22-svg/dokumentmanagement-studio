'use strict';
(function(){
  const shared=window.EHS_PLATFORM_CONFIG||{};
  const current=window.APP_CONFIG||{};
  window.APP_CONFIG=Object.freeze({
    supabaseUrl:shared.supabaseUrl||current.supabaseUrl||'',
    supabasePublishableKey:shared.supabasePublishableKey||shared.supabaseAnonKey||current.supabasePublishableKey||'',
    appName:'Dokumentenmanagement Studio',
    productionOnly:true
  });
})();
