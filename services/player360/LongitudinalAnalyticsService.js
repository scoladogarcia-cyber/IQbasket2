/**
 * Persistence boundary for longitudinal snapshots and AI insights.
 * Calculations and provider calls deliberately live outside this service.
 */

import { PLAYER360_LONGITUDINAL_CONFIG } from "../../config/player360-analytics.config.js";

const EVIDENCE_VERSION = "PLAYER360_EVIDENCE_V1";

function assertClient(client) {
  if (!client || typeof client.from !== "function" || typeof client.rpc !== "function") {
    throw new Error("LongitudinalAnalyticsService: cliente de datos no disponible.");
  }
}

function required(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`LongitudinalAnalyticsService: ${label} es obligatorio.`);
  }
  return value;
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`LongitudinalAnalyticsService: ${label} debe ser un objeto.`);
  }
  return value;
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

export class LongitudinalAnalyticsService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this._capabilities = null;
  }

  _assertReady() {
    assertClient(this.supabase);
  }

  async getCapabilities({ force = false } = {}) {
    this._assertReady();
    if (this._capabilities && !force) return this._capabilities;
    const { data, error } = await this.supabase.rpc("iq_v4_longitudinal_capabilities");
    if (error) throw error;
    this._capabilities = data || {
      ready: false,
      longitudinal_snapshots: false,
      ai_insights: false,
      human_review: false
    };
    return this._capabilities;
  }

  async listSnapshots({ teamSeasonId, playerId, limit = 50 } = {}) {
    this._assertReady();
    required(teamSeasonId, "teamSeasonId");
    required(playerId, "playerId");
    const { data, error } = await this.supabase
      .from("player_longitudinal_snapshots")
      .select("*")
      .eq("team_season_id", teamSeasonId)
      .eq("player_id", playerId)
      .order("period_end", { ascending: false })
      .order("generated_at", { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit) || 50, 200)));
    if (error) throw error;
    return rows(data);
  }

  async saveSnapshot({
    teamSeasonId, playerId, periodStart, periodEnd,
    calculationVersion = PLAYER360_LONGITUDINAL_CONFIG.calculationVersion,
    sourceRevision = null, sourceFingerprint, snapshot, evidenceBundle,
    rejectedObservations = 0
  } = {}) {
    this._assertReady();
    required(teamSeasonId, "teamSeasonId");
    required(playerId, "playerId");
    required(periodStart, "periodStart");
    required(periodEnd, "periodEnd");
    required(sourceFingerprint, "sourceFingerprint");
    object(snapshot, "snapshot");
    object(evidenceBundle, "evidenceBundle");

    if (snapshot.contract_version !== PLAYER360_LONGITUDINAL_CONFIG.contractVersion) {
      throw new Error("LongitudinalAnalyticsService: contrato longitudinal incompatible.");
    }
    if (snapshot.calculation_version !== calculationVersion) {
      throw new Error("LongitudinalAnalyticsService: versión de cálculo inconsistente.");
    }
    if (evidenceBundle.evidence_version !== EVIDENCE_VERSION
        || evidenceBundle.calculation_version !== calculationVersion) {
      throw new Error("LongitudinalAnalyticsService: evidencia incompatible con el cálculo.");
    }

    const { data, error } = await this.supabase.rpc("iq_v4_save_longitudinal_snapshot", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_contract_version: PLAYER360_LONGITUDINAL_CONFIG.contractVersion,
      p_calculation_version: calculationVersion,
      p_source_revision: sourceRevision,
      p_source_fingerprint: sourceFingerprint,
      p_snapshot: snapshot,
      p_evidence_bundle: evidenceBundle,
      p_rejected_observations: Math.max(0, Number(rejectedObservations) || 0)
    });
    if (error) throw error;
    return data;
  }

  async listInsights({ snapshotId, audience = null, status = null, limit = 50 } = {}) {
    this._assertReady();
    required(snapshotId, "snapshotId");
    let query = this.supabase
      .from("player_ai_insights")
      .select("*")
      .eq("snapshot_id", snapshotId)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit) || 50, 200)));
    if (audience) query = query.eq("audience", String(audience).toUpperCase());
    if (status) query = query.eq("status", String(status).toUpperCase());
    const { data, error } = await query;
    if (error) throw error;
    return rows(data);
  }

  async saveAiInsight({
    snapshotId, audience, locale = "es", provider, modelName,
    promptVersion, content
  } = {}) {
    this._assertReady();
    required(snapshotId, "snapshotId");
    required(audience, "audience");
    required(provider, "provider");
    required(modelName, "modelName");
    required(promptVersion, "promptVersion");
    object(content, "content");
    const { data, error } = await this.supabase.rpc("iq_v4_save_ai_insight", {
      p_snapshot_id: snapshotId,
      p_audience: String(audience).toUpperCase(),
      p_locale: String(locale || "es").toLowerCase(),
      p_provider: provider,
      p_model_name: modelName,
      p_prompt_version: promptVersion,
      p_content: content
    });
    if (error) throw error;
    return data;
  }

  async reviewAiInsight({ insightId, status, notes = null } = {}) {
    this._assertReady();
    required(insightId, "insightId");
    required(status, "status");
    const normalizedStatus = String(status).toUpperCase();
    if (!["APPROVED", "REJECTED", "ARCHIVED"].includes(normalizedStatus)) {
      throw new Error("LongitudinalAnalyticsService: estado de revisión no permitido.");
    }
    const { data, error } = await this.supabase.rpc("iq_v4_review_ai_insight", {
      p_insight_id: insightId,
      p_status: normalizedStatus,
      p_review_notes: notes
    });
    if (error) throw error;
    return Boolean(data);
  }
}

export default LongitudinalAnalyticsService;
