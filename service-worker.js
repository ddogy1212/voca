const CACHE="vocabwalk-v6-7-photo-json-fix";
const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=067",
  "./app.js?v=067",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  const url=new URL(req.url);
  if(req.method!=="GET" || url.hostname==="api.openai.com")return;

  // HTML/JS/CSS는 network-first. 업데이트가 있으면 무조건 새 파일 우선.
  if(req.mode==="navigate" || /\.(js|css)$/.test(url.pathname)){
    event.respondWith(
      fetch(req,{cache:"no-store"}).then(resp=>{
        const copy=resp.clone();
        caches.open(CACHE).then(c=>c.put(req,copy));
        return resp;
      }).catch(()=>caches.match(req).then(r=>r||caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(req,copy));
      return resp;
    }))
  );
});
