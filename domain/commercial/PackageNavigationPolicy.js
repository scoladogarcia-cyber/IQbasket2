/** Presentation policy only. RBAC/ABAC and backend remain authoritative. */
import {PACKAGE_NAVIGATION,COMMON_NAV_KEYS} from "../../config/package-navigation.config.js";
const known=new Set(PACKAGE_NAVIGATION.map(p=>p.id));
export function resolvePackageNavigation({role,verifiedPackageIds=null}={}){
 if(["ADMIN","SUPERADMIN"].includes(role))return {mode:"ADMIN",ids:[...known]};
 // Future trusted, subject-scoped server snapshot. No role/plan-label/localStorage inference.
 if(!Array.isArray(verifiedPackageIds))return {mode:"LEGACY",ids:[]};
 return {mode:"LICENSED",ids:[...new Set(verifiedPackageIds.filter(id=>known.has(id)))]};
}
export function buildPackageNavigation(groups,access){
 if(access.mode==="LEGACY")return groups;
 const available=new Map(groups.flatMap(g=>g.items).map(i=>[i.key,i]));
 const selected=PACKAGE_NAVIGATION.filter(p=>access.ids.includes(p.id));
 const counts=new Map();
 for(const p of selected)for(const key of p.routes)counts.set(key,(counts.get(key)||0)+1);
 const used=new Set();
 const take=key=>{if(used.has(key)||!available.has(key))return [];used.add(key);return [available.get(key)];};
 const shared=[...available.keys()].filter(key=>counts.get(key)>1);
 const general={titleKey:"navigation.groups.general",defaultTitle:"General",items:["dashboard","approvals","business"].flatMap(take)};
 const account={titleKey:"navigation.groups.account",defaultTitle:"Account",items:COMMON_NAV_KEYS.flatMap(take)};
 const common={titleKey:"packages.common",defaultTitle:"Team data",items:[...new Set([...shared,...(selected.some(p=>p.id==="TEAMS")?["team"]:[])])].flatMap(take)};
 const modules=selected.map(p=>({packageId:p.id,titleKey:p.titleKey,defaultTitle:p.id,items:[
 {key:p.home,route:p.home,labelKey:"packages.home",fallback:"Overview",svg:'<rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M3 10h18M10 10v11"></path>'},
 ...p.routes.flatMap(take)]}));
 // In the admin rollout retain all prior actions; no route or permission is removed.
 if(access.mode==="ADMIN")for(const key of available.keys())common.items.push(...take(key));
 return [general,common,...modules,account].filter(g=>g.items.length);
}
