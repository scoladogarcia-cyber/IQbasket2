import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL=process.env.GLOBAL_UI_QA_BASE_URL || "http://127.0.0.1:4173/";
const browser=await chromium.launch({ headless:true });
for (const viewport of [{name:"compact",width:320,height:568},{name:"iphone",width:390,height:844}]) {
  const page=await browser.newPage({ viewport:{ width:viewport.width,height:viewport.height } });
  await installBrowserNetworkStubs(page);
  await page.goto(BASE_URL,{ waitUntil:"domcontentloaded" });
  const result=await page.evaluate(async()=>{
    const { BusinessMetricsView }=await import("/views/admin/BusinessMetricsView.js");
    const permissions=new Set(["VIEW_BUSINESS_METRICS","VIEW_PRODUCT_FEEDBACK","REVIEW_PRODUCT_FEEDBACK"]);
    const auth={ canPreview:permission=>permissions.has(permission) };
    const view=new BusinessMetricsView({ rpc:async()=>({ data:{},error:null }) },auth);
    view.service.getMetrics=async()=>({ family_plans:{},events:{} });
    view.feedbackService.list=async()=>[{
      feedback_id:"11111111-1111-4111-8111-111111111111",
      submitter_name:"Tester Demo",submitter_email:"tester@example.test",role_snapshot:"INVITADO",
      category:"BUG",severity:"BLOCKER",message:"No puedo completar la acciÃ³n en mÃ³vil",
      route:"#/training",release_code:"2026.09.06.5:early-adopters-feedback-v1",client_context:{ viewport:"390x844" },
      status:"NEW",created_at:"2026-09-06T12:45:00Z",updated_at:"2026-09-06T12:45:00Z",
      reviewed_by:null,reviewer_name:null,reviewed_at:null,review_note:null
    }];
    let reviewed=null;
    view.feedbackService.review=async args=>{ reviewed=args; return true; };
    const host=document.createElement("div"); document.body.innerHTML=""; document.body.appendChild(host);
    await view.render(host);
    const card=host.querySelector("[data-product-feedback-triage]");
    const select=card?.querySelector('[data-feedback-status="11111111-1111-4111-8111-111111111111"]');
    if (select) select.value="PLANNED";
    const note=card?.querySelector('[data-feedback-note="11111111-1111-4111-8111-111111111111"]');
    if (note) note.value="Corregir antes de siguiente piloto";
    card?.querySelector('[data-feedback-review="11111111-1111-4111-8111-111111111111"]')?.click();
    await new Promise(resolve=>setTimeout(resolve,20));
    return {
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      present:Boolean(card),
      text:card?.textContent||"",
      filter:Boolean(card?.querySelector("[data-feedback-filter]")),
      action:Boolean(card?.querySelector("[data-feedback-review]")),
      reviewed
    };
  });
  if (result.overflow) throw new Error(`${viewport.name}: feedback triage overflows: ${JSON.stringify(result)}`);
  if (!result.present || !result.filter || !result.action) throw new Error(`${viewport.name}: feedback triage controls missing: ${JSON.stringify(result)}`);
  if (!result.text.includes("Tester Demo") || !result.text.includes("BLOCKER") || !result.text.includes("No puedo completar")) throw new Error(`${viewport.name}: feedback content missing: ${JSON.stringify(result)}`);
  if (result.reviewed?.status!=="PLANNED" || !result.reviewed?.note?.includes("Corregir")) throw new Error(`${viewport.name}: review action not wired: ${JSON.stringify(result)}`);
  await page.close();
}
console.log("EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_UI_OK");
await browser.close();
