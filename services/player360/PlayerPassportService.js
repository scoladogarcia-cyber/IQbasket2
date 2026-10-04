/**
 * @fileoverview Player Passport application service.
 * @description Provides the only UI-facing adapter for the premium passport.
 * Commercial access is authoritative in Supabase; the browser never grants access itself.
 */
import { PLAYER_PASSPORT_CONFIG } from "../../config/player-passport.config.js";

function assertRequired(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`PlayerPassportService: ${label} es obligatorio.`);
  }
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export class PlayerPassportService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this._catalog = null;
  }

  _assertClient() {
    if (!this.supabase?.rpc) throw new Error("PLAYER_PASSPORT_BACKEND_UNAVAILABLE");
  }

  async loadCatalog({ force = false } = {}) {
    if (this._catalog && !force) return this._catalog;
    const response = await fetch(PLAYER_PASSPORT_CONFIG.catalogUrl, { cache: force ? "reload" : "default" });
    if (!response.ok) throw new Error(`PLAYER_PASSPORT_CATALOG_HTTP_${response.status}`);
    const payload = await response.json();
    const attributes = normalizeArray(payload?.attributes);
    if (attributes.length !== 69) throw new Error("PLAYER_PASSPORT_CATALOG_INVALID");
    this._catalog = payload;
    return payload;
  }

  async getSnapshot({ playerId, teamSeasonId }) {
    this._assertClient();
    assertRequired(playerId, "playerId");
    assertRequired(teamSeasonId, "teamSeasonId");
    const { data, error } = await this.supabase.rpc("iq_v4_player_passport_snapshot", {
      p_player_id: playerId,
      p_team_season_id: teamSeasonId
    });
    if (error) {
      const wrapped = new Error(error.message || "PLAYER_PASSPORT_SNAPSHOT_FAILED");
      wrapped.code = error.code || "PLAYER_PASSPORT_SNAPSHOT_FAILED";
      wrapped.cause = error;
      throw wrapped;
    }
    return data || {};
  }

  async getPassport(context) {
    const [catalog, snapshot] = await Promise.all([
      this.loadCatalog(),
      this.getSnapshot(context)
    ]);
    return {
      catalog,
      player: snapshot?.player || null,
      team: snapshot?.team || null,
      evaluations: normalizeArray(snapshot?.evaluations),
      measurements: normalizeArray(snapshot?.measurements),
      allowed: Boolean(snapshot?.allowed)
    };
  }

  async saveEvaluation({
    playerId,
    teamSeasonId,
    evaluationDate,
    title,
    context,
    scores,
    summary = null,
    strengths = null,
    developmentPriorities = null,
    existingEvaluationId = null
  }) {
    this._assertClient();
    assertRequired(playerId, "playerId");
    assertRequired(teamSeasonId, "teamSeasonId");
    assertRequired(evaluationDate, "evaluationDate");
    assertRequired(title, "title");
    assertRequired(context, "context");

    const normalizedScores = normalizeArray(scores)
      .filter(item => item?.metric_code && item?.score !== null && item?.score !== undefined && item?.score !== "")
      .map(item => ({
        metric_code: String(item.metric_code).toUpperCase(),
        score: Number(item.score),
        confidence: String(item.confidence || "MEDIUM").toUpperCase(),
        evidence_count: Math.max(0, Number(item.evidence_count) || 0),
        notes: item.notes || null,
        rubric_version: item.rubric_version || "1.0"
      }));

    if (!normalizedScores.length) throw new Error("PLAYER_PASSPORT_NO_OBSERVED_ATTRIBUTES");

    const { data, error } = await this.supabase.rpc("iq_v4_save_player_passport_evaluation_v2", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId,
      p_evaluation_date: evaluationDate,
      p_title: title,
      p_context: String(context).toUpperCase(),
      p_scores: normalizedScores,
      p_summary: summary || null,
      p_strengths: strengths || null,
      p_development_priorities: developmentPriorities || null,
      p_existing_evaluation_id: existingEvaluationId || null,
      p_training_session_id: arguments[0]?.trainingSessionId || null
    });
    if (error) throw error;
    return data;
  }

  async saveMeasurement({
    playerId,
    teamSeasonId,
    testCode,
    value,
    unit,
    measuredAt,
    protocolCode = null,
    protocolVersion = null,
    notes = null
  }) {
    this._assertClient();
    const { data, error } = await this.supabase.rpc("iq_v4_save_player_measurement", {
      p_player_id: playerId,
      p_team_season_id: teamSeasonId,
      p_test_code: testCode,
      p_value: Number(value),
      p_unit: unit,
      p_measured_at: measuredAt,
      p_protocol_code: protocolCode,
      p_protocol_version: protocolVersion,
      p_notes: notes
    });
    if (error) throw error;
    return data;
  }
}

export default PlayerPassportService;
