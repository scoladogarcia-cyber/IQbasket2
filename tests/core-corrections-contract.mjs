import assert from "node:assert/strict";
import fs from "node:fs";

import { PermissionService, Permission, UserRole } from "../security/PermissionService.js";
import { BoxScoreCorrectionService } from "../services/games/BoxScoreCorrectionService.js";

const trainingView=fs.readFileSync(new URL("../views/TrainingView.js",import.meta.url),"utf8");
const player360View=fs.readFileSync(new URL("../views/Player360View.js",import.meta.url),"utf8");
const boxscoreView=fs.readFileSync(new URL("../views/GameBoxScoreView.js",import.meta.url),"utf8");

assert.match(trainingView,/p360-edit-session/);
assert.match(trainingView,/p360-edit-external/);
assert.match(trainingView,/updateSession\(/);
assert.match(trainingView,/updateExternalDevelopment\(/);
assert.match(trainingView,/data-confirmed-participant/);
assert.match(trainingView,/Asistencia confirmada/);
assert.match(trainingView,/data-block-id/);

assert.match(player360View,/id: "nutrition", label: "🥤 Nutrición"/);
assert.match(player360View,/id: "recovery", label: "🌙 Recuperación"/);
assert.doesNotMatch(player360View,/id: "wellness", label: "🌱 Apoyo"/);

function auth(role,email="role@example.test") {
  return new PermissionService({
    id:"user-"+role,
    email,
    role,
    assigned_team_ids:["team-1"],
    allowed_team_season_ids:["ts-1"]
  });
}
assert.equal(auth(UserRole.SUPERADMIN,"scolado@nechigroup.com").can(Permission.EDIT_BOXSCORE),true);
assert.equal(auth(UserRole.ADMIN).can(Permission.EDIT_BOXSCORE),true);
assert.equal(auth(UserRole.ENTRENADOR).can(Permission.EDIT_BOXSCORE),true);
assert.equal(auth(UserRole.ANALISTA).can(Permission.EDIT_BOXSCORE),true);
assert.equal(auth(UserRole.INVITADO,"test@test.com").can(Permission.EDIT_BOXSCORE),false);

const calls=[];
const service=new BoxScoreCorrectionService({
  async rpc(name,args) {
    calls.push({name,args});
    return {data:{game_id:args.p_game_id,updated_players:args.p_stats.length},error:null};
  }
});
const result=await service.saveManualBoxScore({
  gameId:"game-1",
  starterIds:["player-1"],
  stats:[{
    player_id:"player-1",
    starter:true,
    minutes:20,
    fg2_made:3,
    fg2_attempted:5,
    fg3_made:1,
    fg3_attempted:2,
    ft_made:2,
    ft_attempted:2
  }]
});
assert.equal(result.updated_players,1);
assert.equal(calls[0].name,"iq_v7_save_manual_boxscore");
assert.deepEqual(calls[0].args.p_starter_ids,["player-1"]);
assert.equal(calls[0].args.p_stats[0].points,0);

assert.match(boxscoreView,/Permission\.EDIT_BOXSCORE/);
assert.match(boxscoreView,/_hasPlayByPlay/);
assert.match(boxscoreView,/PLAY_BY_PLAY_SOURCE/);
assert.match(boxscoreView,/Corregir Play-by-Play/);
assert.match(boxscoreView,/window\.location\.hash = `#\/game\/\$\{currentGame\.id\}`/);
assert.match(boxscoreView,/saveManualBoxScore/);
assert.match(boxscoreView,/height: 44px !important/);
assert.doesNotMatch(
  boxscoreView,
  /_canEdit\(\)\s*\{[\s\S]{0,120}return false/,
  "Boxscore no puede volver a quedar deshabilitado globalmente."
);

console.log("CORE_CORRECTIONS_CONTRACT_OK");
