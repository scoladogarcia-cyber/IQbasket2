import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildGameIntelligence } from "../domain/intelligence/GameIntelligenceEngine.js";
import { normalizeGameStatsForIntelligence } from "../domain/intelligence/GameIntelligenceInputAdapter.js";
import { renderGameIntelligencePanel } from "../views/components/GameIntelligencePanelV46.js";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

const mixedShapeStats = [
  { player_id: "secret-p1", first_name: "Ada", fg2Made: 3, fg2Attempted: 5, fg3Made: 2, fg3Attempted: 4, ftMade: 0, ftAttempted: 0, points: 12, assists: 4, turnovers: 2, offReb: 1, defReb: 3, steals: 2, blocksMade: 0, foulsCommitted: 1 },
  { player_id: "secret-p2", last_name: "Lovelace", fg2_made: 2, fg2_attempted: 4, fg3_made: 1, fg3_attempted: 2, ft_made: 1, ft_attempted: 2, points: 8, assists: 3, turnovers: 1, off_reb: 2, def_reb: 2, steals: 1, blocks_made: 0, fouls_committed: 2 },
  { playerId: "secret-p3", fg2_made: 1, fg2_attempted: 3, fg3_made: 1, fg3_attempted: 3, ft_made: 0, ft_attempted: 0, points: 5, ast: 2, tov: 2, rebounds_offensive: 1, rebounds_defensive: 4, stl: 1, blk: 1, fouls: 2 },
  { playerId: "secret-p4", fg2Made: 2, fg2Attempted: 2, fg3Made: 0, fg3Attempted: 0, ftMade: 0, ftAttempted: 0, points: 4, assists: 1, turnovers: 0, offReb: 0, defReb: 2, steals: 0, blocks: 1, foulsCommitted: 1 },
  { player_id: "secret-p5", fg2_made: 0, fg2_attempted: 1, fg3_made: 1, fg3_attempted: 2, ft_made: 0, ft_attempted: 0, points: 3, assists: 0, turnovers: 1, off_reb: 0, def_reb: 1, steals: 0, blocks_made: 0, fouls_committed: 0 }
];

const canonical = normalizeGameStatsForIntelligence(mixedShapeStats);
assert.equal(canonical.length, 5);
assert.equal(canonical[0].fg2_made, 3);
assert.equal(canonical[0].off_reb, 1);
assert.equal(canonical[2].assists, 2);
assert.equal(canonical[2].blocks_made, 1);
assert.equal(canonical.every(row => !("player_id" in row) && !("playerId" in row)), true);
assert.equal(canonical.every(row => !("first_name" in row) && !("last_name" in row)), true);

const intelligence = buildGameIntelligence({ playerStats: canonical });
assert.equal(intelligence.snapshot.metrics.points, 32);
assert.equal(intelligence.snapshot.metrics.points_consistency_delta, 0);
assert.equal(intelligence.snapshot.metrics.fg2_pct, 53.33);
assert.equal(intelligence.snapshot.metrics.fg3_pct, 45.45);
assert.equal(intelligence.snapshot.metrics.effective_fg_pct, 59.62);
assert.equal(intelligence.snapshot.metrics.total_reb, 16);

const html = renderGameIntelligencePanel({ intelligence });
assert.match(html, /id="game-intelligence-v46"/);
assert.match(html, /aria-labelledby="game-intelligence-v46-title"/);
assert.match(html, /data-intelligence-mode="DESCRIPTIVE_ONLY"/);
assert.match(html, /Lectura del partido/);
assert.match(html, /2P:<\/strong> 8\/15 · 53\.3%/);
assert.match(html, /3P:<\/strong> 5\/11 · 45\.5%/);
assert.match(html, /TL:<\/strong> 1\/2 · <span>muestra limitada<\/span>/);
assert.match(html, /eFG%:<\/strong> 59\.6%/);
assert.match(html, /AST\/PER:<\/strong> 1\.67/);
assert.match(html, /REB:<\/strong> 16/);
assert.doesNotMatch(html, /50\.0%/i, "V46 no debe convertir una muestra TL baja en falsa precisión visual.");
assert.doesNotMatch(html, /secret-p[1-5]|Ada|Lovelace/);
assert.doesNotMatch(html, /mejor jugadora|peor jugadora|diagn[oó]stico/i);
assert.match(html, /no clasifica jugadoras ni establece causas/i);

const limited = buildGameIntelligence({
  playerStats: normalizeGameStatsForIntelligence([
    { player_id: "hidden-player-id", points: 10, fg2_made: 1, fg2_attempted: 2, fg3_made: 1, fg3_attempted: 2 }
  ])
});
const limitedHtml = renderGameIntelligencePanel({ intelligence: limited });
assert.match(limitedHtml, /role="status"/);
assert.match(limitedHtml, /Revisar datos/);
assert.match(limitedHtml, /no coinciden con los puntos derivados/i);
assert.doesNotMatch(limitedHtml, /hidden-player-id/);

const emptyHtml = renderGameIntelligencePanel({
  intelligence: buildGameIntelligence({ playerStats: [] })
});
assert.match(emptyHtml, /Todavía no hay un BoxScore guardado suficiente/);
assert.doesNotMatch(emptyHtml, /NaN|undefined/);

const [entrySource, baseSource, enhancerSource, adapterSource, presenterSource, releaseText] = await Promise.all([
  read("views/GameBoxScoreView.js"),
  read("views/GameBoxScoreBaseView.js"),
  read("views/games/GameBoxScoreIntelligenceV46View.js"),
  read("domain/intelligence/GameIntelligenceInputAdapter.js"),
  read("views/components/GameIntelligencePanelV46.js"),
  read("release.json")
]);

assert.match(entrySource, /GameBoxScoreIntelligenceV46View as GameBoxScoreView/);
assert.match(baseSource, /Permission\.EDIT_BOXSCORE/);
assert.match(baseSource, /GameLockService\.isLocked/);
assert.match(baseSource, /DataStore\.saveGameAndStats/);
assert.match(enhancerSource, /super\._renderGameBoxScoreDetail/);
assert.match(enhancerSource, /buildGameIntelligence/);
assert.match(enhancerSource, /normalizeGameStatsForIntelligence/);
assert.match(enhancerSource, /insertAdjacentHTML\("beforebegin"/);
assert.doesNotMatch(enhancerSource, /\.from\(|\.rpc\(|fetch\(/i, "La extensión read-only no puede abrir una vía de datos paralela.");
assert.doesNotMatch(presenterSource, /\.from\(|\.rpc\(|fetch\(/i);
assert.doesNotMatch(adapterSource, /player_id|playerId|first_name|last_name/, "El adaptador no debe transportar identificadores ni nombres.");

const release = JSON.parse(releaseText);
const baselineRelease = "2026.09.08.29";
const parts = value => String(value || "").split(".").map(part => Number(part) || 0);
const compare = (left, right) => {
  const a = parts(left);
  const b = parts(right);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return 1;
    if ((a[i] || 0) < (b[i] || 0)) return -1;
  }
  return 0;
};
assert.ok(compare(release.release, baselineRelease) >= 0, "La release V46 no puede retroceder.");
if (release.release === baselineRelease) {
  assert.equal(release.label, "game-intelligence-panel-v46");
}

console.log("V46 game intelligence panel contract OK");
