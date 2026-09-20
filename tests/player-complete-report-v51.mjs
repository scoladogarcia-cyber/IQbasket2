import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderPlayerCompleteBoxScore } from "../views/reports/PlayerCompleteBoxScore.js";
import { loadAuthorizedPlayerSeasonStats, replaceScopedPlayerStatsInMemory } from "../services/reports/PlayerSeasonReadService.js";

const player = { id: "p1", first_name: "Víctor", team_id: "team1" };
const games = [
  { id: "g1", team_id: "team1", team_season_id: "ts26", opponent: "CB Coll", date: "2026-09-19" },
  { id: "g2", team_id: "team1", team_season_id: "ts26", opponent: "Rival B", date: "2026-10-01" }
];
const rows = [
  { player_id: "p1", game_id: "g1", minutes: 13, points: 8, fg2_made: 4, fg2_attempted: 4, fg3_made: 0, fg3_attempted: 0, ft_made: 0, ft_attempted: 0, off_reb: 1, def_reb: 4, assists: 0, steals: 1, turnovers: 1, fouls_committed: 1, fouls_drawn: 1 },
  { player_id: "p1", game_id: "g2", minutes: 20, points: 3, fg2_made: 0, fg2_attempted: 6, fg3_made: 1, fg3_attempted: 2, ft_made: 0, ft_attempted: 0, off_reb: 2, def_reb: 3, assists: 2, steals: 0, turnovers: 1, fouls_committed: 0, fouls_drawn: 2 },
  { player_id: "p1", game_id: "previous", minutes: 40, points: 99, fg2_made: 1, fg2_attempted: 1 },
  { player_id: "other", game_id: "g1", minutes: 40, points: 99, fg2_made: 1, fg2_attempted: 1 }
];
const html = renderPlayerCompleteBoxScore({ player, games, stats: rows });
assert.match(html, /Acta individual completa · tiros de campo y estadísticas/);
assert.match(html, /T2 C\/I/);
assert.match(html, /T3 C\/I/);
assert.match(html, /TC C\/I/);
assert.match(html, /TL C\/I/);
assert.match(html, /4\/10/);
assert.match(html, /1\/2/);
assert.match(html, /5\/12/);
assert.match(html, /41\.7%/);
assert.match(html, /45\.8%/);
assert.match(html, /11 puntos, 33 minutos/);
assert.match(html, /Rebotes y acciones individuales/);
assert.match(html, /VAL FIBA/);
assert.doesNotMatch(html, /99 puntos|99\/|previous/);
assert.match(renderPlayerCompleteBoxScore({ player, games: [games[0]], stats: [rows[0]] }), /N\/D/, "Sin intentos de tres ni TL: N/D, no 0% ficticio");
assert.doesNotMatch(renderPlayerCompleteBoxScore({ player, games, stats: [] }), /0 puntos/, "No fingir acta a cero sin filas");
assert.match(renderPlayerCompleteBoxScore({ player, games: [{ ...games[0], opponent: "<script>alert(1)</script>" }], stats: [rows[0]] }), /&lt;script&gt;/);
assert.throws(() => renderPlayerCompleteBoxScore({ player, games, stats: [rows[0], rows[0]] }), /duplicada/);

let requested = 0;
const db = { from(table) {
  assert.equal(table, "player_game_stats");
  return { select(fields) {
    assert.equal(fields, "*");
    return { in(key, values) {
      if (key === "game_id") { assert.deepEqual(values, ["g1", "g2"]); return this; }
      assert.deepEqual(values, ["p1"]); return this;
    }, range(start, end) { requested++; assert.equal(start, 0); assert.equal(end, 999); return Promise.resolve({ data: rows.slice(0, 2), error: null }); } };
  } };
} };
const policy = { canView(_type, scope) { return scope.playerId === "p1"; } };
const context = { teamId: "team1", teamSeasonId: "ts26" };
const loaded = await loadAuthorizedPlayerSeasonStats({ supabase: db, policy, context, players: [player], games });
assert.equal(requested, 1);
assert.equal(loaded.length, 2);
await assert.rejects(loadAuthorizedPlayerSeasonStats({ supabase: db, policy: { canView:()=>false }, context, players:[player], games }), /sin permiso/);
await assert.rejects(loadAuthorizedPlayerSeasonStats({ supabase: db, policy, context, players:[player], games:[{ ...games[0], team_season_id:"ts25" }] }), /fuera/);
const store = { playerGameStats:[rows[0],rows[2],rows[3]], _normalizeStat: value => ({...value, normalized:true}) };
replaceScopedPlayerStatsInMemory(store, { players:[player], games, stats:loaded });
assert.equal(store.playerGameStats.filter(item=>item.game_id==="g1"&&item.player_id==="p1").length,1);
assert.equal(store.playerGameStats.some(item=>item.game_id==="previous"),true);
assert.equal(store.playerGameStats.some(item=>item.player_id==="other"),true);
assert.equal(store.playerGameStats.filter(item=>item.normalized).length,2);

const view = readFileSync(new URL("../views/ReportsViewV50.js",import.meta.url),"utf8");
assert.match(view,/btn-export-complete-players/);
assert.match(view,/loadAuthorizedPlayerSeasonStats/);
assert.match(view,/ReportType\.PLAYER_STATS/);
assert.match(view,/window\.open\("", "_blank"/);
assert.match(view,/replaceScopedPlayerStatsInMemory/);
assert.match(view,/renderPlayerCompleteBoxScore/);
assert.doesNotMatch(view,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
console.log("PLAYER_COMPLETE_REPORT_V51_OK: T2/T3/TC/TL, porcentajes, actas por partido, totales, temporada, RBAC, RLS y PDF fresco");
