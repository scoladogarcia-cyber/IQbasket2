/**
 * Central analytics configuration.
 * Keep algorithm versions and persistence table names in one place so the
 * calculation layer remains reusable and database-provider agnostic.
 */
export const ANALYTICS_CONFIG = Object.freeze({
  calculationVersion: "2026.09-v1",
  tables: Object.freeze({
    runs: "analytics_runs",
    playerSeason: "player_season_metrics",
    teamSeason: "team_season_metrics",
    lineupSeason: "lineup_season_metrics"
  })
});

export default ANALYTICS_CONFIG;
