/**
 * @fileoverview Explainable guided summaries V72 for families and coaching staff.
 * @description Deterministic and offline-capable, NOT generative AI.
 * Input MUST be an already-authorized snapshot. Never makes database calls,
 * fetches wellness or assigns talent, injury risk, motivation or diagnoses.
 */
import {inspectBoxScoreRows,observedRate,displayObserved,hasRecordedValue} from "../stats/StatQualityV71.js";

const arr=v=>Array.isArray(v)?v:[];
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function number(row,...keys) {
  for(const key of keys){
    if(hasRecordedValue(row?.[key])) return Number(row[key]);
  }
  return null;
}
const rounded=v=>Math.round(v*10)/10;

/**
 * Family language must reference known goals only; performance fluctuations
 * and a family's private context are not evidence of cause.
 */
export function guideFamilyV72({home={},hasVerifiedObjective=false}={}) {
  const objective=String(home?.objective||"").trim();
  const next=String(home?.next||"").trim();
  return Object.freeze({
    title:"Acompañar sin presionar",
    evidence: String(home?.evolution||"No hay información suficiente para evaluar la evolución."),
    nextAction:hasVerifiedObjective && next ? next : "Pregunta al jugador qué ha disfrutado y al entrenador qué objetivo conviene trabajar.",
    conversation:"¿Qué has aprendido o disfrutado esta semana, independientemente del resultado?",
    limits:"Descripción orientativa basada en datos autorizados. No clasifica el talento ni evalúa el bienestar psicológico."
  });
}

/** Aggregate persisted boxscore only, with an explicit minimum denominator. */
export function guideCoachV72(reports=[]) {
  if(!arr(reports).length)return Object.freeze({ready:false,reason:"No hay partidos seleccionados."});
  const teamIds=new Set(reports.map(r=>String(r?.game?.team_id??"")));
  if(teamIds.has("")||teamIds.size!==1)throw new Error("No se pueden fusionar equipos o contextos diferentes.");
  const gameIds=new Set();
  let fg2made=0,fg2attempted=0,fg3made=0,fg3attempted=0,pts=0,knownScores=0;
  let enoughShotCoverage=true, partialActas=0,unknownMinutes=0,negativePoints=0;
  for(const report of reports){
    const id=String(report?.game?.id??"");
    if(!id||gameIds.has(id)||!Array.isArray(report?.stats)||!report.stats.length){
      throw new Error("Informe de partido ausente, vacío o duplicado.");
    }
    gameIds.add(id);
    const quality=inspectBoxScoreRows(report.stats,report.game);
    if(!quality.comparable)partialActas++;
    unknownMinutes+=quality.missingMinutes.length;
    for(const row of report.stats){
      const points=number(row,"points","pts"),m2=number(row,"fg2_made","fg2Made"),a2=number(row,"fg2_attempted","fg2Attempted"),
        m3=number(row,"fg3_made","fg3Made"),a3=number(row,"fg3_attempted","fg3Attempted");
      if([m2,a2,m3,a3].some(v=>v===null))enoughShotCoverage=false;
      else {fg2made+=m2;fg2attempted+=a2;fg3made+=m3;fg3attempted+=a3;}
      if(points!==null&&points<0)negativePoints++;
    }
    if(quality.confirmedPoints!==null){pts+=quality.confirmedPoints;knownScores++;}
  }
  const shootingKnown=enoughShotCoverage&&partialActas===0&&negativePoints===0;
  const percent2=shootingKnown?observedRate(fg2made,fg2attempted):null;
  const percent3=shootingKnown?observedRate(fg3made,fg3attempted):null;
  const mean=knownScores===reports.length?rounded(pts/reports.length):null;
  const observations=[];
  observations.push(reports.length+" partido(s) autorizados consultados.");
  if(mean!==null)observations.push("Anotación media observada: "+displayObserved(mean)+" puntos por partido.");
  if(percent2!==null)observations.push("T2: "+displayObserved(percent2,{suffix:" %"})+" sobre "+fg2attempted+" intentos registrados.");
  if(percent3!==null)observations.push("T3: "+displayObserved(percent3,{suffix:" %"})+" sobre "+fg3attempted+" intentos registrados.");
  if(partialActas)observations.push(partialActas+" acta(s) incompletas o con discrepancias. Revisar antes de comparar.");
  if(unknownMinutes)observations.push(unknownMinutes+" registro(s) sin minutos; no se han convertido en cero.");
  return Object.freeze({
    ready:true,gameCount:reports.length,observations,
    coachingQuestions:[
      "¿Qué cambios de rol, rivales o contexto explican mejor estas cifras?",
      "¿Existe evidencia de entrenamientos vinculada a los objetivos antes de proponer un cambio?"
    ],
    limits:"Resumen descriptivo de estadísticas persistidas; no determina causas, potencial del jugador ni indica tratamiento o carga física.",
    formulaVersion:"IQBASKET_BASKETBALL_V1"
  });
}
export function renderGuidedCoachV72(model={}) {
  if(!model?.ready)return "";
  const list=arr(model.observations).map(x=>"<li>"+escapeHtml(x)+"</li>").join("");
  const questions=arr(model.coachingQuestions).map(x=>"<li>"+escapeHtml(x)+"</li>").join("");
  return '<section class="iq-report-panel" aria-label="Lectura orientada al entrenador">'+
    '<h2>Lectura guiada para entrenadores</h2><p><strong>Hechos observables</strong> (sin IA generativa)</p>'+
    '<ul>'+list+'</ul><h3>Preguntas para el siguiente entrenamiento</h3><ol>'+questions+'</ol>'+
    '<p class="iq-report-note">'+escapeHtml(model.limits||"")+'</p></section>';
}
export function renderGuidedFamilyV72(model={}) {
  return '<aside class="fh70-card" aria-label="Guía familiar de acompañamiento">'+
    '<p class="fh70-kicker">Guía familiar · interpretación explicable</p>'+
    '<h3>'+escapeHtml(model.title||"Acompañar")+'</h3>'+
    '<p>'+escapeHtml(model.evidence||"")+'</p>'+
    '<p><strong>Una pequeña acción:</strong> '+escapeHtml(model.nextAction||"")+'</p>'+
    '<p><strong>Para conversar:</strong> '+escapeHtml(model.conversation||"")+'</p>'+
    '<p class="fh70-muted">'+escapeHtml(model.limits||"")+'</p></aside>';
}
