import assert from "node:assert/strict";
import fs from "node:fs";
import {serializeLanguagePackCsv,parseLanguagePackCsv,supportedLocale} from "../services/i18n/LanguagePackExchangeV71.js";
import {observedRate,displayObserved,inspectBoxScoreRows,renderStatsQualityInfo} from "../domain/stats/StatQualityV71.js";

assert.equal(supportedLocale("cat"),"ca");
assert.throws(()=>supportedLocale("ru"),/soportado/);
const dict={welcome:"Bienvenido",long:"Dos palabras,\ncon salto",quote:'A "B"',empty:""};
const csv=serializeLanguagePackCsv(dict,"es");
const values=parseLanguagePackCsv(csv,{existingKeys:new Set(Object.keys(dict))});
assert.equal(values.welcome,"Bienvenido");
assert.equal(values.long,"Dos palabras,\ncon salto");
assert.equal(values.quote,'A "B"');
assert.throws(()=>parseLanguagePackCsv("key,translation\nnew,UNSAFE",{existingKeys:new Set(["welcome"])}),/desconocida/);
assert.throws(()=>parseLanguagePackCsv("key,translation\na,1\na,2"),/duplicada/);

assert.equal(observedRate(0,0),null);
assert.equal(observedRate(null,3),null);
assert.equal(observedRate(0,4),0);
assert.equal(observedRate(3,4),75);
assert.equal(displayObserved(null),"N/D");
assert.equal(displayObserved(0),"0");
const game={team_score:5};
const raw=[{player_id:"a",points:5,minutes:null,fg2_made:1,fg2_attempted:2,fg3_made:1,fg3_attempted:1,ft_made:0,ft_attempted:0}];
const q=inspectBoxScoreRows(raw,game);
assert.equal(q.confirmedPoints,5);
assert.equal(q.missingMinutes.length,1);
assert.equal(q.unreliablePoints.length,0);
assert.match(renderStatsQualityInfo({rows:raw,game}),/N\/D/);
const mismatch=inspectBoxScoreRows(raw,{team_score:7});
assert.equal(mismatch.comparable,false);
assert.match(mismatch.issues.join(),/marcador/);
const wrong=inspectBoxScoreRows([{...raw[0],points:4}],{team_score:4});
assert.equal(wrong.unreliablePoints.length,1);
assert.equal(inspectBoxScoreRows([{...raw[0],points:0}],{team_score:0}).knownZeroPoints,1);
const root=new URL("../",import.meta.url);
const files={
  language:fs.readFileSync(new URL("views/LanguageSettingsView.js",root),"utf8"),
  settings:fs.readFileSync(new URL("views/TranslationsView.js",root),"utf8"),
  report:fs.readFileSync(new URL("views/ReportsViewV53.js",root),"utf8"),
  player:fs.readFileSync(new URL("views/ReportsViewV50.js",root),"utf8"),
  passport:fs.readFileSync(new URL("views/player360/passport/PlayerPassportView.js",root),"utf8"),
};
assert.match(files.language,/bindEvents\(root/);
assert.match(files.language,/parseLanguagePackCsv/);
assert.match(files.language,/if \(error\) throw error;/);
assert.doesNotMatch(files.language,/.delete\(\)\s*\.eq/);
assert.match(files.settings,/canSave:\s*\(\)\s*=>\s*this\._can\("MANAGE_TRANSLATIONS"\)/);
assert.match(files.report,/summary-pdf/);
assert.match(files.report,/renderStatsQualityInfo/);
assert.match(files.report,/renderGameStatisticsGlossary/);
assert.match(files.player,/iq-player-report-format/);
assert.match(files.passport,/_passportFaq/);
assert.match(files.passport,/Un cero no es N\/D/);
const boxscore=fs.readFileSync(new URL("views/GameBoxScoreBaseView.js",root),"utf8");
assert.doesNotMatch(boxscore,/18\\.5%/);
assert.doesNotMatch(boxscore,/computed\\.eFG\\.toFixed/);
assert.doesNotMatch(boxscore,/comp\\.eFG\\.toFixed/);
assert.match(boxscore,/const astToText = valPer > 0 \\? .* : "N\\/D"/);
console.log("IQBasket V71: language CSV, permissions, reporting variants, passport FAQ and zero semantics OK");
