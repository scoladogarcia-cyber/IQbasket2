import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMinutesFromSegments,
  expectedTeamMinutes,
  validateDirectMinutes
} from "../domain/games/GameMinutesRecovery.js";

const game = { id:"game-1", periods_count:4, period_minutes:10, overtime_count:0 };
const players = ["a","b","c","d","e","f","g","h","i","j"];
assert.equal(expectedTeamMinutes(game), 200);

const segments = [
  { period:1,start_clock:"10:00",end_clock:"05:00",on_court:["a","b","c","d","e"] },
  { period:1,start_clock:"05:00",end_clock:"00:00",on_court:["a","b","c","f","g"] },
  { period:2,start_clock:"10:00",end_clock:"00:00",on_court:["d","e","f","g","h"] },
  { period:3,start_clock:"10:00",end_clock:"00:00",on_court:["a","b","c","i","j"] },
  { period:4,start_clock:"10:00",end_clock:"00:00",on_court:["d","e","h","i","j"] }
];
const recovery = buildMinutesFromSegments({segments,playerIds:players,game});
assert.equal(recovery.totalSeconds, 200 * 60);
assert.equal(recovery.minutes.reduce((sum,row)=>sum+row.minutes,0), 200);
assert.equal(recovery.lineups.length, 5);
assert.deepEqual(recovery.minutes.map(row=>row.player_id).sort(), players);

const direct = validateDirectMinutes(
  recovery.minutes.map(row=>({player_id:row.player_id,minutes:row.minutes})),
  game
);
assert.equal(direct.valid,true);
assert.equal(direct.total,200);

assert.throws(
  ()=>buildMinutesFromSegments({
    segments:[{period:1,start_clock:"09:00",end_clock:"00:00",on_court:["a","b","c","d","e"]}],
    playerIds:players,
    game
  }),
  /Q1 debe empezar/
);

const service = await readFile(new URL("../services/games/GameMinutesRecoveryService.js",import.meta.url),"utf8");
const panel = await readFile(new URL("../views/games/GameMinutesRecoveryPanelV63.js",import.meta.url),"utf8");
const boxscore = await readFile(new URL("../views/games/GameBoxScoreIntelligenceV46View.js",import.meta.url),"utf8");
const migration = await readFile(new URL("../supabase/migrations/20261013163000_v63_game_minutes_recovery.sql",import.meta.url),"utf8");

assert.match(service,/iq_v63_save_game_minutes_recovery/);
assert.match(panel,/Minutos directos/);
assert.match(panel,/Quintetos por tramos/);
assert.match(panel,/No modifica puntos, tiros, rebotes, faltas, marcador ni jugadas/);
assert.match(panel,/_lockGeneralSave/);
assert.match(panel,/Guarda el minutaje en el panel abierto/);
assert.match(panel,/servidor no confirmó el total reglamentario/i);
assert.match(boxscore,/GameMinutesRecoveryPanelV63/);
assert.match(boxscore,/_canEdit\(game\)/);
assert.match(boxscore,/data-field="minutes"/);
assert.match(boxscore,/Guardar otros cambios/);
assert.match(boxscore,/generalSaveButton/);

assert.match(migration,/game_minutes_recovery_audit/);
assert.match(migration,/iq_private\.can_mutate_game\(p_game_id\)/);
assert.match(migration,/has_capability\(p_game_id,'EDIT_BOXSCORE'\)/);
assert.match(migration,/GAME_MINUTES_RECOVERY_LOCKED/);
assert.match(migration,/GAME_MINUTES_RECOVERY_SEASON_FROZEN/);
assert.match(migration,/update public\.player_game_stats s\s+set minutes=/i);
assert.doesNotMatch(migration,/set\s+(points|fg2_made|fg3_made|ft_made|assists|turnovers)\s*=/i);
assert.doesNotMatch(migration,/update\s+public\.games\s+set/i);
assert.doesNotMatch(migration,/delete\s+from\s+public\.game_events/i);
assert.match(migration,/v_after_total<>v_expected/);
assert.match(migration,/revoke all on table public\.game_minutes_recovery_audit from anon, authenticated/i);

console.log("V63 game minutes recovery: isolated, validated, audited and lineup-aware OK");
