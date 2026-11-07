/**
 * @fileoverview Single, version-controlled source for the four UI locales.
 * @description CSS remains presentation-only. Nested locale keys are flattened
 * once; explicit flat keys take precedence. No network, browser storage, or DB.
 */
import {es} from "../../locales/es.js";
import {ca} from "../../locales/ca.js";
import {en} from "../../locales/en.js";
import {fr} from "../../locales/fr.js";
import {trainingHistoryV80} from "../../locales/trainingHistoryV80.js";
import {I18N_CONFIG} from "../../config/i18n.config.js";

const SUPPORTED = new Set(I18N_CONFIG.supportedLocales.map(item=>item.code));
/** @param {string} value */
export function normalizeBundledLocaleV80(value) {
  const code = String(value||"").trim().toLowerCase().split(/[-_]/)[0];
  const canonical = I18N_CONFIG.localeAliases[code] || code;
  return SUPPORTED.has(canonical)?canonical:I18N_CONFIG.defaultLocale;
}

/** Flatten nested and already-flat keys into a single namespace. */
export function flattenLanguageDictionaryV80(source) {
  const output = Object.create(null);
  const visit=(obj,prefix="")=>{
    for (const [key,value] of Object.entries(obj||{})) {
      const name=prefix?prefix+"."+key:key;
      if(value&&typeof value==="object"&&!Array.isArray(value)) visit(value,name);
      else if(typeof value==="string") output[name]=value;
    }
  };
  visit(source);
  return output;
}
const originals={es,ca,en,fr};
export const BUNDLED_LANGUAGE_CATALOG_V80=Object.freeze(
  Object.fromEntries(Object.entries(originals).map(([locale,words])=>
    [locale,Object.freeze({...flattenLanguageDictionaryV80(words),...trainingHistoryV80[locale]})]))
);
export function bundledLanguageDictionaryV80(locale){
  return BUNDLED_LANGUAGE_CATALOG_V80[normalizeBundledLocaleV80(locale)];
}
/** Single interpolation grammar; never evaluate replacement content as markup. */
export function interpolateLanguageV80(value,params={}){
  if(!params||typeof params!=="object")return String(value);
  return String(value).replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}|\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g,(match,a,b)=>{
    const key=a||b;
    return Object.prototype.hasOwnProperty.call(params,key)?String(params[key]??""):match;
  });
}
