/**
 * Player 360 Training Core + External Development service.
 *
 * Responsibilities:
 * - isolate persistence/RPC details from UI;
 * - keep team-season scope explicit on every operation;
 * - expose read models convenient for responsive views;
 * - never perform authorization decisions only in the client.
 *
 * Backend RLS/RPC functions remain authoritative.
 */

function assertClient(client) {
  if (!client || typeof client.from !== "function" || typeof client.rpc !== "function") {
    throw new Error("TrainingService: cliente de datos no disponible.");
  }
}

function assertRequired(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`TrainingService: ${label} es obligatorio.`);
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

export class TrainingService {
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

    const { data, error } = await this.supabase.rpc("iq_v4_training_capabilities");
    if (error) throw error;

    let editCapabilities = {};
    try {
      const { data: editData, error: editError } = await this.supabase.rpc(
        "iq_core_ux_training_edit_capabilities"
      );
      if (!editError && editData) editCapabilities = editData;
    } catch {
      // Compatibilidad con entornos donde el backend de edición aún no está instalado.
    }

    this._capabilities = {
      ...(data || {
        ready: false,
        training_core: false,
        external_development: false
      }),
      update_training: Boolean(editCapabilities.update_training),
      update_external_development: Boolean(editCapabilities.update_external_development),
      frozen_season_guard: Boolean(editCapabilities.frozen_season_guard)
    };

