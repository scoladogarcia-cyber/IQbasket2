import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGameReportMetrics, formatMetric } from "../domain/stats/GameReportMetrics.js";
import { buildGameShotMaps } from "../domain/analytics/GameReportShotMaps.js";
import { renderFinalGameReport } from "../views/reports/GameFinalReportRenderer.js";

const id = "b91d2b4a-5cd7-4f0e-854c-fbecda9e6cce";
const game = { id, venue: "Visitante", opponent: "CB Coll", team_score: 52, opponent_score: 46, periods_count: 4, period_minutes: 10 };
const rows = [
  { player_id: "p1", minutes: 25, fg2_made: 4, fg2_attempted: 10, fg3_made: 1, fg3_attempted: 2, turnovers: 6, off_reb: 3, def_reb: 7, assists: 1 },
  { player_id: "p2", minutes: 30, fg2_made: 8, fg2_attempted: 16, fg3_made: 0, fg3_attempted: 1, turnovers: 2, off_reb: 4, def_reb: 5, assists: 2 },
  { player_id: "p3", minutes: 0, fg2_made: 0, fg2_attempted: 0, turnovers: 0 },
  { player_id: "p4", minutes: 30, fg2_made: 2, fg2_attempted: 6, turnovers: 4 },
  { player_id: "p5", minutes: 30, fg2_made: 2, fg2_attempted: 11, fg3_made: 1, fg3_attempted: 1, ft_made: 1, ft_attempted: 4, turnovers: 5 },
  { player_id: "p6", minutes: 30, fg2_made: 4, fg2_attempted: 4, turnovers: 1 },
  { player_id: "p7", minutes: 30, fg2_made: 2, fg2_attempted: 10, ft_made: 1, ft_attempted: 2, turnovers: 2 },
  { player_id: "p8", minutes: 25, fg2_made: 0, fg2_attempted: 3, turnovers: 3 }
];
const metrics = buildGameReportMetrics(rows, game);
assert.equal(metrics.totals.points, 52);
assert.equal(metrics.totals.minutes, 200);
assert.equal(metrics.rows[2].usage, null, "0 minutos nunca es USG 0 ni 18,5%");
assert.notEqual(metrics.rows[0].usage, metrics.rows[1].usage, "USG individual no puede ser un fallback fijo");
assert.equal(metrics.totals.usage, 100);
assert.equal(formatMetric(null, "%"), "N/D");
assert.equal(metrics.warnings.length, 0);
assert.ok(metrics.totals.estimatedPossessions > 0);
const events = [
  { game_id: id, action_type: "fg2_made", points: 2, made: true, coord_x: 45, coord_y: 18 },
  { game_id: id, action_type: "fg2_attempted", made: false, coord_x: 60, coord_y: 22 },
  { game_id: id, action_type: "opp_pts", points: 3, made: true, coord_x: 70, coord_y: 50 },
  { game_id: id, action_type: "opp_pts", points: 2, made: true, coord_x: null, coord_y: null },
  { game_id: "other", action_type: "fg2_made", made: true, coord_x: 10, coord_y: 10 }
];
const maps = buildGameShotMaps(events, id);
assert.equal(maps.our.located, 2);
assert.equal(maps.opponent.located, 1);
assert.equal(maps.opponent.completeOutcomes, false);
const html = renderFinalGameReport({ game: { ...game, opponent: "<script>evil</script>" }, teamName: "JMJ Manyanet", stats: rows, players: rows.map((row, index) => ({ id: row.player_id, first_name: `Jugador ${index}`, jersey: index })), events, periods: [{ period_number: 1, team_score: 12, opponent_score: 11 }], eventsAvailable: true });
assert.ok(html.includes("46 – 52 JMJ Manyanet"), "El marcador visitante sigue orden local–visitante");
assert.ok(html.includes("Acta individual completa"));
assert.ok(html.includes("Nuestros tiros"));
assert.ok(html.includes("Rival: mapa de canastas registradas"));
assert.ok(html.includes("N/D"));
assert.ok(html.includes("&lt;script&gt;evil&lt;/script&gt;"));
assert.ok(!html.includes("<script>evil</script>"));
const source = readFileSync(new URL("../views/games/GameBoxScoreIntelligenceV46View.js", import.meta.url), "utf8");
assert.ok(source.includes("_refreshUsageCells"));
assert.ok(source.includes("loadAuthorizedFinalGameReport"));
assert.ok(source.includes("authorizeExport"));
assert.doesNotMatch(source, /\.from\(|\.rpc\(|fetch\(/i, "Ninguna consulta paralela en V46");
console.log("FINAL_GAME_REPORT_V48_OK: visitor scoreboard, player usage, zero-vs-NA, real own/opponent maps, print authorization");
