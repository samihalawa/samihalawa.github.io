const C='ae2026090-v2';const F=['./','index.html','styles.css','app.js','manifest.json','assets/icon.svg','assets/tique-ejemplo.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).catch(()=>{})));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
