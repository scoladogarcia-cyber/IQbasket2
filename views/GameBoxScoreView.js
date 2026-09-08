/**
 * @fileoverview Stable public entry point for GameBoxScoreView.
 * @description V46 keeps every existing consumer on this path while composing
 * the original implementation with the read-only game-intelligence extension.
 * The preserved implementation lives in GameBoxScoreBaseView.js unchanged.
 */

export {
  GameBoxScoreIntelligenceV46View as GameBoxScoreView,
  GameBoxScoreIntelligenceV46View as default
} from "./games/GameBoxScoreIntelligenceV46View.js";
