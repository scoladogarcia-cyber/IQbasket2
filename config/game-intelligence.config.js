/**
 * @fileoverview Configuration contract for deterministic post-game intelligence.
 * @description Contains only evidence-quality thresholds and contract versions.
 * Performance benchmarks belong to versioned competition profiles, never here.
 */

export const GAME_INTELLIGENCE_CONFIG = Object.freeze({
  contractVersion: "GAME_INTELLIGENCE_V1",
  calculationVersion: "GAME_INTELLIGENCE_2026_09_V1",
  evidenceVersion: "PLAYER360_EVIDENCE_V1",
  interpretationMode: "DESCRIPTIVE_ONLY",
  minimumEvidence: Object.freeze({
    fieldGoalAttemptsForPercentage: 5,
    freeThrowAttemptsForPercentage: 4,
    assistTurnoverActionsForRatio: 4
  }),
  safeguards: Object.freeze({
    causalClaimsAllowed: false,
    playerRankingAllowed: false,
    teammateComparisonAllowed: false
  })
});

export default GAME_INTELLIGENCE_CONFIG;
