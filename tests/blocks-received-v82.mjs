import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BoxScoreCalculator} from "../domain/stats/BoxScoreCalculator.js";
import {blockedShotsIntegrityV82} from "../domain/stats/BlockedShotIntegrityV82.js";
import {projectPbpCounters,buildPlayerStatBaselines,projectLivePlayerStats} from "../domain/games/LiveCaptureStatsProjector.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const score={game_id:"g",player_id:"p",fg2_made:2,fg2_attempted:4,
 fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,points:4,
 blocks_made:0,blocks_received:0};
assert.equal(BoxScoreCalculator.calculatePlayerBoxScore(score).pir,2);
assert.equal(BoxScoreCalculator.calculatePlayerBoxScore({...score,blocks_received:1}).pir,1,
 "Received blocks subtract exactly one PIR point");
assert.equal(BoxScoreCalculator.calculatePlayerBoxScore({...score,blocks_received:1}).efficiency,2,
 "FIBA EFF differs from PIR; received block must not also subtract from EFF");
assert.equal(blockedShotsIntegrityV82({...score,blocks_received:2}).valid,true);
assert.throws(()=>blockedShotsIntegrityV82({...score,blocks_received:3}),/tiro de campo fallado/);
assert.throws(()=>blockedShotsIntegrityV82({...score,fg2_made:5}),/superar los intentados/);
assert.throws(()=>blockedShotsIntegrityV82({...score,blocks_received:-1}),/entero no negativo/);
assert.throws(()=>blockedShotsIntegrityV82({...score,blocks_received:1.5}),/entero no negativo/);
const existing={...score,fg2_attempted:2,blocks_received:1};
const unchanged=blockedShotsIntegrityV82({...existing},existing);
assert.equal(unchanged.legacyUnresolved,true,"Uncorrected legacy values must remain intact");
assert.throws(()=>blockedShotsIntegrityV82({...existing,blocks_received:2},existing),/tiro de campo fallado/);
const events=[
 {action_type:"fg2_attempted",player_id:"p"},
 {action_type:"blocks_received",player_id:"p"},
 {action_type:"blocks_made",player_id:"p"}
];
const projected=projectPbpCounters(events).get("p");
assert.equal(projected.blocks_received,1);
assert.equal(projected.blocks_made,1);
assert.equal(projected.fg2_attempted,1,
 "A block received event must not increment FGA again (prevent double counting)");
assert.equal(projected.blocks,1);
const baseline=buildPlayerStatBaselines([{player_id:"p",blocks_received:3,fg2_attempted:4}],events);
assert.equal(baseline.get("p").blocks_received,2,"Unattributed historical blocks remain as baseline");
const rows=projectLivePlayerStats({roster:[{id:"p"}],events,baselines:baseline});
assert.equal(rows[0].blocks_received,3,"Reopening a game must preserve previous blocked shots");

for(const path of ["views/GameBoxScoreBaseView.js","views/EasyStatsEntryView.js","views/GameLiveEditorView.js"]){
 const src=read(path);
 assert.match(src,/data-field="blocks_received"/,path+" received-block input missing");
 assert.match(src,/blocks_received: valTapReceived/,path+" PIR payload missing");
}
const box=read("views/GameBoxScoreBaseView.js"),easy=read("views/EasyStatsEntryView.js");
for(const [source,path] of [[box,"BoxScore"],[easy,"Acta"]]){
 assert.match(source,/blocks_received: getInpVal\("blocks_received"\)/,path+" save missing");
 assert.match(source,/const blkr = getVal\("blocks_received"\)/,path+" live PIR missing");
}
const live=read("views/GameLiveEditorView.js");
assert.match(live,/data-action="blocks_received"/);
assert.match(live,/blocks_received: 0/);
const hud=read("views/LiveScoreHUDViewV44.js");
assert.match(hud,/st\.blkReceived = statNumber\(row\.blocks_received\)/);
assert.match(hud,/blocks_received: st\.blkReceived/);
const player=read("views/PlayerStatsView.js");
assert.match(player,/totBlkReceived \+= c\.blocksReceived/);
assert.doesNotMatch(player,/19\.5%|14\.2%|8\.8%/,"No fake player ratios");
const store=read("services/DataStore.js");
assert.match(store,/blockedShotsIntegrityV82\(stat,existingStatsByPlayer/);
assert.match(store,/if \(formattedEvents\.length > 0\) \{/);
assert.match(store,/if \(formattedStats\.length > 0\) \{/);
assert.match(store,/this\.gameEvents=priorLocalState\.gameEvents/);
console.log("PASS V82: blocked shots received, PIR/EFF, live event projector, UI bindings and non-destructive caches.");
