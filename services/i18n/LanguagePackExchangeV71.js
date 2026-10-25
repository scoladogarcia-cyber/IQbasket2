/**
 * @fileoverview Portable translation packs CSV v71 for the four bundled locales.
 * @description Offline bulk editing without treating the DB as the source of every UI phrase.
 * Bundled locales/es|ca|en|fr.js remain the versioned defaults; translations table stores
 * optional tenant overrides. CSV import requires an authorized user and explicit save.
 */
import { parseBoxScoreCsv } from "../reports/BoxScoreExchangeV53.js";
import { I18N_CONFIG } from "../../config/i18n.config.js";

export const LANGUAGE_CSV_HEADERS=Object.freeze(["key","translation"]);
const locales=new Set(I18N_CONFIG.supportedLocales.map(l=>l.code));
export function supportedLocale(code){
  const lang=String(code??"").trim().toLowerCase();
  const normalized=I18N_CONFIG.localeAliases[lang]||lang;
  if(!locales.has(normalized))throw new Error("Idioma no soportado.");
  return normalized;
}
function csv(value){return '"'+String(value??"").replace(/"/g,'""')+'"';}
function cell(v) {
  const s=String(v??"");
  // Prevent spreadsheet formula execution on exported human-readable text.
  return /^[=+\-@\t\r]/.test(s)?"'"+s:s;
}
export function serializeLanguagePackCsv(dictionary={},locale="es") {
  supportedLocale(locale);
  const entries=Object.entries(dictionary)
    .filter(([key,value])=>/^[A-Za-z_][A-Za-z0-9_.-]{0,119}$/.test(key) && typeof value==="string")
    .sort(([a],[b])=>a.localeCompare(b));
  return "\uFEFF"+[LANGUAGE_CSV_HEADERS.map(csv).join(","),
    ...entries.map(([key,value])=>[csv(key),csv(cell(value))].join(","))].join("\r\n")+"\r\n";
}
/**
 * Preserve parameter placeholders so locale imports cannot silently corrupt UI
 * interpolation (e.g. {player}, {team}). Only validate keys having a reference.
 */
export function languagePlaceholdersV75(value) {
  return [...new Set([...String(value??"").matchAll(/\{([A-Za-z_][A-Za-z0-9_.-]{0,80})\}/g)]
    .map(match=>match[1]))].sort();
}
export function parseLanguagePackCsv(csvText,{existingKeys=null,maxRows=3500,referenceDictionary=null}={}) {
  const matrix=parseBoxScoreCsv(csvText);
  if(!Array.isArray(matrix)||matrix.length<2||matrix.length>maxRows+1)throw new Error("El CSV de idiomas debe incluir entre 1 y "+maxRows+" traducciones.");
  if(matrix[0].length!==2||!LANGUAGE_CSV_HEADERS.every((key,i)=>matrix[0][i]===key))throw new Error("Usa la plantilla con columnas key,translation.");
  const permitted=existingKeys instanceof Set?existingKeys:null, seen=new Set(), entries={};
  for(let i=1;i<matrix.length;i++){
    const row=matrix[i],key=String(row?.[0]??"").trim(),value=String(row?.[1]??"").trim();
    if(row.length!==2||!/^[A-Za-z_][A-Za-z0-9_.-]{0,119}$/.test(key)||seen.has(key) || value.length>3000)
      throw new Error("Fila "+(i+1)+": clave inválida, duplicada o texto demasiado largo.");
    if(permitted&&!permitted.has(key))throw new Error("Fila "+(i+1)+": clave desconocida. Actualiza antes el catálogo versionado.");
    if(value && referenceDictionary && Object.prototype.hasOwnProperty.call(referenceDictionary,key)){
      const expected=languagePlaceholdersV75(referenceDictionary[key]),received=languagePlaceholdersV75(value);
      if(JSON.stringify(expected)!==JSON.stringify(received))
        throw new Error("Fila "+(i+1)+": marcadores incompatibles con "+key+
          ". Deben conservarse exactamente: "+(expected.join(", ")||"(ninguno)")+".");
    }
    seen.add(key);
    if(value) entries[key]=value;
  }
  return entries;
}
