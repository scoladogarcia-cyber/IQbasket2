import assert from "node:assert/strict";
import { GameCaptureDelegationService } from "../services/games/GameCaptureDelegationService.js";
const gameId = "11111111-1111-4111-8111-111111111111";
const player = "22222222-2222-4222-8222-222222222222";
const stats = [{ player_id: player, minutes: 32, points: 11, plus_minus: -7 }];
const calls = [];
const snapshot = { game: { id: gameId, team_score: 70, opponent_score: 62, starter_ids: [player] }, stats };
const service = new GameCaptureDelegationService({ rpc: async (name, args) => {
  calls.push({ name, args });
  return { data: snapshot, error: null };
}});
assert.deepEqual(await service.saveBoxScore({ gameId, starterIds: [player], stats }), snapshot);
assert.deepEqual(calls, [{ name: "iq_v28_save_game_capture", args: {
  p_game_id: gameId, p_team_score: null, p_opponent_score: null, p_starter_ids: [player],
  p_stats: stats, p_periods: null, p_events: null, p_lease_token: null
}}]);
for (const message of ["GAME_CAPTURE_GAME_LOCKED","GAME_CAPTURE_SEASON_FROZEN","GAME_CAPTURE_WRITE_DENIED","GAME_LIVE_LEASE_REQUIRED","RPC unavailable"]) {
  let writes = 0;
  const denied = new GameCaptureDelegationService({ rpc: async () => {
    writes++;
    return { data: null, error: { code: message === "RPC unavailable" ? "PGRST202" : "42501", message } };
  }});
  await assert.rejects(() => denied.saveBoxScore({ gameId, starterIds: [player], stats }));
  assert.equal(writes, 1, "No fallback write after backend rejection");
}
console.log("BOXSCORE_PARTIAL_RPC_OK");
