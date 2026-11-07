import assert from "node:assert/strict";
import fs from "node:fs";
import {parseBoxScoreCsv} from "../services/reports/BoxScoreExchangeV53.js";
import {exportPassportAssessmentCsvV73} from "../services/player360/PassportAssessmentCsvV73.js";
import {exportPassportAssessmentCsvV78,previewPassportAssessmentCsvV78,isLegacyPassportCsvV73,PASSPORT_CSV_HEADERS_V78,PASSPORT_CSV_VERSION_V78} from "../services/player360/PassportAssessmentCsvV78.js";
import {filterReportGamesByDateV78} from "../services/reports/ReportDateRangeV78.js";
import {buildReportAuditManifestV78,serializeReportAuditManifestV78} from "../services/reports/ReportAuditManifestV78.js";
import {assertLanguagePlaceholderParityV78,parseLanguagePackCsv} from "../services/i18n/LanguagePackExchangeV71.js";
import {renderFamilyMotivationV74} from "../views/family/FamilyMotivationReflectionV74.js";
import {motivationConversationV75} from "../domain/motivation/MotivationReflectionV74.js";

const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const csv=rows=>"\uFEFF"+rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n")+"\r\n";
const playerId="11111111-1111-4111-8111-111111111111";
const otherId="33333333-3333-4333-8333-333333333333";
const seasonId="22222222-2222-4222-8222-222222222222";
const otherSeason="44444444-4444-4444-8444-444444444444";
const catalog={attributes:Array.from({length:69},(_,n)=>({
  code:"C-"+String(n).padStart(2,"0"),name:"Indicador "+n,min_evidence:5,valid_contexts:["T","P5"],rubric_version:"1.0"
}))};
const latest=new Map([["C-00",{score:2}]]);
const source=exportPassportAssessmentCsvV78({catalog,latest,playerId,teamSeasonId:seasonId});
const matrix=parseBoxScoreCsv(source);
assert.equal(matrix.length,70);
assert.deepEqual(matrix[0],PASSPORT_CSV_HEADERS_V78);
assert.equal(matrix[1][0],PASSPORT_CSV_VERSION_V78);
assert.equal(matrix[1][10],"2");
assert.equal(matrix[2][10],"NE");
matrix[1][5]="4";matrix[1][6]="D2";matrix[1][7]="5";matrix[1][8]="HIGH";
const validText=csv(matrix);
const preview=previewPassportAssessmentCsvV78(validText,{catalog,latest,playerId,teamSeasonId:seasonId,context:"T"});
assert.equal(preview.updated,1);
assert.equal(preview.drafts.get("C-00").score,4);
assert.equal(preview.playerId,playerId);
assert.equal(preview.teamSeasonId,seasonId);
assert.equal(preview.drafts.get("C-00").difficultyTier,"D2");
assert.throws(()=>previewPassportAssessmentCsvV78(validText,{catalog,latest,playerId:otherId,teamSeasonId:seasonId,context:"T"}),/otro jugador|temporada/);
assert.throws(()=>previewPassportAssessmentCsvV78(validText,{catalog,latest,playerId,teamSeasonId:otherSeason,context:"T"}),/otro jugador|temporada/);
const tamper=(row,col,value)=>{const copy=matrix.map(r=>[...r]);copy[row][col]=value;return csv(copy);};
assert.throws(()=>previewPassportAssessmentCsvV78(tamper(2,1,otherId),{catalog,latest,playerId,teamSeasonId:seasonId,context:"T"}),/otro jugador/);
assert.throws(()=>previewPassportAssessmentCsvV78(tamper(1,10,"5"),{catalog,latest,playerId,teamSeasonId:seasonId,context:"T"}),/referencia ha cambiado/);
assert.throws(()=>previewPassportAssessmentCsvV78(tamper(1,0,"UNKNOWN"),{catalog,latest,playerId,teamSeasonId:seasonId,context:"T"}),/otro jugador|versión/);
assert.throws(()=>previewPassportAssessmentCsvV78(csv(matrix.slice(0,69)),{catalog,latest,playerId,teamSeasonId:seasonId,context:"T"}),/Plantilla V78/);
const legacy=exportPassportAssessmentCsvV73(catalog,latest);
assert.equal(isLegacyPassportCsvV73(legacy),true);
assert.equal(isLegacyPassportCsvV73(source),false);
assert.throws(()=>previewPassportAssessmentCsvV78(legacy,{catalog,latest,playerId,teamSeasonId:seasonId,context:"T"}),/Plantilla V78/);

