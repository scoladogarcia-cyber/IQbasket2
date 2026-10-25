/**
 * @fileoverview Four-locale dictionary audit, preserving raw missing-key evidence.
 * @description Do not use effective/fallback dictionaries for this report.
 */
import {serializeLanguagePackCsv,supportedLocale} from "./LanguagePackExchangeV71.js";
const keyPattern=/^[A-Za-z_][A-Za-z0-9_.-]{0,119}$/;
export function localeCoverageV74({source={},target={},locale="ca"}={}){
  const language=supportedLocale(locale);
  const sourceKeys=Object.keys(source).filter(key=>keyPattern.test(key)).sort();
  const missing=sourceKeys.filter(key=>typeof target[key]!=="string"||!target[key].trim());
  const extra=Object.keys(target).filter(key=>keyPattern.test(key)&&!Object.prototype.hasOwnProperty.call(source,key)).sort();
  return Object.freeze({locale:language,total:sourceKeys.length,translated:sourceKeys.length-missing.length,
    missing:Object.freeze(missing),extra:Object.freeze(extra),
    coveragePct:sourceKeys.length?Math.round(10000*(sourceKeys.length-missing.length)/sourceKeys.length)/100:100});
}
export function missingLanguageTemplateV74({source,target,locale}={}){
  const report=localeCoverageV74({source,target,locale});
  const pending=Object.fromEntries(report.missing.map(key=>[key,""]));
  // Empty target cells are intentionally preserved; translators fill them.
  return serializeLanguagePackCsv(pending,report.locale);
}
