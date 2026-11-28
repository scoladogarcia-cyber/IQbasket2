import assert from "node:assert/strict";
import {resolvePackageNavigation,buildPackageNavigation} from "../domain/commercial/PackageNavigationPolicy.js";
import {PACKAGE_NAVIGATION} from "../config/package-navigation.config.js";
import {ROUTE_PERMISSIONS,Permission} from "../security/permissions.js";
import {TranslationStore} from "../services/TranslationStore.js";
const keys=["dashboard","team","games","lineups","advanced","heatmap","training","comparator","players","passport","nutrition","family","family-advisor","reports","ask","business","profile","privacy","feedback","settings","approvals"];
const legacy=[{titleKey:"legacy",items:keys.map(key=>({key,route:key}))}];
for(const role of ["ADMIN","SUPERADMIN"]){
 const groups=buildPackageNavigation(legacy,resolvePackageNavigation({role}));
 assert.equal(groups.filter(g=>g.packageId).length,4);
 const all=groups.flatMap(g=>g.items.map(i=>i.key));
 assert.equal(new Set(all).size,all.length);
 for(const key of keys)assert.ok(all.includes(key),key);
 assert.ok(groups.find(g=>g.titleKey==="packages.common").items.some(i=>i.key==="reports"));
}
assert.equal(buildPackageNavigation(legacy,resolvePackageNavigation({role:"ENTRENADOR"})),legacy);
const selected=resolvePackageNavigation({role:"ENTRENADOR",verifiedPackageIds:["COACHES","PLAYERS","COACHES","invalid"]});
assert.deepEqual(selected.ids,["COACHES","PLAYERS"]);
const combined=buildPackageNavigation(legacy,selected);
assert.deepEqual(combined.filter(g=>g.packageId).map(g=>g.packageId),["COACHES","PLAYERS"]);
assert.equal(combined.flatMap(g=>g.items).filter(i=>i.key==="reports").length,1);
assert.ok(combined.find(g=>g.titleKey==="packages.common").items.some(i=>i.key==="reports"));
assert.equal(buildPackageNavigation(legacy,resolvePackageNavigation({role:"ENTRENADOR",verifiedPackageIds:[]})).filter(g=>g.packageId).length,0);
for(const lang of ["es","ca","en","fr"]){await TranslationStore.setLanguage(lang);for(const p of PACKAGE_NAVIGATION){assert.equal(ROUTE_PERMISSIONS[p.home],Permission.VIEW_DASHBOARD);assert.notEqual(TranslationStore.t(p.titleKey),p.titleKey);}}
for(const [lang,label] of Object.entries({es:"Datos del equipo",ca:"Dades de l’equip",en:"Team data",fr:"Données de l’équipe"})){
 await TranslationStore.setLanguage(lang);
 assert.equal(TranslationStore.t("packages.common"),label);
}
const admin=buildPackageNavigation(legacy,resolvePackageNavigation({role:"ADMIN"}));
const data=admin.find(g=>g.titleKey==="packages.common");
assert.ok(data.items.some(i=>i.key==="team"));
for(const key of ["profile","settings","privacy","dashboard","business"])assert.ok(!data.items.some(i=>i.key===key));
console.log("PACKAGE_NAVIGATION_POLICY_OK");
