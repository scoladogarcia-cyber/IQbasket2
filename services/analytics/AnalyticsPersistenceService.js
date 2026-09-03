/**
 * Persistence boundary for calculated analytics.
 *
 * This service depends on the generic database adapter contract, not Supabase.
 * It can therefore be reused with a future PostgreSQL/SQLite/other adapter.
 *
 * IMPORTANT: v3 analytics tables do not exist in production yet. Do not wire
 * this service into runtime until the v3 migration has been validated.
 */

import { ANALYTICS_CONFIG } from "../../config/analytics.config.js";

export class AnalyticsPersistenceService {
  constructor(dbAdapter, config = ANALYTICS_CONFIG) {
    this.db = dbAdapter;
    this.config = config;
  }

  _assertReady() {
    if (!this.db || typeof this.db.upsert !== "function") {
      throw new Error("AnalyticsPersistenceService: adaptador de base de datos no disponible.");
    }
  }

  async savePlayerSeasonMetrics(snapshot) {
    this._assertReady();
    if (!snapshot?.team_season_id || !snapshot?.player_id || !snapshot?.calculation_version) {
      throw new Error("Métricas de jugador incompletas.");
    }

    return this.db.upsert(
      this.config.tables.playerSeason,
      snapshot,
      "team_season_id,player_id,calculation_version"
    );
  }

  async saveTeamSeasonMetrics(snapshot) {
    this._assertReady();
    if (!snapshot?.team_season_id || !snapshot?.calculation_version) {
      throw new Error("Métricas de equipo incompletas.");
    }

    return this.db.upsert(
      this.config.tables.teamSeason,
      snapshot,
      "team_season_id,calculation_version"
    );
  }

  async saveLineupSeasonMetrics(snapshot) {
    this._assertReady();
    if (!snapshot?.team_season_id || !snapshot?.lineup_key || !snapshot?.calculation_version) {
      throw new Error("Métricas de quinteto incompletas.");
    }

    return this.db.upsert(
      this.config.tables.lineupSeason,
      snapshot,
      "team_season_id,lineup_key,calculation_version"
    );
  }
}

export default AnalyticsPersistenceService;
