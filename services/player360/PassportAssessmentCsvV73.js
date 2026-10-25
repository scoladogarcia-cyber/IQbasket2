/**
 * @fileoverview Player Passport V73 offline CSV evaluation exchange.
 * @description Reuses the canonical 69-attribute catalog, evidence/difficulty
 * rules and the existing guided-evaluation RPC. Import ONLY populates the
 * editor for human review; it never writes to Supabase or overwrites history.
 * Values marked NE / blank remain untouched, never converted to zero.
 */
import { parseBoxScoreCsv } from "../reports/BoxScoreExchangeV53.js";

export const PASSPORT_CSV_HEADERS_V73=Object.freeze([
  "codigo","atributo","valor_1_5","dificultad_D1_D5",
  "observaciones","confianza","nota","valor_actual_solo_lectura"
]);
const safe=v=>String(v??"").trim();
const cell=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
const protect=v=>/^[=+\-@\t\r]/.test(String(v??""))?"'"+String(v):String(v??"");
const code=v=>safe(v).toUpperCase();

function attributesOf(catalog) {
  const attributes=catalog?.attributes;
  if(!Array.isArray(attributes)||attributes.length!==69)
    throw new Error("Catálogo canónico de 69 atributos no disponible.");
  const map=new Map();
  for(const attr of attributes){
    const key=code(attr?.code);
    if(!key||map.has(key))throw new Error("Catálogo con claves ausentes o duplicadas.");
    map.set(key,attr);
  }
  return map;
}

/** Template contains reference values only; score-to-change starts empty. */
export function exportPassportAssessmentCsvV73(catalog, latest=new Map()) {
  const attributes=attributesOf(catalog), rows=[PASSPORT_CSV_HEADERS_V73];
  for(const [key,attr] of attributes){
    const current=latest instanceof Map ? latest.get(key)?.score : null;
    rows.push([key,protect(attr.name||key),"","","","","",current==null?"NE":String(current)]);
  }
  return "\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n";
}

/**
 * Parsed drafts follow the current editor state shape. No rows are saved here.
 * A complete catalog is required but only edited attributes are returned.
 * The caller chooses contextual T / JR / P5 / VIDEO before import.
 */
export function previewPassportAssessmentCsvV73(text,{catalog,context="P5"}={}) {
  const attributes=attributesOf(catalog);
  const matrix=parseBoxScoreCsv(text);
  if(matrix.length!==70||matrix[0].length!==PASSPORT_CSV_HEADERS_V73.length
    ||!PASSPORT_CSV_HEADERS_V73.every((name,index)=>matrix[0][index]===name)){
    throw new Error("La plantilla debe contener exactamente los 69 atributos y las 8 columnas oficiales de IQBasket.");
  }
  const selected=new Map(),seen=new Set(),skip=[];
  const normalizedContext=code(context);
  if(!["T","JR","P5","VIDEO"].includes(normalizedContext))throw new Error("Contexto de evaluación desconocido.");
  for(let i=1;i<matrix.length;i++){
    const row=matrix[i],key=code(row?.[0]),attr=attributes.get(key),raw=safe(row?.[2]).toUpperCase();
    if(!attr||seen.has(key)||row.length!==PASSPORT_CSV_HEADERS_V73.length)
      throw new Error("Fila "+(i+1)+": atributo ajeno, duplicado o mal formado.");
    seen.add(key);
    if(!raw||raw==="NE"){skip.push(key);continue;}
    if(!/^[1-5]$/.test(raw))throw new Error("Fila "+(i+1)+": valor de competencia fuera de 1–5.");
    const difficulty=code(row[3]),countText=safe(row[4]),count=Number(countText);
    const confidence=code(row[5]||"MEDIUM"),notes=safe(row[6]);
    if(!/^D[1-5]$/.test(difficulty))throw new Error("Fila "+(i+1)+": selecciona dificultad D1–D5.");
    const minimum=Math.max(1,Number(attr.min_evidence)||1);
    if(!countText||!Number.isInteger(count)||count<minimum||count>10000)
      throw new Error("Fila "+(i+1)+": "+minimum+" observaciones verificadas como mínimo.");
    if(!["LOW","MEDIUM","HIGH"].includes(confidence))
      throw new Error("Fila "+(i+1)+": confianza no admitida.");
    if(notes.length>500)throw new Error("Fila "+(i+1)+": nota demasiado larga.");
    if(normalizedContext!=="VIDEO"&&Array.isArray(attr.valid_contexts)
      &&!attr.valid_contexts.includes(normalizedContext))
      throw new Error("Fila "+(i+1)+": contexto "+normalizedContext+" no aplicable a "+key+".");
    selected.set(key,{
      score:Number(raw),difficultyTier:difficulty,evidenceCount:count,
      confidence,notes,touched:true
    });
  }
  if(seen.size!==69)throw new Error("La plantilla no contiene todos los atributos de catálogo.");
  if(!selected.size)throw new Error("No has introducido ningún atributo nuevo; los anteriores no se reimportan.");
  return Object.freeze({drafts:selected,updated:selected.size,unchanged:skip.length,context:normalizedContext});
}
