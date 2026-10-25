import assert from "node:assert/strict";
import fs from "node:fs";
import {parseBoxScoreCsv} from "../services/reports/BoxScoreExchangeV53.js";
import {adaptFederationCsv} from "../services/reports/FederationCsvAdapterV70.js";
import {createFederationWorksheetV72,FEDERATION_TEMPLATE_HEADERS_V72} from "../services/reports/FederationWorksheetV72.js";
import {guideFamilyV72,guideCoachV72,renderGuidedCoachV72,renderGuidedFamilyV72} from "../domain/insights/GuidedSummaryV72.js";
import {BoxScoreCalculator} from "../domain/stats/BoxScoreCalculator.js";

const game={id:"g1",team_id:"team",team_season_id:"season",team_score:2};
const eligiblePlayers=[{id:"one",jersey:5,first_name:"Jugador",last_name:"Uno"},{id:"two",jersey:8,first_name:"Jugador",last_name:"Dos"}];
const stats=[
 {game_id:"g1",player_id:"one",starter:true,minutes:12,points:2,fg2_made:1,fg2_attempted:1,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,off_reb:0,def_reb:1,assists:1,steals:0,blocks:0,turnovers:0,fouls_committed:0,fouls_drawn:0},
 {game_id:"g1",player_id:"two",starter:false,minutes:0,points:0,fg2_made:0,fg2_attempted:0,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,off_reb:0,def_reb:0,assists:0,steals:null,blocks:0,turnovers:0,fouls_committed:0,fouls_drawn:0}
];
const worksheet=createFederationWorksheetV72({game,eligiblePlayers,stats});
assert.equal(worksheet.rows,2);
assert.equal(worksheet.missingCells,1);
const matrix=parseBoxScoreCsv(worksheet.content);
assert.deepEqual(matrix[0],FEDERATION_TEMPLATE_HEADERS_V72);
assert.equal(matrix[2][3],"0"); // Actually recorded score zero.
assert.equal(matrix[2][15],"0"); // Actual turnover zero.
assert.equal(matrix[2][13],""); // Steal never recorded -> blank, not 0.
assert.throws(()=>adaptFederationCsv(matrix,{game,eligiblePlayers,stats}),/ausente/);
matrix[2][13]="0";
assert.equal(adaptFederationCsv(matrix,{game,eligiblePlayers,stats})[2][2],"two");
assert.throws(()=>createFederationWorksheetV72({game,eligiblePlayers:[eligiblePlayers[0]],stats}),/correspondencia/);
assert.throws(()=>createFederationWorksheetV72({game:{...game,team_season_id:null},eligiblePlayers,stats}),/autorizadas/);

const coaching=guideCoachV72([{game,stats}]);
assert.equal(coaching.gameCount,1);
assert.match(coaching.observations.join(" "),/1 partido/);
assert.match(coaching.limits,/no determina causas/);
assert.match(renderGuidedCoachV72(coaching),/entrenadores/);
assert.throws(()=>guideCoachV72([{game,stats},{game:{...game,id:"g2",team_id:"other"},stats}]),/diferentes/);
const family=guideFamilyV72({home:{evolution:"Faltan datos de tiro",nextAction:"NO",next:"Prueba el pase"},hasVerifiedObjective:false});
assert.match(family.nextAction,/Pregunta/);
assert.doesNotMatch(renderGuidedFamilyV72({...family,conversation:"<script>alert(1)</script>"}),/<script>/);
const observed=BoxScoreCalculator.calculatePlayerBoxScore({points:0,fg2_made:1,fg2_attempted:1,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,assists:3,turnovers:0});
assert.equal(observed.points,0);
assert.equal(observed.astTo,null);
assert.equal(observed.usageRate,null);
const empty=BoxScoreCalculator.calculatePlayerBoxScore({points:0,fg2_made:0,fg2_attempted:0,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0});
assert.equal(empty.eFG,null);
assert.equal(empty.tsPct,null);
assert.equal(empty.fg2Pct,0); // Legacy primitive; reporting must use observedRate(null/0) instead.
const report=fs.readFileSync(new URL("../views/ReportsViewV53.js",import.meta.url),"utf8");
const familyHome=fs.readFileSync(new URL("../views/family/FamilyHomeV70.js",import.meta.url),"utf8");
assert.match(report,/createFederationWorksheetV72/);
assert.match(report,/_exportFederationTemplate/);
assert.match(report,/renderGuidedCoachV72/);
assert.match(familyHome,/renderGuidedFamilyV72/);
console.log("V72: editable templates, explicit zero, secure summaries and coach/family integration OK.");
