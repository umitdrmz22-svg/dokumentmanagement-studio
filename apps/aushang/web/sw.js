// Retire the previous offline demo. Authenticated pages and credentials must not enter a shared cache.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('aushang-')).map(k=>caches.delete(k)));await self.clients.claim();await self.registration.unregister();})()));
