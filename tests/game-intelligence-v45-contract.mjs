import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  aggregateTeamGameStats,
  buildGameIntelligence
} from "../domain/intelligence/GameIntelligenceEngine.js";
import {
  assertEvidenceAllowedForAi,
  getEvidenceModules,
  sanitizeEvidenceForAiProvider
} from "../config/player360-ai-gateway.config.js";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

const playerStats = [
  { player_id: "p1", points: 12, fg2_made: 3, fg2_attempted: 5, fg3_made: 2, fg3_attempted: 4, ft_made: 0, ft_attempted: 0, assists: 4, turnovers: 2, off_reb: 1, def_reb: 3, steals: 2, blocks_made: 0, fouls_committed: 1 },
  { player_id: "p2", points: 8, fg2_made: 2, fg2_attempted: 4, fg3_made: 1, fg3_attempted: 2, ft_made: 1, ft_attempted: 2, assists: 3, turnovers: 1, off_reb: 2, def_reb: 2, steals: 1, blocks_made: 0, fouls_committed: 2 },
  { player_id: "p3", points: 5, fg2_made: 1, fg2_attempted: 3, fg3_made: 1, fg3_attempted: 3, ft_made: 0, ft_attempted: 0, assists: 2, turnovers: 2, off_reb: 1, def_reb: 4, steals: 1, blocks_made: 1, fouls_committed: 2 },
  { player_id: "p4", points: 4, fg2_made: 2, fg2_attempted: 2, fg3_made: 0, fg3_attempted: 0, ft_made: 0, ft_attempted: 0, assists: 1, turnovers: 0, off_reb: 0, def_reb: 2, steals: 0, blocks: 1, fouls_committed: 1 },
  { player_id: "p5", points: 3, fg2_made: 0, fg2_attempted: 1, fg3_made: 1, fg3_attempted: 2, ft_made: 0, ft_attempted: 0, assists: 0, turnovers: 1, off_reb: 0, def_reb: 1, steals: 0, blocks_made: 0, fouls_committed: 0 }
];

const metrics = aggregateTeamGameStats(playerStats);
assert.equal(metrics.tracked_players, 5);
assert.equal(metrics.points, 32);
assert.equal(metrics.derived_points, 32);
assert.equal(metrics.points_consistency_delta, 0);
assert.equal(metrics.fg2_made, 8);
assert.equal(metrics.fg2_attempted, 15);
assert.equal(metrics.fg2_pct, 53.33);
assert.equal(metrics.fg3_made, 5);
assert.equal(metrics.fg3_attempted, 11);
assert.equal(metrics.fg3_pct, 45.45);
assert.equal(metrics.effective_fg_pct, 59.62);
assert.equal(metrics.ft_made, 1);
assert.equal(metrics.ft_attempted, 2);
assert.equal(metrics.assists, 10);
assert.equal(metrics.turnovers, 6);
assert.equal(metrics.assist_turnover_ratio, 1.67);
assert.equal(metrics.total_reb, 16);
assert.equal(metrics.blocks, 2, "blocks_made debe prevalecer y blocks funcionar como fallback legacy.");

const first = buildGameIntelligence({ playerStats });
const second = buildGameIntelligence({ playerStats: structuredClone(playerStats) });
assert.deepEqual(second, first, "La misma evidencia debe producir exactamente la misma inteligencia.");
assert.equal(first.snapshot.contract_version, "GAME_INTELLIGENCE_V1");
assert.equal(first.snapshot.interpretation_mode, "DESCRIPTIVE_ONLY");
assert.equal(first.snapshot.quality_status, "OBSERVED");
assert.equal(first.snapshot.safeguards.causalClaimsAllowed, false);
assert.equal(first.snapshot.safeguards.playerRankingAllowed, false);
assert.equal(first.snapshot.safeguards.teammateComparisonAllowed, false);

