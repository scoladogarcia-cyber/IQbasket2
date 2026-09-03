/**
 * Player 360 Evaluation + Objective Profile service.
 *
 * Responsibilities:
 * - isolate Phase 4C persistence/RPC details from the UI;
 * - keep player + team-season scope explicit;
 * - return hydrated evaluation/profile read models;
 * - use controlled RPCs for every mutation.
 *
 * Backend RLS and SECURITY DEFINER RPCs remain authoritative.
 */

function assertClient(client) {
  if (!client || typeof client.from !== "function" || typeof client.rpc !== "function") {
    throw new Error("EvaluationService: cliente de datos no disponible.");
  }
}

function assertRequired(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`EvaluationService: ${label} es obligatorio.`);
  }
  return value;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function groupBy(items, key) {
  return normalizeArray(items).reduce((map, item) => {
    const value = String(item?.[key] || "");
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
    return map;
  }, new Map());
}

export class EvaluationService {
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

    const { data, error } = await this.supabase.rpc("iq_v4_evaluation_capabilities");
    if (error) throw error;

    this._capabilities = data || {
      ready: false,
      evaluation: false,
      objective_profile: false,
      metric_catalog: false
    };

    return this._capabilities;
  }

  async listMetrics({ teamSeasonId } = {}) {
    this._assertReady();
    assertRequired(teamSeasonId, "teamSeasonId");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_list_evaluation_metrics",
      { p_team_season_id: teamSeasonId }
    );

    if (error) throw error;
    return normalizeArray(data);
  }

  async upsertMetric({
    teamSeasonId = null,
    code,
    domainCode,
    name,
    description = null,
    scaleMin = 0,
    scaleMax = 10,
    scaleStep = 0.5,
    higherIsBetter = true,
    sensitivity = "PRIVATE_SPORTING",
    isActive = true,
    sortOrder = 0
  } = {}) {
    this._assertReady();
    assertRequired(code, "code");
    assertRequired(domainCode, "domainCode");
    assertRequired(name, "name");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_upsert_evaluation_metric",
      {
        p_team_season_id: teamSeasonId,
        p_code: String(code).toUpperCase(),
        p_domain_code: String(domainCode).toUpperCase(),
        p_name: name,
        p_description: description,
        p_scale_min: scaleMin,
        p_scale_max: scaleMax,
        p_scale_step: scaleStep,
        p_higher_is_better: Boolean(higherIsBetter),
        p_sensitivity: String(sensitivity || "PRIVATE_SPORTING").toUpperCase(),
        p_is_active: Boolean(isActive),
        p_sort_order: Number(sortOrder) || 0
      }
    );

    if (error) throw error;
    return data;
  }

  async listEvaluations({
    teamSeasonId,
    playerId,
    includeHistory = false,
    includeArchived = false,
    limit = 100
  } = {}) {
    this._assertReady();
    assertRequired(teamSeasonId, "teamSeasonId");
    assertRequired(playerId, "playerId");

    let query = this.supabase
      .from("player_evaluations")
      .select("*")
      .eq("team_season_id", teamSeasonId)
      .eq("player_id", playerId)
      .order("evaluation_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit) || 100, 500)));

    if (!includeHistory) query = query.eq("status", "CURRENT");
    else if (!includeArchived) query = query.neq("status", "ARCHIVED");

    const { data: evaluations, error: evaluationError } = await query;
    if (evaluationError) throw evaluationError;

    const rows = normalizeArray(evaluations);
    if (!rows.length) return [];

    const ids = rows.map(row => row.id).filter(Boolean);
    const { data: scores, error: scoreError } = await this.supabase
      .from("player_evaluation_scores")
      .select("*")
      .in("evaluation_id", ids)
      .order("domain_code", { ascending: true })
      .order("metric_name", { ascending: true });

    if (scoreError) throw scoreError;
    const scoresByEvaluation = groupBy(scores, "evaluation_id");

    return rows.map(evaluation => ({
      ...evaluation,
      scores: scoresByEvaluation.get(String(evaluation.id)) || []
    }));
  }

  async saveEvaluation({
    teamSeasonId,
    playerId,
    evaluationDate,
    title,
    evaluationType = "GENERAL",
    sourceType = "CLUB_COACH",
    evaluatorName = null,
    summary = null,
    strengths = null,
    developmentPriorities = null,
    isPrivate = false,
    shareWithPlayer = false,
    scores = [],
    provenance = {},
    metadata = {},
    existingEvaluationId = null
  } = {}) {
    this._assertReady();
    assertRequired(teamSeasonId, "teamSeasonId");
    assertRequired(playerId, "playerId");
    assertRequired(evaluationDate, "evaluationDate");
    assertRequired(title, "title");

    const normalizedScores = normalizeArray(scores).filter(item =>
      item?.metric_code || item?.metricCode
    );
    if (!normalizedScores.length) {
      throw new Error("EvaluationService: indica al menos una puntuación.");
    }

    const { data, error } = await this.supabase.rpc(
      "iq_v4_save_player_evaluation",
      {
        p_team_season_id: teamSeasonId,
        p_player_id: playerId,
        p_evaluation_date: evaluationDate,
        p_title: title,
        p_evaluation_type: String(evaluationType || "GENERAL").toUpperCase(),
        p_source_type: String(sourceType || "CLUB_COACH").toUpperCase(),
        p_evaluator_name: evaluatorName,
        p_summary: summary,
        p_strengths: strengths,
        p_development_priorities: developmentPriorities,
        p_is_private: Boolean(isPrivate),
        p_share_with_player: Boolean(shareWithPlayer),
        p_scores: normalizedScores.map(item => ({
          metric_code: String(item.metric_code || item.metricCode).toUpperCase(),
          score: item.score,
          confidence: item.confidence ?? null,
          notes: item.notes ?? null,
          evidence: item.evidence ?? null,
          metadata: item.metadata && typeof item.metadata === "object"
            ? item.metadata
            : {}
        })),
        p_provenance: provenance && typeof provenance === "object" ? provenance : {},
        p_metadata: metadata && typeof metadata === "object" ? metadata : {},
        p_existing_evaluation_id: existingEvaluationId
      }
    );

    if (error) throw error;
    return data;
  }

  async archiveEvaluation(evaluationId) {
    this._assertReady();
    assertRequired(evaluationId, "evaluationId");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_archive_player_evaluation",
      { p_evaluation_id: evaluationId }
    );

    if (error) throw error;
    return Boolean(data);
  }

  async listObjectiveProfiles({
    teamSeasonId,
    playerId,
    includeHistory = false,
    includeArchived = false,
    limit = 50
  } = {}) {
    this._assertReady();
    assertRequired(teamSeasonId, "teamSeasonId");
    assertRequired(playerId, "playerId");

    let query = this.supabase
      .from("player_objective_profiles")
      .select("*")
      .eq("team_season_id", teamSeasonId)
      .eq("player_id", playerId)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit) || 50, 200)));

    if (!includeHistory) query = query.eq("status", "ACTIVE");
    else if (!includeArchived) query = query.neq("status", "ARCHIVED");

    const { data: profiles, error: profileError } = await query;
    if (profileError) throw profileError;

    const rows = normalizeArray(profiles);
    if (!rows.length) return [];

    const ids = rows.map(row => row.id).filter(Boolean);
    const { data: targets, error: targetError } = await this.supabase
      .from("player_objective_targets")
      .select("*")
      .in("profile_id", ids)
      .order("domain_code", { ascending: true })
      .order("metric_name", { ascending: true });

    if (targetError) throw targetError;
    const targetsByProfile = groupBy(targets, "profile_id");

    return rows.map(profile => ({
      ...profile,
      targets: targetsByProfile.get(String(profile.id)) || []
    }));
  }

  async getActiveObjectiveProfile({ teamSeasonId, playerId } = {}) {
    const rows = await this.listObjectiveProfiles({
      teamSeasonId,
      playerId,
      includeHistory: false,
      includeArchived: false,
      limit: 1
    });
    return rows[0] || null;
  }

  async saveObjectiveProfile({
    teamSeasonId,
    playerId,
    effectiveDate,
    targetDate = null,
    title,
    rationale = null,
    targets = [],
    provenance = {},
    metadata = {},
    expectedActiveProfileId = null
  } = {}) {
    this._assertReady();
    assertRequired(teamSeasonId, "teamSeasonId");
    assertRequired(playerId, "playerId");
    assertRequired(effectiveDate, "effectiveDate");
    assertRequired(title, "title");

    const normalizedTargets = normalizeArray(targets).filter(item =>
      item?.metric_code || item?.metricCode
    );
    if (!normalizedTargets.length) {
      throw new Error("EvaluationService: indica al menos un objetivo.");
    }

    const { data, error } = await this.supabase.rpc(
      "iq_v4_save_objective_profile",
      {
        p_team_season_id: teamSeasonId,
        p_player_id: playerId,
        p_effective_date: effectiveDate,
        p_target_date: targetDate || null,
        p_title: title,
        p_rationale: rationale,
        p_targets: normalizedTargets.map(item => ({
          metric_code: String(item.metric_code || item.metricCode).toUpperCase(),
          target_score: item.target_score ?? item.targetScore,
          priority_weight: item.priority_weight ?? item.priorityWeight ?? 1,
          notes: item.notes ?? null,
          metadata: item.metadata && typeof item.metadata === "object"
            ? item.metadata
            : {}
        })),
        p_provenance: provenance && typeof provenance === "object" ? provenance : {},
        p_metadata: metadata && typeof metadata === "object" ? metadata : {},
        p_expected_active_profile_id: expectedActiveProfileId
      }
    );

    if (error) throw error;
    return data;
  }

  async archiveObjectiveProfile(profileId) {
    this._assertReady();
    assertRequired(profileId, "profileId");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_archive_objective_profile",
      { p_profile_id: profileId }
    );

    if (error) throw error;
    return Boolean(data);
  }

  async getObjectiveGap(profileId) {
    this._assertReady();
    assertRequired(profileId, "profileId");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_get_player_objective_gap",
      { p_profile_id: profileId }
    );

    if (error) throw error;
    return normalizeArray(data);
  }
}

export default EvaluationService;
