import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildPassportCoverageV74,exportPassportCoverageV74} from "../domain/player360/PassportCoverageV74.js";
import {REPORT_PROFILE_V74,resolveReportProfileV74} from "../services/reports/ReportProfileV74.js";
import {exportRosterCsvV74,previewRosterCsvV74} from "../services/exchange/RosterExchangeV74.js";
import {localeCoverageV74,missingLanguageTemplateV74} from "../services/i18n/LanguageCoverageV74.js";
import {MOTIVATION_QUESTIONS_V74,reflectionV74} from "../domain/motivation/MotivationReflectionV74.js";
import {renderFamilyMotivationV74} from "../views/family/FamilyMotivationReflectionV74.js";
import {parseBoxScoreCsv} from "../services/reports/BoxScoreExchangeV53.js";
import {adaptFederationCsv} from "../services/reports/FederationCsvAdapterV70.js";
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
// Passport: all 69 distinct keys, contextual evidence, NE is not zero.
const catalog={attributes:Array.from({length:69},(_,i)=>({code:"A-"+i,name:i===0?"=injection":"Prueba "+i,dimension:"Técnica",min_evidence:5}))};
const latest=new Map([["A-0",{score:4,difficulty_tier:"D2",evidence_count:5}],["A-1",{score:3,evidence_count:1}]]); 
const coverage=buildPassportCoverageV74({catalog,latest});
assert.deepEqual([coverage.total,coverage.assessed,coverage.verified,coverage.provisional,coverage.notEvaluated],[69,2,1,1,67]);
assert.equal(coverage.rows[2].status,"NE");
assert.match(exportPassportCoverageV74({catalog,latest}),/"'=injection"/);
assert.throws(()=>buildPassportCoverageV74({catalog:{attributes:catalog.attributes.slice(1)},latest}),/69/);
// Configurable reports: explicit profiles, invalid choices fail closed.
assert.equal(resolveReportProfileV74("DEVELOPMENT").quality,true);
assert.equal(resolveReportProfileV74("VISUAL").quality,false);
assert.equal(resolveReportProfileV74("COMPLETE").complete,true);
assert.throws(()=>resolveReportProfileV74("OTHER"),/admitido/);
assert.throws(()=>resolveReportProfileV74("VISUAL",{quality:"yes"}),/válida/);
assert.equal(Object.keys(REPORT_PROFILE_V74).length,3);
// No silent roster writes, no unknown or omitted players.
const authorizedPlayers=[
  {id:"p1",first_name:"Ana",last_name:"Uno",jersey:"4",primary_position:"Base"},
  {id:"p2",first_name:"Ona",last_name:"Dos",jersey:"7",primary_position:"Alero"}
];
const exported=exportRosterCsvV74(authorizedPlayers),matrix=parseBoxScoreCsv(exported);
assert.equal(matrix.length,3);
const serialize=m=>m.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
assert.equal(previewRosterCsvV74(exported,{authorizedPlayers}).changed,0);
matrix[1][4]="Escolta";
const preview=previewRosterCsvV74(serialize(matrix),{authorizedPlayers});
assert.equal(preview.changed,1);assert.equal(preview.writable,false);
assert.throws(()=>previewRosterCsvV74(serialize(matrix.slice(0,2)),{authorizedPlayers}),/Faltan/);
matrix[1][0]="intruder";
assert.throws(()=>previewRosterCsvV74(serialize(matrix),{authorizedPlayers}),/fuera/);
// Language coverage: no false positives from fallback translations.
const source={dashboard:"Panel",reports:"Informes",passport:"Pasaporte"};
const target={dashboard:"Tauler",reports:""};
const audit=localeCoverageV74({source,target,locale:"ca"});
assert.deepEqual([audit.total,audit.translated,audit.missing.length],[3,1,2]);
assert.deepEqual(parseBoxScoreCsv(missingLanguageTemplateV74({source,target,locale:"ca"})).slice(1),[["passport",""],["reports",""]]);
assert.throws(()=>localeCoverageV74({source,target,locale:"xx"}),/soportado/);
// Voluntary, non-clinical and ephemeral reflection: no numeric labels/storage/network.
assert.equal(MOTIVATION_QUESTIONS_V74.length,3);
assert.equal(reflectionV74({ENJOYMENT:"YES",LEARNING:"",VOICE:"NOT_NOW"}).answered,2);
assert.throws(()=>reflectionV74({VOICE:"5"}),/desconocida/);
const familyHtml=renderFamilyMotivationV74("ca");
assert.match(familyHtml,/Has gaudit/);assert.match(familyHtml,/data-iqb-motivation-form/);
for(const pattern of [/localStorage/,/sessionStorage/,/fetch\(/,/\.rpc\(/,/score:/,/diagnos/i]){
  assert.doesNotMatch(src("views/family/FamilyMotivationReflectionV74.js"),pattern);
}
// Real screen wiring and legacy compatibility.
const fam=src("views/family/FamilyWorkspaceView.js"),pass=src("views/player360/passport/PlayerPassportView.js");
const rep=src("views/ReportsViewV53.js"),lang=src("views/LanguageSettingsView.js");
assert.match(fam,/bindFamilyMotivationV74/);
assert.match(pass,/EXPORT_PLAYER_PASSPORT/);assert.match(pass,/pp-export-coverage/);
assert.match(rep,/profile-pdf/);assert.match(rep,/previewRosterCsvV74/);
assert.match(lang,/missingLanguageTemplateV74/);
// Federation identity: matching jersey is insufficient if verified names disagree.
const headers=["Dorsal","Jugador","MIN","PTS","T2C","T2I","T3C","T3I","TLC","TLI","RO","RD","AST","REC","TAP","PER","FP","FR"];
const line=["4","Sonia False","10","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"];
const options={game:{id:"g",team_season_id:"s"},eligiblePlayers:[{id:"p",jersey:4,first_name:"Ana",last_name:"Uno"}],stats:[{player_id:"p"}]};
assert.throws(()=>adaptFederationCsv([headers,line],options),/nombre no/);
assert.equal(adaptFederationCsv([headers,["4","Uno Ana",...line.slice(2)]],options)[1][2],"p");
console.log("PASS V74: passport, report profiles, identity-safe exchanges, language audit, Family and motivation.");