const factsByKey = new Map(first.evidenceBundle.facts.map(fact => [fact.metric_key, fact]));
assert.equal(factsByKey.get("competition.game.fg2_pct").last_value, 53.33);
assert.equal(factsByKey.get("competition.game.fg3_pct").last_value, 45.45);
assert.equal(factsByKey.get("competition.game.effective_fg_pct").last_value, 59.62);
assert.equal(factsByKey.get("competition.game.assist_turnover_ratio").last_value, 1.67);
assert.equal(factsByKey.has("competition.game.ft_pct"), false, "Una muestra baja no debe convertirse en una tasa interpretable.");
assert.equal(
  first.evidenceBundle.missing_data.some(item => item.metric_key === "competition.game.ft_pct" && item.reason === "LOW_SAMPLE"),
  true
);
assert.equal(first.evidenceBundle.facts.every(fact => fact.causal_claim_allowed === false), true);
assert.deepEqual(getEvidenceModules(first.evidenceBundle), ["competition"]);
assert.doesNotThrow(() => assertEvidenceAllowedForAi(first.evidenceBundle));

const providerEvidence = sanitizeEvidenceForAiProvider(first.evidenceBundle);
const serializedProviderEvidence = JSON.stringify(providerEvidence);
for (const secretPlayerId of playerStats.map(row => row.player_id)) {
  assert.equal(serializedProviderEvidence.includes(secretPlayerId), false, "La evidencia de proveedor no puede contener IDs de jugadora.");
}
assert.equal(serializedProviderEvidence.includes("player_id"), false);
assert.equal(serializedProviderEvidence.includes("first_name"), false);
assert.equal(serializedProviderEvidence.includes("last_name"), false);

const noData = buildGameIntelligence({ playerStats: [] });
assert.equal(noData.snapshot.quality_status, "NO_DATA");
assert.equal(noData.evidenceBundle.facts.length, 0);
assert.equal(noData.evidenceBundle.missing_data[0].reason, "NO_PLAYER_GAME_STATS");
assert.doesNotThrow(() => assertEvidenceAllowedForAi(noData.evidenceBundle));

const inconsistent = buildGameIntelligence({
  playerStats: [{ points: 10, fg2_made: 1, fg2_attempted: 2, fg3_made: 1, fg3_attempted: 2, ft_made: 0, ft_attempted: 0 }]
});
assert.equal(inconsistent.snapshot.quality_status, "LIMITED");
assert.equal(inconsistent.snapshot.limitations.includes("BOX_SCORE_POINTS_MISMATCH"), true);
assert.equal(
  inconsistent.evidenceBundle.missing_data.some(item => item.reason === "BOX_SCORE_POINTS_MISMATCH"),
  true
);

const [engineSource, configSource, releaseText] = await Promise.all([
  read("domain/intelligence/GameIntelligenceEngine.js"),
  read("config/game-intelligence.config.js"),
  read("release.json")
]);
assert.doesNotMatch(engineSource, /fetch\(|supabase|\.from\(|\.rpc\(/i, "El dominio V45 no debe llamar a red ni persistencia.");
assert.doesNotMatch(configSource, /api[_-]?key|secret|openai|anthropic/i, "La configuración V45 no contiene secretos ni proveedor concreto.");
assert.match(engineSource, /evidence_version/);
assert.match(configSource, /PLAYER360_EVIDENCE_V1/);
assert.match(configSource, /playerRankingAllowed:\s*false/);
assert.match(configSource, /teammateComparisonAllowed:\s*false/);
assert.match(configSource, /causalClaimsAllowed:\s*false/);

const release = JSON.parse(releaseText);
const baselineRelease = "2026.09.08.28";
const parts = value => String(value || "").split(".").map(part => Number(part) || 0);
const compare = (left, right) => {
  const aParts = parts(left);
  const bParts = parts(right);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i += 1) {
    if ((aParts[i] || 0) > (bParts[i] || 0)) return 1;
    if ((aParts[i] || 0) < (bParts[i] || 0)) return -1;
  }
  return 0;
};
assert.ok(compare(release.release, baselineRelease) >= 0, "La release V45 no puede retroceder.");
if (release.release === baselineRelease) {
  assert.equal(release.label, "game-intelligence-foundation-v45");
}

console.log("V45 game intelligence foundation contract OK");
