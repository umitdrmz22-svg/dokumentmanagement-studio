'use strict';
const CACHE='aushang-book-v2';
let knownPaths=null;
async function assetPaths(){
 if(knownPaths)return knownPaths;
 const response=await fetch(new URL('./precache.json',self.registration.scope));
 if(!response.ok||response.redirected)throw Error('Offline asset list unavailable');
 const paths=await response.json();
 knownPaths=new Set(paths.map(path=>new URL(path,self.registration.scope).pathname));
 return knownPaths;
}
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const paths=await assetPaths();const cache=await caches.open(CACHE);
  for(const pathname of paths){
   const url=new URL(pathname,self.location.origin);const response=await fetch(url);
   if(!response.ok||response.redirected||new URL(response.url).origin!==self.location.origin)throw Error('Offline package incomplete');
   // This explicit list contains only public application and legal-text assets.
   await cache.put(url,response);
  }
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('aushang-book-')||key.startsWith('aushang-shell-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cached=await caches.match(event.request,{cacheName:CACHE});
  // Requests outside the app's explicit cached package are never stored (e.g. auth routes).
  try{
   const response=await fetch(event.request);
   if(cached&&response.ok&&!response.redirected&&new URL(response.url).origin===url.origin){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
   return response;
  }catch{return cached||new Response('Offline. Bitte Internetverbindung herstellen.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
 })());
});
