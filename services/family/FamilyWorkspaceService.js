/**
 * @fileoverview Data boundary for the IQBasket family workspace.
 * @description The browser never reads protected family/commercial tables
 * directly. Every operation goes through a scoped backend RPC.
 */
function requireClient(client) {
  if (!client || typeof client.rpc !== "function") {
    throw new Error("FamilyWorkspaceService: cliente de datos no disponible.");
  }
}

function requireValue(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`FamilyWorkspaceService: ${label} es obligatorio.`);
  }
  return value;
}

async function rpc(client, name, params = {}) {
  requireClient(client);
  const { data, error } = await client.rpc(name, params);
  if (error) throw error;
  return data;
}

function missingRpc(error, rpcName) {
  const message = String(error?.message || "");
  return error?.code === "PGRST202" || message.includes(rpcName);
}

async function progressiveRpc(client, preferredName, fallbackName, params = {}) {
  try {
    return await rpc(client, preferredName, params);
  } catch (error) {
    if (!fallbackName || !missingRpc(error, preferredName)) throw error;
    return rpc(client, fallbackName, params);
  }
}

function normalizePlayerScopeRow(row = {}) {
  const player = row?.player || {};
  const context = row?.latest_context || {};
  return {
    ...row,
    player_id: row.player_id ?? player.id ?? null,
    first_name: row.first_name ?? player.first_name ?? "",
    last_name: row.last_name ?? player.last_name ?? "",
    photo_url: row.photo_url ?? player.photo_url ?? null,
    primary_position: row.primary_position ?? player.primary_position ?? context.primary_position ?? null,
    team_id: row.team_id ?? context.team_id ?? null,
    team_season_id: row.team_season_id ?? context.team_season_id ?? null,
    team_name: row.team_name ?? context.team_name ?? null,
    season_name: row.season_name ?? context.season_name ?? null
  };
}

export class FamilyWorkspaceService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async listPlayers() {
    const rows = await progressiveRpc(
      this.supabase,
      "iq_v32_family_list_players",
      "iq_v8_family_list_players"
    );
    return (Array.isArray(rows) ? rows : [])
      .map(normalizePlayerScopeRow)
      .filter(row => row.player_id);
  }

  claimLink(claimCode) {
    requireValue(claimCode, "claimCode");
    const params = { p_claim_code: String(claimCode).trim() };
    return progressiveRpc(
      this.supabase,
      "iq_v34_family_claim_link",
      "iq_v8_family_claim_link",
      params
    );
  }

  bootstrapFree(playerId) {
    requireValue(playerId, "playerId");
    const params = { p_player_id: playerId };
    return progressiveRpc(
      this.supabase,
      "iq_v34_family_bootstrap_free",
      "iq_v8_family_bootstrap_free",
      params
    );
  }

  getProductSnapshot(playerId) {
    requireValue(playerId, "playerId");
    return rpc(this.supabase, "iq_v8_family_product_snapshot", {
      p_player_id: playerId
    });
  }

  async getPassport(playerId) {
    requireValue(playerId, "playerId");
    const params = { p_player_id: playerId };
    try {
      return await progressiveRpc(
        this.supabase,
        "iq_v33_family_player_passport",
        "iq_v32_family_player_passport",
        params
      );
    } catch (error) {
      // Compatibilidad para entornos que todavía no hayan recibido V32/V33.
      if (!missingRpc(error, "iq_v32_family_player_passport")) throw error;
      return rpc(this.supabase, "iq_v8_family_player_passport", params);
    }
  }

  getPlayer360Snapshot(playerId, teamSeasonId = null) {
    requireValue(playerId, "playerId");
    return progressiveRpc(
      this.supabase,
      "iq_v32_family_player360_snapshot",
      "iq_v8_family_player360_snapshot",
      {
        p_player_id: playerId,
        p_team_season_id: teamSeasonId || null
      }
    );
  }

  getDevelopmentContext(playerId, teamSeasonId = null) {
    requireValue(playerId, "playerId");
    return rpc(this.supabase, "iq_v10_family_development_context", {
      p_player_id: playerId,
      p_team_season_id: teamSeasonId || null
    });
  }

  async getDevelopmentCycle(playerId, teamSeasonId = null) {
    requireValue(playerId, "playerId");
    try {
      return await rpc(this.supabase, "iq_v16_family_development_cycle", {
        p_player_id: playerId,
        p_team_season_id: teamSeasonId || null
      });
    } catch (error) {
      const message = String(error?.message || "");
      if (error?.code === "PGRST202" || message.includes("iq_v16_family_development_cycle")) {
        return { allowed: false, reason_code: "DEVELOPMENT_CYCLE_NOT_READY", current_cycle: null };
      }
      throw error;
    }
  }

  createInvitation({ teamSeasonId, playerId, email, expiresHours = 168 } = {}) {
    requireValue(teamSeasonId, "teamSeasonId");
    requireValue(playerId, "playerId");
    requireValue(email, "email");
    return rpc(this.supabase, "iq_v8_family_create_link_invitation", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId,
      p_invite_email: String(email).trim().toLowerCase(),
      p_expires_hours: Number(expiresHours) || 168
    });
  }

  revokeOwnLink(relationshipId, reason = null) {
    requireValue(relationshipId, "relationshipId");
    return rpc(this.supabase, "iq_v8_family_revoke_own_link", {
      p_relationship_id: relationshipId,
      p_reason: reason || null
    });
  }
}

export default FamilyWorkspaceService;
