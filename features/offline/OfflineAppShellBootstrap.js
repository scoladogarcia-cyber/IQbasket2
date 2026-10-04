/**
 * @fileoverview Registers the V58 offline application shell.
 * @description Progressive enhancement only. Network remains preferred whenever
 * available, and release.json is never served from the service-worker cache.
 */
export async function registerOfflineAppShell(){
  if(typeof window==="undefined"||!("serviceWorker" in navigator)||!window.isSecureContext)return null;
  try{
    const registration=await navigator.serviceWorker.register("./iqbasket-sw.js",{
      scope:"./",
      updateViaCache:"none"
    });
    const refresh=()=>registration.update().catch(()=>{});
    window.addEventListener("online",refresh);
    window.addEventListener("pageshow",refresh);
    document.addEventListener("visibilitychange",()=>document.visibilityState==="visible"&&refresh());
    return registration;
  }catch(error){
    console.warn("[OfflineShell] Service worker no disponible:",error?.message||error);
    return null;
  }
}
if(typeof window!=="undefined"){
  if(document.readyState==="complete")void registerOfflineAppShell();
  else window.addEventListener("load",()=>void registerOfflineAppShell(),{once:true});
}
export default registerOfflineAppShell;
