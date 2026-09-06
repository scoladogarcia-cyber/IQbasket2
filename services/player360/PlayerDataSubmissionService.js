const TYPES = Object.freeze({
  WELLNESS_CHECKIN: "WELLNESS_CHECKIN",
  EXTERNAL_TRAINING: "EXTERNAL_TRAINING"
});

function clientOf(value) {
  return value?.supabase || value?.default || value || null;
}

function required(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`PlayerDataSubmissionService: ${label} es obligatorio.`);
  }
  return value;
}

export class PlayerDataSubmissionService {
  constructor(supabaseClient = null) {
    this.supabase = clientOf(supabaseClient);
  }

  _ready() {
    if (!this.supabase?.rpc) {
      throw new Error("PlayerDataSubmissionService: backend no disponible.");
    }
  }
  async saveDraft({ submissionId = null, teamSeasonId, playerId, type, payload } = {}) {
    this._ready();
    required(teamSeasonId, "teamSeasonId");
    required(playerId, "playerId");
    required(type, "type");
    required(payload, "payload");
    const { data, error } = await this.supabase.rpc(
      "iq_v14_save_player_submission_draft",
      {
        p_submission_id: submissionId,
        p_team_season_id: teamSeasonId,
        p_player_id: playerId,
        p_submission_type: String(type).toUpperCase(),
        p_payload: payload
      }
    );
    if (error) throw error;
    return data;
  }

  async submit(submissionId) {
    this._ready();
    required(submissionId, "submissionId");
    const { data, error } = await this.supabase.rpc(
      "iq_v14_submit_player_submission",
      { p_submission_id: submissionId }
    );
    if (error) throw error;
    return Boolean(data);
  }
  async listMine({ teamSeasonId = null, limit = 100 } = {}) {
    this._ready();
    const { data, error } = await this.supabase.rpc(
      "iq_v14_list_my_player_submissions",
      {
        p_team_season_id: teamSeasonId,
        p_limit: Math.max(1, Math.min(Number(limit) || 100, 300))
      }
    );
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async listForReview({ teamSeasonId = null, includeResolved = false, limit = 100 } = {}) {
    this._ready();
    const { data, error } = await this.supabase.rpc(
      "iq_v14_list_player_submission_reviews",
      {
        p_team_season_id: teamSeasonId,
        p_include_resolved: Boolean(includeResolved),
        p_limit: Math.max(1, Math.min(Number(limit) || 100, 300))
      }
    );
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }
  async review({ submissionId, decision, note = null } = {}) {
    this._ready();
    required(submissionId, "submissionId");
    required(decision, "decision");
    const { data, error } = await this.supabase.rpc(
      "iq_v14_review_player_submission",
      {
        p_submission_id: submissionId,
        p_decision: String(decision).toUpperCase(),
        p_note: note || null
      }
    );
    if (error) throw error;
    return data || null;
  }

  async saveAndSubmit(args = {}) {
    const id = await this.saveDraft(args);
    await this.submit(id);
    return id;
  }
}

export { TYPES as PlayerSubmissionType };
export default PlayerDataSubmissionService;
