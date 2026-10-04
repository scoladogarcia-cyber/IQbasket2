/* IQBasket V58 · conservative offline application shell.
 * HTML and assets use network-first so online sessions always prefer the newest
 * release. Cached content is only a fallback when the venue has no connectivity.
 */
const CACHE_NAME="iqbasket-shell-v58-1";
const SHELL_URL=new URL("./",self.registration.scope).href;

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{await cache.add(new Request(SHELL_URL,{cache:"reload"}));}catch{}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("iqbasket-shell-")&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

function cacheable(response){
  return response&&response.ok&&(response.type==="basic"||response.type==="default");
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  // Release freshness must always reach the network when connectivity exists.
  if(url.pathname.endsWith("/release.json")){
    event.respondWith(fetch(request,{cache:"no-store"}));
    return;
  }

  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      try{
        const response=await fetch(request,{cache:"no-store"});
        if(cacheable(response))await cache.put(SHELL_URL,response.clone());
        return response;
      }catch{
        return (await cache.match(SHELL_URL)) || Response.error();
      }
    })());
    return;
  }

  const destination=request.destination;
  if(["script","style","font","image"].includes(destination)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      try{
        const response=await fetch(request);
        if(cacheable(response))await cache.put(request,response.clone());
        return response;
      }catch{
        return (await cache.match(request)) || Response.error();
      }
    })());
  }
});
