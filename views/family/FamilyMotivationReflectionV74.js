/**
 * @fileoverview Family motivation conversation, deliberately ephemeral.
 * @description No tracking, storage, federation import, scoring or medical claim.
 */
import {MOTIVATION_QUESTIONS_V74,MOTIVATION_LANG_V74,reflectionV74} from "../../domain/motivation/MotivationReflectionV74.js";
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function renderFamilyMotivationV74(locale="es"){
  const lang=MOTIVATION_LANG_V74[locale]||MOTIVATION_LANG_V74.es;
  const qs=MOTIVATION_QUESTIONS_V74.map(q=>'<label style="display:grid;gap:6px;margin:10px 0;font-size:14px">'+escape(q[locale]||q.es)+
    '<select name="'+q.id+'" style="min-height:44px;border-radius:9px;border:1px solid #cbd5e1;background:#fff;padding:8px">'+
    '<option value="">'+escape(lang.choice)+'</option><option value="YES">'+escape(lang.yes)+'</option>'+
    '<option value="SOMETIMES">'+escape(lang.sometimes)+'</option><option value="NOT_NOW">'+escape(lang.notNow)+'</option></select></label>').join("");
  return '<details data-iqb-family-motivation style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin:10px 0">'+
    '<summary style="cursor:pointer;font-weight:800;min-height:44px">'+escape(lang.title)+'</summary>'+
    '<form data-iqb-motivation-form><p style="font-size:14px;color:#475569">'+escape(lang.intro)+'</p>'+
    qs+'<div style="display:flex;gap:8px;flex-wrap:wrap">'+
    '<button type="submit" style="min-height:44px;padding:10px;background:#1e40af;color:white;border:0;border-radius:10px">'+escape(lang.action)+'</button>'+
    '<button type="reset" style="min-height:44px;padding:10px;background:white;border:1px solid #cbd5e1;border-radius:10px">'+escape(lang.reset)+'</button></div>'+
    '<p role="status" data-iqb-motivation-result aria-live="polite"></p><small style="display:block;margin-top:9px;color:#475569">'+escape(lang.privacy)+'</small></form></details>';
}
export function bindFamilyMotivationV74(root,locale="es"){
  const form=root?.querySelector?.("[data-iqb-motivation-form]");
  if(!form)return;
  const result=form.querySelector("[data-iqb-motivation-result]");
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const inputs=Object.fromEntries([...form.querySelectorAll("select[name]")].map(el=>[el.name,el.value]));
    result.textContent=reflectionV74(inputs,locale).message;
  });
  form.addEventListener("reset",()=>{result.textContent="";});
}
