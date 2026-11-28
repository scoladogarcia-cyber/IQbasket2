import assert from "node:assert/strict";
import {chromium} from "@playwright/test";
import {installBrowserNetworkStubs} from "./browser-test-support.mjs";
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:844}});
  await installBrowserNetworkStubs(page);await page.goto("http://127.0.0.1:4173/");
  await page.waitForFunction(()=>Boolean(window.iqApp));
  for(const role of ["ADMIN","SUPERADMIN","ENTRENADOR"]){
   const state=await page.evaluate(async role=>{
    const {LayoutView}=await import("/views/LayoutView.js");
    const {TranslationStore}=await import("/services/TranslationStore.js");await TranslationStore.setLanguage("es");
    document.getElementById("app").innerHTML=LayoutView.wrap("","dashboard",role);LayoutView.bindMobileDrawerEvents();
    if(innerWidth<768)document.querySelector("#btn-mobile-more-toggle").click();
    const host=document.querySelector(innerWidth<768?"#mobile-more-drawer":"#app-sidebar");
    return {ids:[...host.querySelectorAll("[data-package-id]")].map(e=>e.dataset.packageId),reports:host.querySelectorAll('a[href="#/reports"]').length,logout:!!host.querySelector('[data-session-action="logout"]'),overflow:document.documentElement.scrollWidth>innerWidth+1};
   },role);
   assert.equal(state.ids.length,role==="ENTRENADOR"?0:4);assert.equal(state.reports,1);assert.ok(state.logout);assert.equal(state.overflow,false);
  }
  await page.close();
 }
}finally{await browser.close();}
console.log("PACKAGE_NAVIGATION_UI_OK");
