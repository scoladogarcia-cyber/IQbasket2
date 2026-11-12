/**
 * @fileoverview Read-only inventory of locale parity, unresolved frontend keys,
 * hardcoded Spanish UI candidates and mobile text overflow risks.
 * @description Reports evidence with file/line; never rewrites application data.
 * Examples: node scripts/audit-i18n-v89.mjs [--json] [--strict-core]
 */
import {readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {BUNDLED_LANGUAGE_CATALOG_V80} from "../services/i18n/BundledLanguageCatalogV80.js";
import {TranslationStore} from "../services/TranslationStore.js";
import {trainingIntelligenceV85} from "../locales/trainingIntelligenceV85.js";
import {SEASON_DASHBOARD_V86} from "../locales/seasonDashboardV86.js";
import {CORE_STATS_V87} from "../locales/coreStatsV87.js";

const BASE=fileURLToPath(new URL("../",import.meta.url));
const LANGUAGES=Object.freeze(["es","ca","en","fr"]);
const isTextFile=path=>/\.(?:js|css|html)$/.test(path);
const roots=["views","components","features","controllers","core-modules","styles"];
const sources=["index.js","index.html"];
function collect(dir){
  for(const item of readdirSync(join(BASE,dir),{withFileTypes:true})){
    const path=join(dir,item.name).replaceAll("\\","/");
    if(item.isDirectory())collect(path);
    else if(isTextFile(path))sources.push(path);
  }
}
roots.forEach(collect);
const dictionaries=Object.fromEntries(LANGUAGES.map(lang=>[lang,{
  ...TranslationStore.defaultDictionary[lang],
  ...BUNDLED_LANGUAGE_CATALOG_V80[lang],
  ...trainingIntelligenceV85[lang],
  ...Object.fromEntries(Object.entries(SEASON_DASHBOARD_V86[lang]).map(([key,value])=>["dashboard.v86."+key,value])),
  ...CORE_STATS_V87[lang]
}]));
const reference=dictionaries.es;
const baseline=Object.keys(reference).sort();
const keySet=new Set(baseline);
const missing=Object.fromEntries(LANGUAGES.map(lang=>[lang,baseline.filter(key=>
  typeof dictionaries[lang][key]!=="string" || !dictionaries[lang][key].trim()
)]));
const tokens=value=>[...String(value||"").matchAll(/\{\{\s*([\w.-]+)\s*\}\}|\{([A-Za-z_][\w.-]*)\}/g)]
 .map(match=>match[1]||match[2]).sort();
const placeholders=[];
for(const lang of LANGUAGES.filter(lang=>lang!=="es")){
  for(const key of baseline){
    const translation=dictionaries[lang][key];
    if(typeof translation!=="string")continue;
    const a=tokens(reference[key]),b=tokens(translation);
    if(JSON.stringify(a)!==JSON.stringify(b))placeholders.push({lang,key,base:a,target:b});
  }
}
const uiKeys=new Map(),rawMarkup=[],rawAttrs=[],cssRisks=[],sameAsSpanish=[];
const uiKeysPattern=/\b(?:this\.t|LayoutView\.t|TranslationStore\.t|I18n\.t|i18n\.t)\s*\(\s*["'`]([A-Za-z_][A-Za-z0-9_.-]{1,119})["'`]/g;
const markup=/<(?:span|label|button|h[1-6]|p|th|td|option|small|strong|summary|legend|a|div)\b[^>]*>\s*([^<>{}\n]{3,170})\s*</g;
const attr=/(?:placeholder|aria-label|title)=["']([^"'<>\n]{4,140})["']/g;
const spanishHint=/[áéíóúñ¿¡]|\b(?:partidos?|jugadores?|equipos?|guardar|cancelar|estadísticas?|entrenamientos?|volver|seleccionar|resultados?|avisos?|períodos?|clasificar|asistencia|temporadas?|filtros?|eliminar|datos|verificación|edición)\b/i;
const lineOf=(source,index)=>source.slice(0,index).split("\n").length;
for(const path of sources){
  const source=readFileSync(join(BASE,path),"utf8");
  if(path.endsWith(".css")){
    for(const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
      if(!/mobile-label|nav-text|lang-select|mobile-select/.test(match[1]))continue;
      if(/white-space\s*:\s*nowrap/i.test(match[2]))cssRisks.push({path,line:lineOf(source,match.index),selector:match[1].trim().slice(-100),reason:"nowrap blocks long translations"});
    }
    continue;
  }
  for(const match of source.matchAll(uiKeysPattern)){
    const key=match[1],item=uiKeys.get(key)||new Set();
    item.add(path);uiKeys.set(key,item);
  }
  for(const match of source.matchAll(markup)){
    const value=match[1].trim();
    if(!spanishHint.test(value))continue;
    rawMarkup.push({path,line:lineOf(source,match.index),text:value.slice(0,100)});
  }
  for(const match of source.matchAll(attr)){
    const value=match[1].trim();
    if(!spanishHint.test(value))continue;
    rawAttrs.push({path,line:lineOf(source,match.index),text:value.slice(0,100)});
  }
}
const unresolved=[...uiKeys].filter(([key])=>!keySet.has(key))
 .map(([key,files])=>({key,files:[...files]})).sort((a,b)=>b.files.length-a.files.length||a.key.localeCompare(b.key));
for(const lang of LANGUAGES.filter(lang=>lang!=="es")){
  for(const key of baseline){
    const value=dictionaries[lang][key];
    if(typeof value!=="string")continue;
    if(reference[key]===value && value.length>=14 && /[áéíóúñ]|\b(?:partido|jugador|entrenamiento|estadísticas)\b/i.test(value)){
      sameAsSpanish.push({lang,key,text:value.slice(0,100)});
    }
  }
}
const perView=new Map();
for(const item of [...rawMarkup,...rawAttrs]){
  const score=perView.get(item.path)||{path:item.path,markup:0,attributes:0};
  if(rawMarkup.includes(item))score.markup++;else score.attributes++;
  perView.set(item.path,score);
}
const filesBySeverity=[...perView.values()].sort((a,b)=>b.markup+b.attributes-a.markup-a.attributes);
const report={
  scanned:{files:sources.length,js:sources.filter(p=>p.endsWith(".js")).length,css:sources.filter(p=>p.endsWith(".css")).length},
  dictionary:{totalBaseKeys:baseline.length,keysPerLanguage:Object.fromEntries(LANGUAGES.map(lang=>[lang,Object.keys(dictionaries[lang]).length])),
    missingAgainstSpanish:Object.fromEntries(LANGUAGES.map(lang=>[lang,missing[lang].length])),
    missingExamples:Object.fromEntries(LANGUAGES.map(lang=>[lang,missing[lang].slice(0,20)])),
    placeholderMismatchCount:placeholders.length,placeholderMismatches:placeholders.slice(0,30),
    untranslatedIdenticalCandidates:sameAsSpanish.length,identicalExamples:sameAsSpanish.slice(0,15)},
  frontend:{uniqueStaticTranslationCalls:uiKeys.size,unresolvedKeyCandidates:unresolved.length,
    unresolvedExamples:unresolved.slice(0,45),hardcodedMarkupCandidates:rawMarkup.length,
    hardcodedAttributeCandidates:rawAttrs.length,topFiles:filesBySeverity.slice(0,40),
    markupExamples:rawMarkup.slice(0,30),attributeExamples:rawAttrs.slice(0,20)},
  css:{localeDependentStyleSheets:0,sharedStyles:true,nowrapRisks:cssRisks}
};
if(process.argv.includes("--json"))console.log(JSON.stringify(report,null,2));
else {
  console.log("IQBasket V89 read-only internationalization audit");
  console.log(JSON.stringify({...report,dictionary:{...report.dictionary,placeholderMismatches:placeholders.slice(0,8)},
    frontend:{...report.frontend,unresolvedExamples:unresolved.slice(0,15),topFiles:filesBySeverity.slice(0,25),
      markupExamples:rawMarkup.slice(0,8),attributeExamples:rawAttrs.slice(0,8)}},null,2));
}
if(process.argv.includes("--strict-core")){
  // Only product-owned V85-V87 catalogs and the centralized locale service are
  // hard-gated. Legacy UI gaps are reported until the modules are migrated.
  const core=Object.fromEntries(LANGUAGES.map(lang=>[lang,{
    ...trainingIntelligenceV85[lang],...SEASON_DASHBOARD_V86[lang],...CORE_STATS_V87[lang]
  }]));
  const keys=Object.keys(core.es).sort();
  for(const lang of LANGUAGES){
    if(JSON.stringify(Object.keys(core[lang]).sort())!==JSON.stringify(keys))
      throw Error("Product locale pack mismatch: "+lang);
  }
  if(placeholders.some(x=>Object.prototype.hasOwnProperty.call(core.es,x.key)))
    throw Error("Product locale interpolation mismatch");
}
