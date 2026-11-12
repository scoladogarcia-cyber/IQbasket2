/**
 * @fileoverview Presentation-only basketball category localization.
 * @description Uses the existing federative category vocabulary as a controlled
 * source of canonical codes. Unknown, custom and competition-specific labels are
 * always returned verbatim. It never writes or guesses a player's age/eligibility.
 */
import {passportCategoryContext} from "../../config/playerPassportCategoriesV68.config.js";

const LABELS=Object.freeze({
  ca:Object.freeze({
    SCHOOL:"Escola de bàsquet",ESCOBOL:"Escobol",PREMINI_FIRST:"Premini de primer any",
    PREMINI:"Premini",MINI_FIRST:"Mini de primer any",MINI:"Mini",
    PREINFANTIL:"Preinfantil",INFANTIL_FIRST:"Infantil de primer any",
    INFANTIL:"Infantil",CADET_FIRST:"Cadet de primer any",CADET:"Cadet",
    JUNIOR_FIRST:"Júnior de primer any",JUNIOR:"Júnior",U20:"Sub-20",
    U21:"Sub-21",U22:"Sub-22",U25:"Sub-25",SENIOR:"Sènior"
  }),
  en:Object.freeze({
    SCHOOL:"Basketball school",ESCOBOL:"Escobol",PREMINI_FIRST:"Pre-mini (first year)",
    PREMINI:"Pre-mini",MINI_FIRST:"Mini (first year)",MINI:"Mini",
    PREINFANTIL:"Pre-infant",INFANTIL_FIRST:"Infant (first year)",
    INFANTIL:"Infant",CADET_FIRST:"Cadet (first year)",CADET:"Cadet",
    JUNIOR_FIRST:"Junior (first year)",JUNIOR:"Junior",U20:"U20",
    U21:"U21",U22:"U22",U25:"U25",SENIOR:"Senior"
  }),
  fr:Object.freeze({
    SCHOOL:"École de basket",ESCOBOL:"Escobol",PREMINI_FIRST:"Pré-mini (première année)",
    PREMINI:"Pré-mini",MINI_FIRST:"Mini (première année)",MINI:"Mini",
    PREINFANTIL:"Pré-infantil",INFANTIL_FIRST:"Infantil (première année)",
    INFANTIL:"Infantil",CADET_FIRST:"Cadet (première année)",CADET:"Cadet",
    JUNIOR_FIRST:"Junior (première année)",JUNIOR:"Junior",U20:"U20",
    U21:"U21",U22:"U22",U25:"U25",SENIOR:"Senior"
  })
});
const GENDER=Object.freeze({
  ca:Object.freeze({M:"masculí",F:"femení",MIXED:"mixt"}),
  en:Object.freeze({M:"boys",F:"girls",MIXED:"mixed"}),
  fr:Object.freeze({M:"garçons",F:"filles",MIXED:"mixte"})
});
const patterns=[
  ["M",/\b(masculino|masculi|masc|male|boys)\b/i],
  ["F",/\b(femenino|femeni|fem|female|girls)\b/i],
  ["MIXED",/\b(mixto|mixte|mixed)\b/i]
];

/**
 * @param {string} value Team's stored category label (never changed).
 * @param {"es"|"ca"|"en"|"fr"} locale Display locale.
 * @returns {string} A known federation category translation, or the original.
 */
export function formatBasketballCategoryLabelV88(value,locale="es") {
  const original=String(value??"").trim();
  if(!original || locale==="es" || !LABELS[locale])return original;
  // The original recognizer tolerates accents in category codes and preserves
  // first-year distinctions. Qualifiers like B1 will not match: safe fallback.
  const {canonicalCode}=passportCategoryContext(original);
  if(!canonicalCode)return original;
  const base=LABELS[locale][canonicalCode];
  if(!base)return original;
  const normalized=original.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const gender=patterns.find(([_,re])=>re.test(normalized))?.[0]||null;
  return gender ? base+" · "+GENDER[locale][gender] : base;
}
