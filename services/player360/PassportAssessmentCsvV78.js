/**
 * @fileoverview Identity-bound Player Passport CSV V78.
 * @description Preserves V73's evidence and rubric validator but prevents a
 * worksheet for one player/season being silently applied to another. Imports
 * are staging-only: the existing guided assessment RPC remains the write gate.
 */
import {parseBoxScoreCsv,} from "../reports/BoxScoreExchangeV53.js";
import {PASSPORT_CSV_HEADERS_V73,exportPassportAssessmentCsvV73,previewPassportAssessmentCsvV73} from "./PassportAssessmentCsvV73.js";

export const PASSPORT_CSV_VERSION_V78="IQB-PASSPORT-CSV-V78";
export const PASSPORT_CSV_HEADERS_V78=Object.freeze([
  "version","player_id","team_season_id",...PASSPORT_CSV_HEADERS_V73
]);
const cell=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
const matrixCsv=rows=>"\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n";
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v??"").trim());
const normalized=v=>String(v??"").trim().toLowerCase();
function requireScope(playerId,teamSeasonId){
  if(!uuid(playerId)||!uuid(teamSeasonId))throw new Error("Identidad de jugador y temporada no verificable.");
  return {playerId:normalized(playerId),teamSeasonId:normalized(teamSeasonId)};
}
function currentScore(latest,code){
  if(!(latest instanceof Map))throw new Error("Valoraciones actuales no disponibles. Recarga el pasaporte.");
  const row=latest.get(code),value=row?.score;
  return Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=5
    ?String(Number(value)):"NE";
}
export function isLegacyPassportCsvV73(csvText){
  const header=parseBoxScoreCsv(csvText)[0];
  return Array.isArray(header)&&header.length===PASSPORT_CSV_HEADERS_V73.length
    &&PASSPORT_CSV_HEADERS_V73.every((h,i)=>h===header[i]);
}
/** One player and one team-season per template. Historical notes remain read-only. */
export function exportPassportAssessmentCsvV78({catalog,latest=new Map(),playerId,teamSeasonId}={}){
  const scope=requireScope(playerId,teamSeasonId);
  const v73=parseBoxScoreCsv(exportPassportAssessmentCsvV73(catalog,latest));
  return matrixCsv([
    PASSPORT_CSV_HEADERS_V78,
    ...v73.slice(1).map(row=>[PASSPORT_CSV_VERSION_V78,scope.playerId,scope.teamSeasonId,...row])
  ]);
}
/**
 * Caller must re-read authorized passport before preview and recheck permissions
 * before save. This step checks identity, full 69-row coverage, and the
 * read-only baseline to catch stale or cross-player worksheets.
 */
export function previewPassportAssessmentCsvV78(csvText,{catalog,latest,playerId,teamSeasonId,context="P5"}={}){
  const scope=requireScope(playerId,teamSeasonId);
  const matrix=parseBoxScoreCsv(csvText);
  if(matrix.length!==70||matrix[0]?.length!==PASSPORT_CSV_HEADERS_V78.length||
    !PASSPORT_CSV_HEADERS_V78.every((h,i)=>h===matrix[0][i]))
    throw new Error("Plantilla V78 obligatoria: descarga el CSV del jugador y temporada seleccionados.");
  const legacy=[PASSPORT_CSV_HEADERS_V73];
  for(let i=1;i<matrix.length;i++){
    const row=matrix[i];
    if(!Array.isArray(row)||row.length!==PASSPORT_CSV_HEADERS_V78.length||
      row[0]!==PASSPORT_CSV_VERSION_V78||
      normalized(row[1])!==scope.playerId||
      normalized(row[2])!==scope.teamSeasonId)
      throw new Error("Fila "+(i+1)+": plantilla de otro jugador, temporada o versión.");
    const key=String(row[3]??"").trim().toUpperCase();
    if(String(row[10]??"").trim()!==currentScore(latest,key))
      throw new Error("Fila "+(i+1)+": la evaluación de referencia ha cambiado. Descarga una plantilla nueva.");
    legacy.push(row.slice(3));
  }
  const preview=previewPassportAssessmentCsvV73(matrixCsv(legacy),{catalog,context});
  return Object.freeze({...preview,playerId:scope.playerId,teamSeasonId:scope.teamSeasonId,templateVersion:PASSPORT_CSV_VERSION_V78});
}
