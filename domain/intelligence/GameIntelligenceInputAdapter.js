/**
 * @fileoverview Privacy-preserving adapter for game intelligence inputs.
 * @description Converts current and legacy BoxScore field aliases to the
 * canonical snake_case contract consumed by GameIntelligenceEngine. Identity,
 * roster and resource identifiers are deliberately discarded at this boundary.
 */

const FIELD_ALIASES = Object.freeze({
  points: ["points"],
  fg2_made: ["fg2_made", "fg2Made"],
  fg2_attempted: ["fg2_attempted", "fg2Attempted"],
  fg3_made: ["fg3_made", "fg3Made"],
  fg3_attempted: ["fg3_attempted", "fg3Attempted"],
  ft_made: ["ft_made", "ftMade"],
  ft_attempted: ["ft_attempted", "ftAttempted"],
  off_reb: ["off_reb", "offReb", "rebounds_offensive", "reboundsOffensive"],
  def_reb: ["def_reb", "defReb", "rebounds_defensive", "reboundsDefensive"],
  assists: ["assists", "ast"],
  steals: ["steals", "stl"],
  blocks_made: ["blocks_made", "blocksMade", "blocks", "blk"],
  turnovers: ["turnovers", "tov"],
  fouls_committed: ["fouls_committed", "foulsCommitted", "fouls"]
});

function readNumeric(row, aliases) {
  for (const key of aliases) {
    if (row?.[key] === null || row?.[key] === undefined || row?.[key] === "") continue;
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

/**
 * Normalize BoxScore rows for descriptive intelligence without propagating PII.
 * @param {Array<Record<string, any>>} rows
 * @returns {Array<Record<string, number>>}
 */
export function normalizeGameStatsForIntelligence(rows = []) {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter(row => row && typeof row === "object" && !Array.isArray(row))
    .map(row => Object.fromEntries(
      Object.entries(FIELD_ALIASES).map(([target, aliases]) => [target, readNumeric(row, aliases)])
    ));
}

export default normalizeGameStatsForIntelligence;
