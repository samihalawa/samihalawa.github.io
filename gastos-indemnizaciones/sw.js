const C='ae2026090-v3';const F=['./','index.html','styles.css','app-1.js','app-2.js','app-3.js','app-4.js','manifest.json','assets/icon.svg','assets/tique-ejemplo.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).catch(()=>{})));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
