/**
 * @fileoverview Federative category vocabulary used as sporting context only.
 * The stored team.category / competition remains the authoritative season record.
 * Ages and eligibility are defined by the federation's rules EACH season,
 * not inferred permanently from a fixed year-of-birth table.
 *
 * Sources: FCBQ competition bases 2025-26 and federative category framework;
 * https://www.basquetcatala.cat/document/getdocument/3754
 * Variants overlap: preinfantil and infantil primer any are not identical competitions.
 */
export const PASSPORT_CATEGORY_VOCABULARY_V68=Object.freeze([
  {code:'SCHOOL',label:'Escuela de baloncesto',aliases:['escuela','escola','escoles basquet','escoles bàsquet']},
  {code:'ESCOBOL',label:'Escobol',aliases:['escobol']},
  {code:'PREMINI_FIRST',label:'Premini primer año',aliases:['premini 1r','premini primer','premini primer año']},
  {code:'PREMINI',label:'Premini',aliases:['premini','pre-mini']},
  {code:'MINI_FIRST',label:'Mini primer año',aliases:['mini 1r','mini primer','mini primer año']},
  {code:'MINI',label:'Mini',aliases:['mini','minibasket']},
  {code:'PREINFANTIL',label:'Preinfantil',aliases:['preinfantil','pre-infantil']},
  {code:'INFANTIL_FIRST',label:'Infantil primer año',aliases:['infantil 1r','infantil primer']},
  {code:'INFANTIL',label:'Infantil',aliases:['infantil']},
  {code:'CADET_FIRST',label:'Cadete primer año',aliases:['cadet 1r','cadete primer','cadet primer']},
  {code:'CADET',label:'Cadete',aliases:['cadete','cadet']},
  {code:'JUNIOR_FIRST',label:'Júnior primer año',aliases:['junior 1r','júnior 1r','junior primer']},
  {code:'JUNIOR',label:'Júnior',aliases:['júnior','junior']},
  {code:'U20',label:'Sub-20',aliases:['sots 20','sub 20','sub-20','u20']},
  {code:'U21',label:'Sub-21',aliases:['sots 21','sub 21','sub-21','u21']},
  {code:'U22',label:'Sub-22',aliases:['sub 22','sub-22','u22']},
  {code:'U25',label:'Sub-25',aliases:['sots 25','sub 25','sub-25','u25']},
  {code:'SENIOR',label:'Sénior',aliases:['senior','sènior','absoluto']}
]);
export const PASSPORT_DIFFICULTY_LEVELS_V68=Object.freeze([
  {code:'D1',label:'Iniciación controlada'},
  {code:'D2',label:'Fundamentos con variabilidad'},
  {code:'D3',label:'Oposición real'},
  {code:'D4',label:'Presión y decisiones complejas'},
  {code:'D5',label:'Exigencia alta observada (pendiente de calibración)'}
]);
const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/\b(masculino|femenino|mixto|masc|fem|promocion|preferente|nivell|nivel)\b/g,'')
 .replace(/\s+/g,' ').trim();
export function passportCategoryContext(raw){
  const normalized=normalize(raw);
  const candidates=PASSPORT_CATEGORY_VOCABULARY_V68.filter(entry=>
    entry.aliases.some(alias=>normalize(alias)===normalized));
  return {raw:String(raw||''),canonicalCode:candidates.length===1?candidates[0].code:null,
    normalizedLabel:candidates.length===1?candidates[0].label:null,
    source:'TEAM_SEASON_CATEGORY',federation:null,competition:null,
    automaticScoreBonus:0,categoryDeterminesSkill:false};
}
