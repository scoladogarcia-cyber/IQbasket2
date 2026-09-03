/**
 * Nutrition + Recovery RPC service.
 *
 * All personal rows are accessed through SECURITY DEFINER RPCs. The service
 * never queries wellness tables directly and never infers authorization from
 * frontend roles.
 */

const PURPOSE_PRIORITY = Object.freeze([
  "PLAYER_SELF_SERVICE",
  "FAMILY_SUPPORT",
  "SPORT_PERFORMANCE",
  "OPERATIONS"
]);

function assertClient(client) {
  if (!client || typeof client.rpc !== "function") {
    throw new Error("WellnessService: cliente de datos no disponible.");
  }
}

function required(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`WellnessService: ${label} es obligatorio.`);
  }
  return value;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export class WellnessService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  _assertReady() {
    assertClient(this.supabase);
  }

  async getCapabilities({
    teamSeasonId,
    playerId,
    module,
    purpose
  } = {}) {
    this._assertReady();
    required(teamSeasonId, "teamSeasonId");
    required(playerId, "playerId");
    required(module, "module");
    required(purpose, "purpose");

    const { data, error } = await this.supabase.rpc(
      "iq_v4e2_wellness_capabilities",
      {
        p_team_season_id: teamSeasonId,
        p_player_id: playerId,
        p_module: String(module).toLowerCase(),
        p_purpose: String(purpose).toUpperCase()
      }
    );
    if (error) throw error;
    return {
      ...(data || {}),
      purpose: String(purpose).toUpperCase()
    };
  }

  async resolveAccessContext({
    teamSeasonId,
    playerId,
    module
  } = {}) {
    this._assertReady();

    const results = await Promise.all(
      PURPOSE_PRIORITY.map(purpose =>
        this.getCapabilities({ teamSeasonId, playerId, module, purpose })
          .catch(() => null)
      )
    );

    const usable = results.find(item =>
      item && (item.can_read || item.can_create || item.can_update || item.can_archive)
    );

    return usable || {
      ready: true,
      module: String(module || "").toLowerCase(),
      purpose: null,
      can_read: false,
      can_create: false,
      can_update: false,
      can_archive: false,
      manual_input_enabled: true,
      external_import_enabled: false,
      recommendations_enabled: true,
      ai_processing_enabled: false
    };
  }

  async listMetrics({ teamSeasonId, module } = {}) {
    this._assertReady();
    required(teamSeasonId, "teamSeasonId");
    required(module, "module");

    const { data, error } = await this.supabase.rpc(
      "iq_v4e2_list_wellness_metric_catalog",
      {
        p_team_season_id: teamSeasonId,
        p_module: String(module).toLowerCase()
      }
    );
    if (error) throw error;
    return normalizeArray(data);
  }

  async listEntries({
    teamSeasonId,
    playerId,
    module,
    purpose,
    fromDate = null,
    toDate = null,
    limit = 100
  } = {}) {
    this._assertReady();
    required(teamSeasonId, "teamSeasonId");
    required(playerId, "playerId");
    required(module, "module");
    required(purpose, "purpose");

    const { data, error } = await this.supabase.rpc(
      "iq_v4e2_list_wellness_entries",
      {
        p_team_season_id: teamSeasonId,
        p_player_id: playerId,
        p_module: String(module).toLowerCase(),
        p_purpose: String(purpose).toUpperCase(),
        p_from: fromDate,
        p_to: toDate,
        p_limit: Math.max(1, Math.min(Number(limit) || 100, 500))
      }
    );
    if (error) throw error;
    return normalizeArray(data).map(row => ({
      ...row,
      observations: normalizeArray(row?.observations)
    }));
  }

  async saveManualEntry({
    entryId = null,
    teamSeasonId,
    playerId,
    module,
    entryDate,
    purpose,
    values = []
  } = {}) {
    this._assertReady();
    required(teamSeasonId, "teamSeasonId");
    required(playerId, "playerId");
    required(module, "module");
    required(entryDate, "entryDate");
    required(purpose, "purpose");

    const normalizedValues = normalizeArray(values)
      .filter(item => item && item.metric_code && item.value !== undefined)
      .map(item => ({
        metric_code: String(item.metric_code).toUpperCase(),
        value: item.value
      }));

    if (!normalizedValues.length) {
      throw new Error("WellnessService: indica al menos un valor.");
    }

    const { data, error } = await this.supabase.rpc(
      "iq_v4e2_save_manual_wellness_entry",
      {
        p_entry_id: entryId,
        p_team_season_id: teamSeasonId,
        p_player_id: playerId,
        p_module: String(module).toLowerCase(),
        p_entry_date: entryDate,
        p_purpose: String(purpose).toUpperCase(),
        p_values: normalizedValues
      }
    );
    if (error) throw error;
    return data;
  }

  async archiveEntry({ entryId, purpose } = {}) {
    this._assertReady();
    required(entryId, "entryId");
    required(purpose, "purpose");

    const { data, error } = await this.supabase.rpc(
      "iq_v4e2_archive_wellness_entry",
      {
        p_entry_id: entryId,
        p_purpose: String(purpose).toUpperCase()
      }
    );
    if (error) throw error;
    return Boolean(data);
  }
}

export default WellnessService;
