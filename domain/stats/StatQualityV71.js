/**
 * @fileoverview Read-only quality gate for already-persisted official basketball boxscores.
 * @description Reuses BoxScoreCalculator (one authoritative basket formula).
 * Flags missing vs observed zero, partial minutes, inconsistent shooting / points.
 * Does not backfill, rewrite legacy data or fabricate values to make a chart.
 */
import { BoxScoreCalculator } from "./BoxScoreCalculator.js";

export const STATS_FORMULA_VERSION="IQBASKET_BASKETBALL_V1";
export const hasRecordedValue=value=>value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value));
export const recordedNumber=value=>hasRecordedValue(value)?Number(value):null;
export function observedRate(made,attempted){
  const m=recordedNumber(made),a=recordedNumber(attempted);
  if(m===null||a===null||a<=0||m<0||m>a)return null;
  return Math.round(m/a*1000)/10;
}
export function displayObserved(value,{digits=1,suffix=""}={}){
  const n=recordedNumber(value);
  if(n===null)return "N/D";
  return n.toLocaleString("es-ES",{maximumFractionDigits:digits})+suffix;
}
const source=(row,...keys)=>{
  for(const key of keys)if(Object.hasOwn(row||{},key)&&row[key]!==null&&row[key]!==undefined)return recordedNumber(row[key]);
  return null;
};
export function inspectBoxScoreRows(rows=[],game=null) {
  if(!Array.isArray(rows)) throw new TypeError("Se espera un acta de jugadores.");
  const issues=[],missingMinutes=[],missingMetrics=[],unreliablePoints=[];
  const ids=new Set();
  let confirmedPoints=0,completePoints=true,knownZeroPoints=0;
  rows.forEach((row,index)=>{
    const label="Fila "+(index+1),id=String(row?.player_id??row?.playerId??"").trim();
    if(!id||ids.has(id))issues.push(label+": jugador sin identificador único.");
    ids.add(id);
    const min=source(row,"minutes"),points=source(row,"points","pts");
    if(min===null)missingMinutes.push(id||label);
    if(points===0)knownZeroPoints++;
    if(points===null)completePoints=false;
    else confirmedPoints+=points;
    const shotFields=[
      source(row,"fg2_made","fg2Made"),source(row,"fg2_attempted","fg2Attempted"),
      source(row,"fg3_made","fg3Made"),source(row,"fg3_attempted","fg3Attempted"),
      source(row,"ft_made","ftMade"),source(row,"ft_attempted","ftAttempted")
    ];
    if(shotFields.some(value=>value===null)) {missingMetrics.push(id||label);return;}
    const [two,twoAtt,three,threeAtt,free,freeAtt]=shotFields;
    if([two,twoAtt,three,threeAtt,free,freeAtt].some(n=>n<0)||two>twoAtt||three>threeAtt||free>freeAtt)
      issues.push(label+": aciertos/intentos inconsistentes.");
    const expected=BoxScoreCalculator.calculatePoints(two,three,free);
    if(points!==null&&points!==expected)unreliablePoints.push({id:id||label,recorded:points,shotDerived:expected});
  });
  const score=source(game||{},"team_score","teamScore");
  if(score!==null&&completePoints&&confirmedPoints!==score)
    issues.push("La suma de puntos de los jugadores ("+confirmedPoints+") no coincide con el marcador ("+score+").");
  return Object.freeze({
    formulaVersion:STATS_FORMULA_VERSION,rows:rows.length,
    knownZeroPoints,missingMinutes,missingMetrics,unreliablePoints,issues,
    confirmedPoints:completePoints?confirmedPoints:null,
    comparable:Boolean(!issues.length&&!missingMetrics.length&&!unreliablePoints.length&&completePoints)
  });
}
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function renderStatsQualityInfo({rows=[],game=null}={}) {
  const q=inspectBoxScoreRows(rows,game);
  const warnings=[
    ...q.issues,
    ...(q.missingMinutes.length?[q.missingMinutes.length+" jugador(es) sin minutos registrados: N/D, no cero."]:[]),
    ...(q.missingMetrics.length?[q.missingMetrics.length+" jugador(es) con datos de tiro parciales."]:[]),
    ...(q.unreliablePoints.length?[q.unreliablePoints.length+" fila(s) con puntos distintos a los tiros registrados."]:[])
  ];
  const list=warnings.map(w=>"<li>"+escapeHtml(w)+"</li>").join("");
  return '<details class="iq-report-quality" style="border:1px solid #cbd5e1;padding:12px;border-radius:12px;background:#f8fafc;margin:12px 0"'+
    (warnings.length?' open':'')+'><summary style="font-weight:850;cursor:pointer;min-height:34px">Calidad de datos · '+
    (warnings.length?warnings.length+" advertencia(s)":"datos coherentes en las comprobaciones disponibles")+
    '</summary><p style="font-size:12px">0 = valor realmente registrado; N/D = valor ausente o no calculable. Un porcentaje sin intentos no es 0 %.</p>'+
    (list?'<ul style="font-size:12px">'+list+'</ul>':'')+
    '<p style="font-size:11px">Versión de cálculo: '+escapeHtml(q.formulaVersion)+'. Se comprueban las estadísticas persistidas, sin modificar el histórico.</p></details>';
}
