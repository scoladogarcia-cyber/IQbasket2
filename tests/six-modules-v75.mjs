import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseBoxScoreCsv} from "../services/reports/BoxScoreExchangeV53.js";
import {exportTrainingEvidenceCsvV75,previewTrainingEvidenceCsvV75,TRAINING_CSV_HEADERS_V75} from "../services/exchange/TrainingEvidenceExchangeV75.js";
import {buildPassportComparableTrendV75,exportPassportComparableTrendCsvV75} from "../domain/player360/PassportComparableTrendV75.js";
import {parseLanguagePackCsv,languagePlaceholdersV75} from "../services/i18n/LanguagePackExchangeV71.js";
import {resolveReportProfileV74} from "../services/reports/ReportProfileV74.js";
import {motivationConversationV75} from "../domain/motivation/MotivationReflectionV74.js";
const repo=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const quote=matrix=>matrix.map(row=>row.map(x=>'"'+String(x??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");

// 1: A complete, identity-bound training CSV survives round-trip unchanged.
const sessions=[
 {id:"session-a",team_season_id:"s1",session_date:"2026-10-01",title:"Pase",duration_minutes:60,metadata:{session_kind:"TEAM"},
  participants:[{player_id:"p1",attendance_status:"PRESENT",participated_minutes:60},
    {player_id:"p2",attendance_status:"ABSENT",participated_minutes:null}]},
 {id:"session-b",team_season_id:"s1",session_date:"2026-10-02",title:"=danger",duration_minutes:45,metadata:{session_kind:"PERSONAL"},participants:[]}
];
const exported=exportTrainingEvidenceCsvV75({sessions,teamSeasonId:"s1"});
const matrix=parseBoxScoreCsv(exported.content);
assert.deepEqual(matrix[0],TRAINING_CSV_HEADERS_V75);
assert.equal(matrix[2][8],""); // N/D is not zero.
assert.equal(matrix[3][3],"'=danger"); // Spreadsheet injection protection.
assert.deepEqual([exported.rows,exported.sessionCount],[3,2]);
assert.equal(previewTrainingEvidenceCsvV75(exported.content,{sessions,teamSeasonId:"s1"}).changed,0);
matrix[1][8]="30";
const preview=previewTrainingEvidenceCsvV75(quote(matrix),{sessions,teamSeasonId:"s1"});
assert.equal(preview.changed,1);
assert.equal(preview.changes[0].after.minutes,30);
assert.equal(preview.writable,false);
matrix[1][8]=""; // Missing actual minutes cannot become observed zero.
assert.match(previewTrainingEvidenceCsvV75(quote(matrix),{sessions,teamSeasonId:"s1"}).warnings.join(" "),/sin minutos/);
matrix[1][8]="61";
assert.throws(()=>previewTrainingEvidenceCsvV75(quote(matrix),{sessions,teamSeasonId:"s1"}),/superiores/);
matrix[1][8]="60";matrix[2][8]="20";
assert.throws(()=>previewTrainingEvidenceCsvV75(quote(matrix),{sessions,teamSeasonId:"s1"}),/ausencias/);
matrix[2][8]="";
assert.throws(()=>previewTrainingEvidenceCsvV75(quote(matrix.slice(0,3)),{sessions,teamSeasonId:"s1"}),/incompleta/);
matrix[1][6]="other";
assert.throws(()=>previewTrainingEvidenceCsvV75(quote(matrix),{sessions,teamSeasonId:"s1"}),/ajeno/);
assert.throws(()=>exportTrainingEvidenceCsvV75({sessions,teamSeasonId:"other"}),/ajeno/);

// 2: At most descriptive variation on comparable dated, same-context/same-tier observations.
const catalog={attributes:Array.from({length:69},(_,i)=>({code:"A-"+i,name:i?"Habilidad "+i:"=Safe",min_evidence:5}))};
const score=(code,value,tier,count=5)=>({metric_code:code,score:value,difficulty_tier:tier,evidence_count:count,rubric_version:"1.0",metadata:{evaluation_context:"P5"}});
const evaluations=[
 {evaluation_date:"2026-09-01",scores:[score("A-0",2,"D2"),score("A-1",2,"D2"),score("A-2",1,"D1")]},
 {evaluation_date:"2026-10-01",scores:[score("A-0",4,"D2"),score("A-1",4,"D3"),score("A-2",4,"D1",1)]}
];
const trend=buildPassportComparableTrendV75({catalog,evaluations});
assert.deepEqual([trend.total,trend.comparable,trend.provisional,trend.notRated],[69,1,1,66]);
assert.deepEqual([trend.rows[0].status,trend.rows[0].ordinalChange],["COMPARABLE",2]);
assert.equal(trend.rows[1].status,"SIN_BASE_EQUIVALENTE");
assert.equal(trend.rows[1].ordinalChange,null);
assert.equal(trend.rows[2].status,"PROVISIONAL");
assert.equal(trend.rows[3].status,"NE");
assert.match(exportPassportComparableTrendCsvV75({catalog,evaluations}),/"'=Safe"/);
assert.throws(()=>buildPassportComparableTrendV75({catalog:{attributes:catalog.attributes.slice(1)},evaluations}),/69/);

// 3: I18n placeholders must not silently lose player-specific values.
assert.deepEqual(languagePlaceholdersV75("Hola {player}: {player} de {team}"),["player","team"]);
const dict={greeting:"Hola {player} de {team}"};
const header=[["key","translation"],["greeting","Hello {player} of {team}"]];
assert.equal(parseLanguagePackCsv(quote(header),{existingKeys:new Set(["greeting"]),referenceDictionary:dict}).greeting,"Hello {player} of {team}");
assert.throws(()=>parseLanguagePackCsv(quote([header[0],["greeting","Hello {player}"]]),{referenceDictionary:dict}),/marcadores/);
assert.throws(()=>parseLanguagePackCsv(quote([header[0],["greeting","Hello {player} {newValue} {team}"]]),{referenceDictionary:dict}),/marcadores/);

// 4: Motivation is not a score: local questions adapt without storage or diagnosis.
const low=motivationConversationV75({ENJOYMENT:"NOT_NOW",LEARNING:"YES",VOICE:"YES"},"es");
assert.match(low.starter,/disfrutar/);
const all=motivationConversationV75({ENJOYMENT:"YES",LEARNING:"YES",VOICE:"YES"},"ca");
assert.match(all.starter,/moment/);
assert.equal(motivationConversationV75({ENJOYMENT:"",LEARNING:"",VOICE:""},"en").starter,null);
assert.throws(()=>motivationConversationV75({VOICE:"9"},"en"),/desconocida/);

// 5: Existing report profiles now permit independent section selection.
assert.equal(resolveReportProfileV74("DEVELOPMENT",{quality:false,glossary:false}).quality,false);
assert.throws(()=>resolveReportProfileV74("COMPLETE",{overview:true}),/duplicarlo/);
const reports=repo("views/ReportsViewV53.js"),training=repo("views/TrainingView.js"),language=repo("views/LanguageSettingsView.js"),passport=repo("views/player360/passport/PlayerPassportView.js");
assert.match(reports,/data\.section|dataset\.section/);
assert.match(reports,/this\._reportProfileOptionsV75/);
assert.match(reports,/authorizeExport\(ReportType\.SEASON_DOSSIER/);
assert.match(training,/previewTrainingEvidenceCsvV75/);
assert.match(training,/EXPORT_REPORT/);
// File upload listener belongs to the rendered view lifecycle, never to
// repeated participant-search refreshes (which otherwise stack handlers).
const trainingSearcher=training.slice(training.indexOf("async _refreshTrainingPlayerOptions"),training.indexOf("_renderTrainingForm()"));
const trainingBinder=training.slice(training.indexOf("async _bindEvents(container)"));
assert.doesNotMatch(trainingSearcher,/p360-evidence-file-v75/);
assert.match(trainingBinder,/querySelector\("\.p360-evidence-file-v75"\)/);
assert.match(language,/referenceDictionary:TranslationStore\.defaultDictionary/);
assert.match(passport,/exportPassportComparableTrendCsvV75/);
assert.match(passport,/EXPORT_PLAYER_PASSPORT/);
console.log("PASS V75: training exchange, comparable passport trends, safe language packs, configurable report sections.");
