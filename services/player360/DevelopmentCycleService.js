/**
 * @fileoverview Client boundary for Player Development Loop V2.
 * @description All reads and writes cross action-specific backend RPCs. The
 * browser never reads or mutates development-cycle tables directly.
 */
function required(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`DevelopmentCycleService: ${label} es obligatorio.`);
  }
  return value;
}

function normalizedActions(actions = []) {
  if (!Array.isArray(actions)) return [];
  return actions
    .filter(item => String(item?.title || "").trim())
    .slice(0, 3)
    .map(item => ({
      action_type: String(item.actionType || item.action_type || "OTHER").trim().toUpperCase(),
      metric_code: item.metricCode || item.metric_code || null,
      title: String(item.title || "").trim(),
      success_criterion: String(item.successCriterion || item.success_criterion || "").trim()
    }));
}

export class DevelopmentCycleService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  _assertReady() {
    if (!this.supabase || typeof this.supabase.rpc !== "function") {
      throw new Error("DevelopmentCycleService: backend no disponible.");
    }
  }

  async getCapabilities({ teamSeasonId, playerId } = {}) {
    this._assertReady();
    const { data, error } = await this.supabase.rpc("iq_v16_development_cycle_capabilities", {
      p_team_season_id: required(teamSeasonId, "teamSeasonId"),
      p_player_id: required(playerId, "playerId")
    });
    if (error) {
      const message = String(error?.message || "");
      if (error?.code === "PGRST202" || message.includes("iq_v16_development_cycle_capabilities")) {
        return { ready: false, can_view: false, reason_code: "DEVELOPMENT_CYCLE_NOT_READY" };
      }
      throw error;
    }
    return data || { ready: false, can_view: false };
  }

  async snapshot({ teamSeasonId, playerId } = {}) {
    this._assertReady();
    const { data, error } = await this.supabase.rpc("iq_v16_development_cycle_snapshot", {
      p_team_season_id: required(teamSeasonId, "teamSeasonId"),
      p_player_id: required(playerId, "playerId")
    });
    if (error) throw error;
    return data || {};
  }

  async startCycle({ teamSeasonId, playerId, objectiveProfileId, actions } = {}) {
    this._assertReady();
    const payload = normalizedActions(actions);
    if (!payload.length) {
      throw new Error("DevelopmentCycleService: indica al menos una acción semanal.");
    }
    const { data, error } = await this.supabase.rpc("iq_v16_start_development_cycle", {
      p_team_season_id: required(teamSeasonId, "teamSeasonId"),
      p_player_id: required(playerId, "playerId"),
      p_objective_profile_id: required(objectiveProfileId, "objectiveProfileId"),
      p_actions: payload
    });
    if (error) throw error;
    return data;
  }

  async setActionState({ actionId, targetState, note = null } = {}) {
    this._assertReady();
    const { data, error } = await this.supabase.rpc("iq_v16_set_development_action_state", {
      p_action_id: required(actionId, "actionId"),
      p_target_state: required(targetState, "targetState"),
      p_note: note || null
    });
    if (error) throw error;
    return data;
  }

  async linkEvidence({ actionId, evidenceType, evidenceId, note = null } = {}) {
    this._assertReady();
    const { data, error } = await this.supabase.rpc("iq_v16_link_development_evidence", {
      p_action_id: required(actionId, "actionId"),
      p_evidence_type: required(evidenceType, "evidenceType"),
      p_evidence_id: required(evidenceId, "evidenceId"),
      p_note: note || null
    });
    if (error) throw error;
    return data;
  }

  async reviewCycle({ cycleId, outcome, note = null } = {}) {
    this._assertReady();
    const { data, error } = await this.supabase.rpc("iq_v16_review_development_cycle", {
      p_cycle_id: required(cycleId, "cycleId"),
      p_outcome: required(outcome, "outcome"),
      p_note: note || null
    });
    if (error) throw error;
    return data;
  }
}

export default DevelopmentCycleService;
