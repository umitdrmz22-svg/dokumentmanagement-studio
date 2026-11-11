'use strict';
// This database holds a non-exportable browser key, never a password or a secret URL.
window.AushangDevice=(()=>{
 const activeId=location.pathname.match(/^\/geraet\/([a-f0-9-]{36})\/?$/)?.[1]||null;
 if(activeId)document.querySelector('link[rel=manifest]').href='/geraet/'+activeId+'/manifest.webmanifest';
 let unlocking=null;
 async function store(mode,operation){
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('aushang-device-keys',1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Der Browser kann den Geräteschlüssel nicht speichern.'));});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('keys',mode),r=operation(tx.objectStore('keys'));let value;r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(Error('Der lokale Gerätespeicher ist nicht verfügbar.'));tx.onabort=()=>reject(Error('Der lokale Gerätespeicher wurde nicht gespeichert.'));});}finally{db.close();}
 }
 const get=id=>store('readonly',s=>s.get(id)),put=(id,value)=>store('readwrite',s=>s.put(value,id)),remove=id=>store('readwrite',s=>s.delete(id));
 async function call(path,body,method='POST'){
  let r;try{r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}catch{const e=Error('Keine Internetverbindung. Der Gerätezugang bleibt gespeichert und öffnet sich wieder, sobald die Verbindung steht.');e.offline=true;throw e;}
  const data=await r.json().catch(()=>({}));if(!r.ok){const e=Error(data.error||'Der Gerätezugang ist momentan nicht verfügbar.');e.status=r.status;throw e;}return data;
 }
 function url(id){return new URL('/geraet/'+id,location.origin).href;}
 function base64url(value){return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
 async function enroll(label){
  if(!crypto.subtle||!window.indexedDB)throw Error('Für den Gerätezugang bitte einen aktuellen Browser mit HTTPS verwenden.');
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  const pending='pending-'+crypto.randomUUID();let registered;
  try{
   await put(pending,pair.privateKey);const saved=await get(pending);
   if(!saved||saved.extractable!==false)throw Error('Der Browser kann den geschützten Geräteschlüssel nicht dauerhaft speichern.');
   await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},saved,new TextEncoder().encode('aushang-storage-check'));
   registered=await call('/api/devices',{label,publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)});
   await put(registered.id,saved);
   const key=await get(registered.id);if(!key||key.extractable!==false)throw Error('Der lokale Geräteschlüssel wurde nicht gespeichert.');
   // This asks the browser to protect the key from storage eviction; permission is browser-managed.
   if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
   return {...registered,url:url(registered.id)};
  }catch(e){if(registered)await call('/api/devices/'+registered.id,undefined,'DELETE').catch(()=>{});throw e;}
  finally{await remove(pending).catch(()=>{});}
 }
 async function unlock(){
  if(!activeId)throw Error('Kein Geräte-Link geöffnet.');
  if(unlocking)return unlocking;
  unlocking=(async()=>{
   const privateKey=await get(activeId);
   if(!privateKey){const e=Error('Dieser Link ist in diesem Browser nicht freigeschaltet. Bitte zuerst mit Benutzername und Passwort anmelden und diesen Firmencomputer einrichten.');e.missingKey=true;throw e;}
   const challenge=await call('/api/device/challenge',{deviceId:activeId});
   const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,new TextEncoder().encode(challenge.message));
   await call('/api/device/unlock',{deviceId:activeId,challengeId:challenge.challengeId,signature:base64url(signature)});
  })();
  try{return await unlocking;}finally{unlocking=null;}
 }
 function download(id){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['[InternetShortcut]\r\nURL='+url(id)+'\r\n'],{type:'application/internet-shortcut'}));a.download='aushang-Firmencomputer.url';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 }
 return {activeId,enroll,unlock,url,download,hasKey:async id=>!!(await get(id))};
})();