// A date range includes only selected, verified games; invalid dates fail closed.
const g1={id:"g1",date:"2026-10-01",team_id:"team",team_season_id:"season",team_score:2,opponent_score:0,capture_revision:null,status:"Finalizado"};
const g2={id:"g2",date:"2026-10-20",team_id:"team",team_season_id:"season",team_score:5,opponent_score:6,capture_revision:9,status:"Finalizado"};
assert.deepEqual(filterReportGamesByDateV78([g1,g2],{fromDate:"2026-10-10"}).map(g=>g.id),["g2"]);
assert.deepEqual(filterReportGamesByDateV78([g1,g2],{toDate:"2026-10-10"}).map(g=>g.id),["g1"]);
assert.deepEqual(filterReportGamesByDateV78([g1,g2],{}).map(g=>g.id),["g1","g2"]);
assert.throws(()=>filterReportGamesByDateV78([g1,g2],{fromDate:"2026-10-30",toDate:"2026-10-01"}),/Rango/);
assert.throws(()=>filterReportGamesByDateV78([g1,g2],{fromDate:"2026-02-30"}),/Rango/);
assert.throws(()=>filterReportGamesByDateV78([g1,g1],{}),/duplicados/);
assert.throws(()=>filterReportGamesByDateV78([{...g1,date:null}],{fromDate:"2026-10-01"}),/fecha/);

// Report manifest is privacy-minimal and separates actual zero from missing.
const report=g=>({game:g,players:[{id:playerId}],stats:[{player_id:playerId,points:g.id==="g1"?2:5}]});
const manifest=buildReportAuditManifestV78([report(g1),report(g2)],{generatedAt:"2026-11-07T16:00:00.000Z"});
assert.equal(manifest.schema,"IQB_REPORT_AUDIT_V78");
assert.equal(manifest.game_count,2);
assert.equal(manifest.games[0].capture_revision,null);
assert.equal(manifest.games[0].score_consistent,true);
assert.equal(manifest.games[1].capture_revision,9);
assert.ok(!serializeReportAuditManifestV78([report(g1)],{generatedAt:"2026-11-07T16:00:00Z"}).includes('"first_name"'));
const unknown={...report(g1),stats:[{player_id:playerId,points:null}]};
assert.equal(buildReportAuditManifestV78([unknown]).games[0].sum_player_points,null);
assert.equal(buildReportAuditManifestV78([unknown]).games[0].score_consistent,null);
assert.equal(buildReportAuditManifestV78([{...report(g1),game:{...g1,team_score:3}}]).games[0].score_consistent,false);
assert.throws(()=>buildReportAuditManifestV78([report(g1),report(g1)]),/más de una vez/);
assert.throws(()=>buildReportAuditManifestV78([report(g1),report({...g2,team_season_id:"other"})]),/mezclan/);
assert.throws(()=>buildReportAuditManifestV78([{...report(g1),stats:[{player_id:otherId,points:2}]}]),/fuera de la plantilla/);

// Manual translation and CSV both preserve reference placeholders.
const reference={greet:"Hola {player}, tu equipo {team}."};
assert.equal(assertLanguagePlaceholderParityV78("greet","Bonjour {team}, {player}.",reference),true);
assert.throws(()=>assertLanguagePlaceholderParityV78("greet","Bonjour {team}.",reference),/player/);
assert.throws(()=>assertLanguagePlaceholderParityV78("greet","Bonjour {team}, {player}, {new}.",reference),/marcadores/i);
const ok=csv([["key","translation"],["greet","Hello {player}, {team}!"]]);
assert.equal(parseLanguagePackCsv(ok,{existingKeys:new Set(["greet"]),referenceDictionary:reference}).greet,"Hello {player}, {team}!");
assert.throws(()=>parseLanguagePackCsv(csv([["key","translation"],["greet","Hello!"]]),{existingKeys:new Set(["greet"]),referenceDictionary:reference}),/marcadores/i);

// A family conversation is optional and transient, not a scored assessment.
assert.match(renderFamilyMotivationV74("fr"),/data-iqb-family-motivation/);
assert.ok(motivationConversationV75({ENJOYMENT:"NOT_NOW"}, "es").starter);
const motivation=read("views/family/FamilyMotivationReflectionV74.js");
assert.match(motivation,/event.currentTarget.open/);
assert.doesNotMatch(motivation,/localStorage|sessionStorage|fetch\(|\.rpc\(/);
const passport=read("views/player360/passport/PlayerPassportView.js");
assert.match(passport,/exportPassportAssessmentCsvV78/);
assert.match(passport,/isLegacyPassportCsvV73/);
assert.match(passport,/previewPassportAssessmentCsvV78/);
const languages=read("views/LanguageSettingsView.js");
assert.match(languages,/assertLanguagePlaceholderParityV78/);
assert.match(languages,/langKeySearchV78/);
assert.match(languages,/escapeLangAttrV78/);
const reports=read("views/ReportsViewV53.js");
assert.match(reports,/filterReportGamesByDateV78/);
assert.match(reports,/manifest-json/);
assert.match(reports,/let overview=null/);
assert.match(reports,/overview=document\.createElement\("div"\)/);
assert.doesNotMatch(reports,/const overview=document\.createElement\("div"\)/);
assert.match(reports,/_readSelected\(games,true\)/);
console.log("PASS V78: identity-scoped passport, read-only imports, date-scoped reports, audit JSON, languages, Family and motivation.");
