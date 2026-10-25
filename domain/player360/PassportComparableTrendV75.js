/**
 * @fileoverview Player Passport changes across comparable documented evaluations.
 * @description Compares ordinal values only when rubric, difficulty, task context,
 * date and minimal observation counts match. No growth, talent or causal claims.
 */
const str=value=>String(value??"").trim().toUpperCase();
const score=value=>Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=5;
const date=value=>/^\d{4}-\d{2}-\d{2}/.test(String(value??""))?String(value).slice(0,10):"";
const csv=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
const protect=value=>/^[=+\-@\t\r]/.test(String(value??""))?"'"+String(value):String(value??"");
export const PASSPORT_TREND_HEADERS_V75=Object.freeze([
  "codigo","atributo","estado","fecha_anterior","fecha_actual","contexto",
  "dificultad","rubrica","valor_anterior","valor_actual","variacion_ordinal","observaciones_actuales"
]);
function observed(evalRow,item,attr){
  const sm=item.metadata||{},em=evalRow.metadata||{};
  const n=Number(item.evidence_count??sm.evidence_count??0);
  const row={
    value:Number(item.score),date:date(evalRow.evaluation_date),
    context:str(item.evaluation_context??sm.evaluation_context??em.evaluation_context??evalRow.context),
    tier:str(item.difficulty_tier??sm.difficulty_tier),rubric:str(item.rubric_version??sm.rubric_version),
    evidence:n
  };
  row.documented=score(row.value)&&Boolean(row.date)&&
    ["T","JR","P5","VIDEO"].includes(row.context)&&/^D[1-5]$/.test(row.tier)&&
    Boolean(row.rubric)&&Number.isInteger(n)&&n>=Math.max(1,Number(attr.min_evidence)||1);
  return row;
}
export function buildPassportComparableTrendV75({catalog,evaluations=[]}={}){
  if(!Array.isArray(catalog?.attributes)||catalog.attributes.length!==69||!Array.isArray(evaluations))
    throw new Error("Catálogo de 69 atributos o evaluaciones no disponibles.");
  const attrs=new Map();
  for(const a of catalog.attributes){
    const code=str(a.code);
    if(!code||attrs.has(code))throw new Error("Catálogo inválido: claves duplicadas.");
    attrs.set(code,a);
  }
  const history=new Map([...attrs.keys()].map(id=>[id,[]]));
  for(const entry of evaluations)for(const item of Array.isArray(entry?.scores)?entry.scores:[]){
    const key=str(item?.metric_code);
    if(attrs.has(key)&&score(item.score))history.get(key).push(observed(entry,item,attrs.get(key)));
  }
  let comparable=0,provisional=0;
  const rows=[...attrs].map(([key,attr])=>{
    const items=history.get(key).filter(x=>x.date).sort((a,b)=>b.date.localeCompare(a.date));
    const latest=items[0],prior=latest?.documented?items.find(x=>x.date<latest.date&&x.documented&&
      x.context===latest.context&&x.tier===latest.tier&&x.rubric===latest.rubric):null;
    const status=!latest?"NE":!latest.documented?"PROVISIONAL":prior?"COMPARABLE":"SIN_BASE_EQUIVALENTE";
    if(prior)comparable++;if(status==="PROVISIONAL")provisional++;
    return Object.freeze({code:key,name:attr.name||key,status,
      previousDate:prior?.date||"",currentDate:latest?.date||"",
      context:latest?.context||"",tier:latest?.tier||"",rubric:latest?.rubric||"",
      previousScore:prior?.value??null,currentScore:latest?.value??null,
      ordinalChange:prior?latest.value-prior.value:null,evidence:latest?.evidence??null});
  });
  return Object.freeze({total:69,comparable,provisional,notRated:rows.filter(x=>x.status==="NE").length,rows});
}
export function exportPassportComparableTrendCsvV75(args={}){
  const out=buildPassportComparableTrendV75(args),matrix=[PASSPORT_TREND_HEADERS_V75,
    ...out.rows.map(x=>[x.code,protect(x.name),x.status,x.previousDate,x.currentDate,
      x.context,x.tier,x.rubric,x.previousScore??"NE",x.currentScore??"NE",
      x.ordinalChange??"",x.evidence??""])];
  return "\uFEFF"+matrix.map(row=>row.map(csv).join(",")).join("\r\n")+"\r\n";
}
