/**
 * @fileoverview Regression: team/advanced-stat UI translates without touching data.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {TranslationStore} from "../services/TranslationStore.js";
import {TeamStatsView} from "../views/TeamStatsView.js";
import {AdvancedStatsView} from "../views/AdvancedStatsView.js";
import {CORE_STATS_V87} from "../locales/coreStatsV87.js";
const keys=Object.keys(CORE_STATS_V87.es).sort();
for(const locale of ["es","ca","en","fr"]){
  assert.deepEqual(Object.keys(CORE_STATS_V87[locale]).sort(),keys,locale+" keys");
  for(const key of keys)assert.ok(CORE_STATS_V87[locale][key]?.trim(),locale+" "+key);
  await TranslationStore.setLanguage(locale);
  const team=new TeamStatsView();
  const stats=new AdvancedStatsView();
  assert.equal(team.t("competition"),CORE_STATS_V87[locale].competition);
  assert.equal(team.t("primary_color"),CORE_STATS_V87[locale].primary_color);
  assert.equal(team._statusLabel("Activo"),CORE_STATS_V87[locale]["team.v87.active"]);
  assert.equal(team._statusLabel("Inactivo"),CORE_STATS_V87[locale]["team.v87.inactive"]);
  assert.equal(team._statusLabel("Lesión anotada por usuario"),"Lesión anotada por usuario");
  assert.equal(stats.t("efg_desc"),CORE_STATS_V87[locale].efg_desc);
  assert.equal(stats.t("stats.v87.tooltipPir"),CORE_STATS_V87[locale]["stats.v87.tooltipPir"]);
}
const adv=readFileSync(new URL("../views/AdvancedStatsView.js",import.meta.url),"utf8");
const team=readFileSync(new URL("../views/TeamStatsView.js",import.meta.url),"utf8");
assert.match(adv,/this\.t\("stats\.v87\.tooltipPir"\)/);
assert.match(team,/this\._statusLabel\(p\.statusTxt\)/);
assert.doesNotMatch(adv,/<span class="tooltip-box">[A-ZÁÉÍÓÚÑ][^<]*Mide/);
assert.doesNotMatch(team,/\$\{data\.wins\}W<\/strong>/);
console.log("PASS V87: localized Team/Advanced Stats (ES/CA/EN/FR), preserving stored statuses");
