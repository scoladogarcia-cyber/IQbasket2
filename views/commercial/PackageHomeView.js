/** Product landing page. Links reuse existing data views and access checks. */
import {PACKAGE_NAVIGATION} from "../../config/package-navigation.config.js";
import {resolvePackageNavigation} from "../../domain/commercial/PackageNavigationPolicy.js";
import {TranslationStore} from "../../services/TranslationStore.js";
import {ROUTE_PERMISSIONS} from "../../security/permissions.js";
const labels={team:"team",players:"players",games:"games",lineups:"lineups",advanced:"advanced_stats",heatmap:"heatmap_analysis",reports:"reports",training:"player360.training.nav",comparator:"comparator",ask:"ask_ai",passport:"player_passport",nutrition:"player360.nutrition.nav",family:"family_workspace","family-advisor":"family_advisor"};
const t=key=>TranslationStore.t(key);
export function renderPackageHome(container,route,auth,context={}){
 if(!container)return;
 const pkg=PACKAGE_NAVIGATION.find(p=>p.home===route);
 const access=resolvePackageNavigation({role:auth.getEffectiveRole(context)});
 if(!pkg||!access.ids.includes(pkg.id)||!auth.canPreview(ROUTE_PERMISSIONS.dashboard,context)){
 container.textContent=t("packages.unavailable");return;
 }
 const links=pkg.routes.filter(key=>labels[key]&&auth.canPreview(ROUTE_PERMISSIONS[key],context));
 container.innerHTML=`<section class="iq-package-home"><style>
 .iq-package-home{padding:clamp(12px,3vw,28px);max-width:1100px;margin:auto;color:#0f172a}
 .iq-package-home h1{font-size:clamp(22px,4vw,32px);margin:6px 0}.iq-package-home p{line-height:1.5;color:#475569}
 .iq-package-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:12px;margin-top:20px}
 .iq-package-home a{display:flex;align-items:center;min-height:60px;padding:16px;border:1px solid #cbd5e1;border-radius:12px;background:white;text-decoration:none;color:#1e3a8a;font-weight:700}
 </style><h1>${t(pkg.titleKey)}</h1><p>${t("packages."+pkg.id+".description")}</p><p>${t("packages.sharedInfo")}</p>
 <div class="iq-package-links">${links.map(key=>`<a href="#/${key}">${t(labels[key])}</a>`).join("")}</div></section>`;
}
