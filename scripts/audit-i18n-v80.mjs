/**
 * @fileoverview Read-only audit for untranslated UI phrases and missing keys.
 * @description Reports candidates, not automatic edits: user names, notes and
 * basketball domain content must never be blindly translated.
 */
import {readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {BUNDLED_LANGUAGE_CATALOG_V80} from "../services/i18n/BundledLanguageCatalogV80.js";
const root=new URL("../",import.meta.url);
const folders=["views","components","features","controllers"];
const sources=[];
function scan(folder){
  for(const entry of readdirSync(new URL(folder+"/",root),{withFileTypes:true})){
    const path=join(folder,entry.name).replaceAll("\\","/");
    if(entry.isDirectory())scan(path);
    else if(entry.name.endsWith(".js"))sources.push(path);
  }
}
folders.forEach(scan);
const reference=BUNDLED_LANGUAGE_CATALOG_V80.es;
const known=new Set(Object.keys(reference));
const missing=new Map(),raw=[];
for(const path of sources){
  const source=readFileSync(new URL(path,root),"utf8");
  const keys=[...source.matchAll(/(?:this\.t|TranslationStore\.t|I18n\.t|i18n\.t)\s*\(\s*["'`]([A-Za-z_][A-Za-z0-9_.-]{1,119})["'`]/g)];
  for(const match of keys){
    if(!known.has(match[1])){
      const files=missing.get(match[1])||new Set();files.add(path);missing.set(match[1],files);
    }
  }
  const literals=[...source.matchAll(/>\s*([^<>{}\n]{8,120}[áéíóúñÁÉÍÓÚÑ¿¡][^<>{}\n]{0,80})\s*</g)];
  if(literals.length)raw.push({path,count:literals.length,examples:literals.slice(0,3).map(v=>v[1].trim())});
}
const translated=Object.fromEntries(Object.entries(BUNDLED_LANGUAGE_CATALOG_V80).map(([locale,dict])=>{
  const absent=Object.keys(reference).filter(key=>!Object.prototype.hasOwnProperty.call(dict,key));
  return [locale,{keys:Object.keys(dict).length,missingAgainstEs:absent.length}];
}));
console.log(JSON.stringify({
 filesScanned:sources.length,
 locales:translated,
 untranslatedKeyCandidates:missing.size,
 hardcodedSpanishMarkupCandidates:raw.reduce((sum,entry)=>sum+entry.count,0),
 topRawMarkupFiles:raw.sort((a,b)=>b.count-a.count).slice(0,20),
 missingKeyExamples:[...missing].slice(0,20).map(([key,paths])=>({key,files:[...paths].slice(0,2)}))
},null,2));
