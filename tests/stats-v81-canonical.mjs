import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BoxScoreCalculator} from "../domain/stats/BoxScoreCalculator.js";
import {canonicalPlayerRow} from "../domain/stats/GameReportMetrics.js";
import {selectScopedPlayerStatsV81,valuationDiscrepancyV81} from "../domain/stats/StatScopeV81.js";
import {StatsEngine} from "../engine/StatsEngine.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

// Known observed box score: PIR (Euroleague/ACB) and FIBA EFF are distinct.
const a={
  game_id:"g1",player_id:"p1",points:8,fg2_made:3,fg2_attempted:5,
  fg3_made:0,fg3_attempted:0,ft_made:2,ft_attempted:3,
  off_reb:2,def_reb:1,assists:2,steals:1,blocks_made:1,blocks:7,
  blocks_received:1,fouls_drawn:2,fouls_received:9,fouls_committed:2,turnovers:1,
  minutes:20,evaluation:123
};
const box=BoxScoreCalculator.calculatePlayerBoxScore(a);
assert.equal(box.pir,10);
assert.equal(box.efficiency,11);
assert.equal(box.blocks,1,"Canonical blocks_made must beat legacy blocks");
assert.equal(box.foulsDrawn,2,"Canonical fouls_drawn must beat duplicate legacy alias");
assert.equal(valuationDiscrepancyV81(a,box.pir).mismatch,true);
assert.equal(valuationDiscrepancyV81({...a,evaluation:10},box.pir).mismatch,false);

// An observed zero must remain zero even when shot counters disagree.
const zero={...a,points:0,fg2_made:1,fg2_attempted:1,ft_made:0,ft_attempted:0};
assert.equal(BoxScoreCalculator.calculatePlayerBoxScore(zero).points,0);
assert.equal(canonicalPlayerRow(zero).points,0);
assert.equal(canonicalPlayerRow(zero).shootingPoints,2);
assert.equal(canonicalPlayerRow(a).id,"p1");
assert.equal(canonicalPlayerRow({id:"stats-row-id"}).id,"","Never use stats primary key as player ID");

const games=[{id:"g1",team_score:8,opponent_score:5,status:"Finalizado"},
  {id:"g2",team_score:0,opponent_score:0,status:"Programado"}];
const outside={...a,game_id:"g2",player_id:"p1",fg2_made:50,fg2_attempted:55,points:100};
assert.deepEqual(selectScopedPlayerStatsV81([a,outside],[games[0]]),[a]);
assert.throws(()=>selectScopedPlayerStatsV81([a,a],[games[0]]),/mismo jugador y partido/);
assert.throws(()=>selectScopedPlayerStatsV81([a],[games[0],games[0]]),/duplicado/);
const metrics=StatsEngine.calculateTeamDashboardKPIs(games,[a,outside]);
assert.equal(metrics.gp,1);
assert.equal(metrics.efg,60,"Other game must not contaminate season");
assert.equal(metrics.ortg,Number((8/(5+0.44*3-2+1)*100).toFixed(1)));
assert.equal(metrics.drtg,null,"Opponent possessions are unknown");
assert.equal(metrics.netRtg,null);
assert.equal(metrics.pace,null);
assert.equal(StatsEngine.calculateTeamDashboardKPIs([{id:"g3",status:"Programado"}],[outside]).efg,null);

const datastore=read("services/DataStore.js");
assert.match(datastore,/storedEvaluation: valuationAudit\.stored/);
assert.match(datastore,/valuationMismatch: valuationAudit\.mismatch/);
assert.match(datastore,/const points = s\.points !== undefined && s\.points !== null/);
const advanced=read("views/AdvancedStatsView.js");
assert.match(advanced,/selectScopedPlayerStatsV81/);
assert.doesNotMatch(advanced,/totOffReb \* 1\.5|totalTeamGamesCount \* 70/);
const dashboard=read("views/SeasonDashboardView.js");
assert.doesNotMatch(dashboard,/Number\(game\.fga \|\| 60\)|\|\| 70/);
const sync=read("services/StatsSyncService.js");
const audit=sync.slice(sync.indexOf("async runFullAuditAndSync("));
assert.match(audit,/dryRun:true/);
assert.doesNotMatch(audit,/\.upsert\(|\.update\(/);
console.log("PASS V81: canonical PIR/EFF, identity scope, zeros, no invented ratings or writes.");
