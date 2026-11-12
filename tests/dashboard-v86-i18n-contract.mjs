/**
 * @fileoverview Dashboard locale contract (no database access).
 * @description Tests four complete locale dictionaries, placeholders, source
 * language switching, and guards against static Spanish KPI labels.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SEASON_DASHBOARD_V86} from "../locales/seasonDashboardV86.js";
import {interpolateLanguageV80} from "../services/i18n/BundledLanguageCatalogV80.js";
const expected=Object.keys(SEASON_DASHBOARD_V86.es).sort();
for(const lang of ["es","ca","en","fr"]){
  const words=SEASON_DASHBOARD_V86[lang];
  assert.deepEqual(Object.keys(words).sort(),expected,lang+": missing keys");
  for(const key of expected){
    assert.equal(typeof words[key],"string",lang+" missing "+key);
    assert.ok(words[key].trim(),lang+" empty "+key);
    const params=s=>[...s.matchAll(/\{([A-Za-z_]+)\}/g)].map(m=>m[1]).sort();
    assert.deepEqual(params(words[key]),params(SEASON_DASHBOARD_V86.es[key]),lang+": placeholders on "+key);
  }
}
assert.equal(SEASON_DASHBOARD_V86.ca.played,"Partits jugats");
assert.equal(SEASON_DASHBOARD_V86.en.played,"Games played");
assert.equal(SEASON_DASHBOARD_V86.fr.played,"Matchs joués");
assert.equal(interpolateLanguageV80(SEASON_DASHBOARD_V86.ca.gamesCount,{count:5}),"5 partits");
const source=readFileSync(new URL("../views/SeasonDashboardView.js",import.meta.url),"utf8");
assert.match(source,/import\("\.\.\/locales\/seasonDashboardV86\.js"\)/);
assert.match(source,/import\("\.\.\/services\/i18n\/BasketballCategoryDisplayV88\.js"\)/);
assert.match(source,/this\.dashboardLocalePack\?\.\[locale\]/);
for(const forbidden of ["<span>PARTIDOS JUGADOS</span>","<span>VICTORIAS</span>","<span>DERROTAS</span>","<span>PUNTOS POR PARTIDO</span>","<span>PUNTOS RECIBIDOS</span>","<h3 class=\"clean-table-title\">ÚLTIMOS PARTIDOS</h3>"]){
  assert.ok(!source.includes(forbidden),"Raw Spanish UI: "+forbidden);
}
assert.doesNotMatch(source,/▼ -1\.8 vs previos|▲ \+4\.0 vs previos/);
assert.doesNotMatch(source,/activeTeamObj\.name \|\| "JMJ Manyanet/);
console.log("PASS V86 dashboard complete four-language copy and no fabricated trends");
