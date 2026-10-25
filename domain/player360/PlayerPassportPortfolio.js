/**
 * @fileoverview Pure, repeatable read models for the lifetime passport.
 * No inferred hours, estimated categories, synthesized skills or causal AI.
 */
const TYPES=['TEAM','TECHNIFICATION','PERSONAL','COGNITIVE','UNCLASSIFIED'];
export const TRAINING_TYPE_LABELS=Object.freeze({
  TEAM:'Equipo',TECHNIFICATION:'Tecnificación',PERSONAL:'Personal',COGNITIVE:'Cognitivo',UNCLASSIFIED:'Sin clasificar'
});
const nonNegative=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
const rows=v=>Array.isArray(v)?v:[];
export const formatBasketballMinutes=value=>{
  const minutes=Math.round(nonNegative(value));
  return Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0')+' min';
};
export function summarizeTrainingPortfolio(items=[],{asOfDate=''}={}){
  const kinds=Object.fromEntries(TYPES.map(code=>[code,{registered:0,accredited:0,pending:0,sessions:0}]));
  let totalRegistered=0,totalAccredited=0,pendingSessions=0,futureConflicts=0,unknownMinutes=0,reviewPending=0;
  const sessionIds=new Set();
  for(const record of rows(items)){
    const kind=Object.prototype.hasOwnProperty.call(kinds,record.session_kind)?record.session_kind:'UNCLASSIFIED';
    const bucket=kinds[kind];
    const id=String(record.training_session_id||'');
    const value=nonNegative(record.recorded_minutes);
    const certified=nonNegative(record.accredited_minutes);
    bucket.registered+=value;bucket.accredited+=certified;
    totalRegistered+=value;totalAccredited+=certified;
    bucket.sessions++;
    if(record.classification_review==='PENDING'||record.classification_review==='NOT_REVIEWED')reviewPending++;
    if(record.attendance_status==='PRESENT'||record.attendance_status==='PARTIAL'){
      if(record.participated_minutes==null)unknownMinutes++;
      if(record.session_status!=='COMPLETED'&&value>0){pendingSessions++;bucket.pending+=value;}
      if(asOfDate&&record.session_status!=='COMPLETED'&&record.participated_minutes!=null&&value===0&&String(record.session_date||'')>asOfDate)futureConflicts++;
    }
    if(id)sessionIds.add(id);
  }
  return {kinds,totalRegistered,totalAccredited,pendingMinutes:Math.max(0,totalRegistered-totalAccredited),
    pendingSessions,futureConflicts,unknownMinutes,reviewPending,sessions:sessionIds.size};
}
export function summarizeGamePortfolio(items=[]){
  let games=0,minutes=0,points=0,assists=0,rebounds=0,steals=0,turnovers=0,unknownMinutes=0;
  const seen=new Set();const perSeason=new Map();
  for(const x of rows(items)){
    const key=String(x.game_id||'');
    if(!key||seen.has(key))continue;
    seen.add(key);games++;
    if(x.minutes==null)unknownMinutes++;else minutes+=nonNegative(x.minutes);
    points+=nonNegative(x.points);assists+=nonNegative(x.assists);
    rebounds+=nonNegative(x.offensive_rebounds)+nonNegative(x.defensive_rebounds);
    steals+=nonNegative(x.steals);turnovers+=nonNegative(x.turnovers);
    const season=String(x.authorization_context_id||'UNKNOWN');
    const total=perSeason.get(season)||{games:0,minutes:0,points:0};
    total.games++;total.minutes+=nonNegative(x.minutes);total.points+=nonNegative(x.points);
    perSeason.set(season,total);
  }
  return {games,minutes,points,assists,rebounds,steals,turnovers,unknownMinutes,
    perSeason:[...perSeason].map(([id,value])=>({id,...value}))};
}
export function mergeAuthorizedCareer(current={},career=[]){
  const evaluations=new Map(),measurements=new Map();
  const sources=[{evaluations:current.evaluations,measurements:current.measurements},...rows(career)];
  for(const source of sources){
    for(const item of rows(source.evaluations))if(item?.id&&!evaluations.has(String(item.id)))evaluations.set(String(item.id),item);
    for(const item of rows(source.measurements))if(item?.id&&!measurements.has(String(item.id)))measurements.set(String(item.id),item);
  }
  const byNewest=(a,b)=>String(b.evaluation_date||b.measured_at||'').localeCompare(String(a.evaluation_date||a.measured_at||''));
  return {evaluations:[...evaluations.values()].sort(byNewest),
    measurements:[...measurements.values()].sort(byNewest)};
}
/** Count observed vs verified evidence without re-labeling legacy scores as validated. */
export function evidenceQuality(catalog=[],latest=new Map()){
  let rated=0,verified=0,withoutEvidence=0,belowMinimum=0;
  for(const attribute of rows(catalog)){
    const x=latest.get(String(attribute.code||'').toUpperCase());
    if(!x||x.score==null)continue;
    rated++;
    const count=nonNegative(x.evidence_count);
    if(!count)withoutEvidence++;
    const minimum=Math.max(1,Number(attribute.min_evidence)||1);
    if(count>=minimum&&String(x.context||'')&&String(x.confidence||''))verified++;
    else belowMinimum++;
  }
  return {rated,verified,withoutEvidence,belowMinimum,total:rows(catalog).length,
    evidenceCoverage:rows(catalog).length?verified/rows(catalog).length:0};
}
export function summarizeAssessmentTime(items=[]){
  const valid=rows(items).filter(x=>x.assessment_duration_minutes!=null&&Number(x.assessment_duration_minutes)>0);
  return {minutes:valid.reduce((sum,x)=>sum+nonNegative(x.assessment_duration_minutes),0),
    recordedEvaluations:valid.length,unknownEvaluations:rows(items).length-valid.length};
}
