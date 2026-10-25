/**
 * @fileoverview Portable, read-only evidence-coverage audit for Player Passport.
 * @description No invented zeros, no average talent score and no privileged reads.
 * Callers must authorize export of this specific player's passport beforehand.
 */
const csv=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
const protect=v=>/^[=+\-@\t\r]/.test(String(v??""))?"'"+String(v):String(v??"");
export const PASSPORT_COVERAGE_HEADERS_V74=Object.freeze(["codigo","atributo","dimension","nota","dificultad","observaciones","min_observaciones","confianza","estado"]);
export function buildPassportCoverageV74({catalog,latest=new Map()}={}){
  const attrs=catalog?.attributes;
  if(!Array.isArray(attrs)||attrs.length!==69||!(latest instanceof Map))throw new Error("Catálogo/valoraciones no disponibles para este jugador.");
  const seen=new Set(),rows=[];let assessed=0,verified=0;
  for(const attr of attrs){
    const id=String(attr.code??"").trim().toUpperCase();
    if(!id||seen.has(id))throw new Error("Catálogo duplicado o incompleto.");
    seen.add(id);
    const value=latest.get(id)||null,score=value?.score;
    const rated=Number.isInteger(score)&&score>=1&&score<=5;
    const count=Number(value?.evidence_count??value?.evidenceCount??0);
    const minimum=Math.max(1,Number(attr.min_evidence)||1);
    const tier=String(value?.difficulty_tier??value?.difficultyTier??value?.metadata?.difficulty_tier??"").toUpperCase();
    const hasEvidence=rated&&Number.isInteger(count)&&count>=minimum&&/^D[1-5]$/.test(tier);
    if(rated)assessed++;if(hasEvidence)verified++;
    rows.push(Object.freeze({code:id,name:attr.name||id,dimension:attr.dimension||"",
      score:rated?score:null,tier:rated?tier:"",count:rated&&count>=0?count:null,minimum,
      confidence:rated?String(value?.confidence||""):"",
      status:!rated?"NE":hasEvidence?"DOCUMENTADO":"PROVISIONAL"}));
  }
  return Object.freeze({total:rows.length,assessed,verified,notEvaluated:rows.length-assessed,provisional:assessed-verified,rows});
}
export function exportPassportCoverageV74(args={}){
  const summary=buildPassportCoverageV74(args);
  const records=[PASSPORT_COVERAGE_HEADERS_V74,...summary.rows.map(r=>[
    r.code,protect(r.name),protect(r.dimension),r.score??"NE",r.tier,
    r.count??"",r.minimum,protect(r.confidence),r.status
  ])];
  return "\uFEFF"+records.map(row=>row.map(csv).join(",")).join("\r\n")+"\r\n";
}