    return this._capabilities;
  }

  async listActivityTypes({
    teamSeasonId,
    module = null,
    includeInactive = false
  } = {}) {
    this._assertReady();
    assertRequired(teamSeasonId, "teamSeasonId");

    let query = this.supabase
      .from("player360_activity_types")
      .select("id,team_season_id,module,code,name,category,description,is_active,sort_order")
      .eq("team_season_id", teamSeasonId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (module) query = query.eq("module", String(module).toUpperCase());
    if (!includeInactive) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw error;
    return normalizeArray(data);
  }

  async listSessions({
    teamSeasonId,
    fromDate = null,
    toDate = null,
    includeArchived = false,
    limit = 100
  } = {}) {
    this._assertReady();
    assertRequired(teamSeasonId, "teamSeasonId");

    let query = this.supabase
      .from("training_sessions")
      .select("*")
      .eq("team_season_id", teamSeasonId)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit) || 100, 500)));

    if (fromDate) query = query.gte("session_date", fromDate);
    if (toDate) query = query.lte("session_date", toDate);
    if (!includeArchived) query = query.neq("status", "ARCHIVED");

    const { data: sessions, error: sessionsError } = await query;
    if (sessionsError) throw sessionsError;

    const normalizedSessions = normalizeArray(sessions);
    if (!normalizedSessions.length) return [];

    const sessionIds = normalizedSessions.map(row => row.id).filter(Boolean);

    const [blocksResult, participantsResult] = await Promise.all([
      this.supabase
        .from("training_blocks")
        .select("*")
        .in("training_session_id", sessionIds)
        .order("block_order", { ascending: true }),
      this.supabase
        .from("training_participants")
        .select("*")
        .in("training_session_id", sessionIds)
        .order("created_at", { ascending: true })
    ]);

    if (blocksResult.error) throw blocksResult.error;
    if (participantsResult.error) throw participantsResult.error;

    const blocksBySession = groupBy(blocksResult.data, "training_session_id");
    const participantsBySession = groupBy(
      participantsResult.data,
      "training_session_id"
    );

    return normalizedSessions.map(session => ({
      ...session,
      blocks: blocksBySession.get(String(session.id)) || [],
      participants: participantsBySession.get(String(session.id)) || []
    }));
  }

  async createSession({
    teamSeasonId,
    sessionDate,
    title,
    objective = null,
    durationMinutes = null,
    intensity = null,
    startTime = null,
    endTime = null,
    blocks = [],
    participants = []
  } = {}) {
    this._assertReady();
    assertRequired(teamSeasonId, "teamSeasonId");
    assertRequired(sessionDate, "sessionDate");
    assertRequired(title, "title");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_create_training_session",
      {
        p_team_season_id: teamSeasonId,
        p_session_date: sessionDate,
        p_title: title,
        p_objective: objective,
        p_duration_minutes: durationMinutes,
        p_intensity: intensity,
        p_start_time: startTime,
        p_end_time: endTime,
        p_blocks: normalizeArray(blocks),
        p_participants: normalizeArray(participants)
      }
    );

    if (error) throw error;
    return data;
  }

  async updateSession({
    trainingSessionId,
    sessionDate,
    title,
    objective = null,
    durationMinutes = null,
    intensity = null,
    startTime = null,
    endTime = null,
    blocks = [],
    participantIds = []
  } = {}) {
    this._assertReady();
    assertRequired(trainingSessionId, "trainingSessionId");
    assertRequired(sessionDate, "sessionDate");
    assertRequired(title, "title");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_update_training_session",
      {
        p_training_session_id: trainingSessionId,
        p_session_date: sessionDate,
        p_title: title,
        p_objective: objective,
        p_duration_minutes: durationMinutes,
        p_intensity: intensity,
        p_start_time: startTime,
        p_end_time: endTime,
        p_blocks: normalizeArray(blocks),
        p_participant_ids: normalizeArray(participantIds)
      }
    );

    if (error) throw error;
    return data;
  }

  async setParticipant({
    trainingSessionId,
    playerId,
    attendanceStatus,
    participatedMinutes = null,
    rpe = null,
    notes = null
  } = {}) {
    this._assertReady();
    assertRequired(trainingSessionId, "trainingSessionId");
    assertRequired(playerId, "playerId");
    assertRequired(attendanceStatus, "attendanceStatus");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_set_training_participant",
      {
        p_training_session_id: trainingSessionId,
        p_player_id: playerId,
        p_attendance_status: String(attendanceStatus).toUpperCase(),
        p_participated_minutes: participatedMinutes,
        p_rpe: rpe,
        p_notes: notes
      }
    );

    if (error) throw error;
    return data;
  }

  async archiveSession(trainingSessionId) {
    this._assertReady();
    assertRequired(trainingSessionId, "trainingSessionId");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_archive_training_session",
      {
        p_training_session_id: trainingSessionId
      }
    );

    if (error) throw error;
    return Boolean(data);
  }

  async listExternalDevelopment({
    teamSeasonId,
    playerId = null,
    fromDate = null,
    toDate = null,
    limit = 100
  } = {}) {
    this._assertReady();
    assertRequired(teamSeasonId, "teamSeasonId");

    let query = this.supabase
      .from("external_development_sessions")
      .select("*")
      .eq("team_season_id", teamSeasonId)
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit) || 100, 500)));

    if (playerId) query = query.eq("player_id", playerId);
    if (fromDate) query = query.gte("activity_date", fromDate);
    if (toDate) query = query.lte("activity_date", toDate);

    const { data, error } = await query;
    if (error) throw error;
    return normalizeArray(data);
  }

  async createExternalDevelopment({
    teamSeasonId,
    playerId,
    activityDate,
    title,
    activityCode = null,
    activityTypeId = null,
    providerType = null,
    providerName = null,
    objective = null,
    durationMinutes = null,
    intensity = null,
    rpe = null,
    sourceType = "EXTERNAL_COACH",
    notes = null,
    provenance = {},
    metadata = {}
  } = {}) {
    this._assertReady();
    assertRequired(teamSeasonId, "teamSeasonId");
    assertRequired(playerId, "playerId");
    assertRequired(activityDate, "activityDate");
    assertRequired(title, "title");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_create_external_development",
      {
        p_team_season_id: teamSeasonId,
        p_player_id: playerId,
        p_activity_date: activityDate,
        p_title: title,
        p_activity_code: activityCode,
        p_activity_type_id: activityTypeId,
        p_provider_type: providerType,
        p_provider_name: providerName,
        p_objective: objective,
        p_duration_minutes: durationMinutes,
        p_intensity: intensity,
        p_rpe: rpe,
        p_source_type: sourceType,
        p_notes: notes,
        p_provenance: provenance && typeof provenance === "object" ? provenance : {},
        p_metadata: metadata && typeof metadata === "object" ? metadata : {}
      }
    );

    if (error) throw error;
    return data;
  }

  async updateExternalDevelopment({
    externalDevelopmentId,
    playerId,
    activityDate,
    title,
    activityCode = null,
    activityTypeId = null,
    providerType = null,
    providerName = null,
    objective = null,
    durationMinutes = null,
    intensity = null,
    rpe = null,
    sourceType = "EXTERNAL_COACH",
    notes = null,
    provenance = {},
    metadata = {}
  } = {}) {
    this._assertReady();
    assertRequired(externalDevelopmentId, "externalDevelopmentId");
    assertRequired(playerId, "playerId");
    assertRequired(activityDate, "activityDate");
    assertRequired(title, "title");

    const { data, error } = await this.supabase.rpc(
      "iq_v4_update_external_development",
      {
        p_external_development_id: externalDevelopmentId,
        p_player_id: playerId,
        p_activity_date: activityDate,
        p_title: title,
        p_activity_code: activityCode,
        p_activity_type_id: activityTypeId,
        p_provider_type: providerType,
        p_provider_name: providerName,
        p_objective: objective,
        p_duration_minutes: durationMinutes,
        p_intensity: intensity,
        p_rpe: rpe,
        p_source_type: sourceType,
        p_notes: notes,
        p_provenance: provenance && typeof provenance === "object" ? provenance : {},
        p_metadata: metadata && typeof metadata === "object" ? metadata : {}
      }
    );

    if (error) throw error;
    return data;
  }
}

export default TrainingService;
