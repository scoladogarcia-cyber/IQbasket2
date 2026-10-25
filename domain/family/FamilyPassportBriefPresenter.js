/**
 * @fileoverview Pure family-passport presentation rules.
 * No permissions, queries or scoring calculations in this layer.
 * Null/unavailable information is not converted into a false zero.
 */
export function formatFamilyMinutes(raw){
  if(raw===null || raw===undefined || !Number.isFinite(Number(raw)) || Number(raw)<0) return 'No disponible';
  const n=Math.round(Number(raw));
  return `${Math.floor(n/60)} h ${String(n%60).padStart(2,'0')} min`;
}
export function presentFamilyPassportBrief(payload={},familyPassport={}){
  if(!payload || !payload.player_id) return {available:false,message:'No se pudo consultar este pasaporte.'};
  const hasTraining=payload.training_access===true&&payload.training;
  const t=hasTraining?payload.training:null;
  const gamesAllowed=familyPassport?.section_access?.basic_stats===true;
  const g=gamesAllowed?familyPassport.career_totals:null;
  const qualityAllowed=payload.evaluation_access===true&&payload.evaluation_quality;
  const q=qualityAllowed?payload.evaluation_quality:null;
  return {
    available:true,
    category:payload.category||null,team:payload.team_name||null,season:payload.season_name||null,
    training:{
      available:Boolean(t),recorded: t?formatFamilyMinutes(t.recorded_minutes):null,
      accredited:t?formatFamilyMinutes(t.accredited_minutes):null,
      pending:t?formatFamilyMinutes(t.pending_minutes):null,
      sessions:t?.sessions??null,unvalidatedSessions:t?.pending_sessions??null,
      classificationToReview:t?.classification_to_review??null,
      unknownMinutes:t?.without_minutes??null
    },
    competition:{
      available:Boolean(g),games:g?.games??null,
      minutes:g?.minutes===null||g?.minutes===undefined?null:g.minutes,
      isTotalNotBenchmark:true
    },
    evaluation:{
      available:Boolean(q),rated:q?.attributes_rated??null,
      documented:q?.with_documented_observations??null,
      needsEvidence:q?.pending_documentation??null,
      legacyAttributes:q?.legacy_attributes??0,
      legacyScoreRecords:q?.legacy_score_records??0,
      notScientificallyValidated:true
    }
  };
}
