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

export class FamilyWorkspaceService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  listPlayers() {
    return rpc(this.supabase, "iq_v8_family_list_players");
  }

  claimLink(claimCode) {
    requireValue(claimCode, "claimCode");
    return rpc(this.supabase, "iq_v8_family_claim_link", {
      p_claim_code: String(claimCode).trim()
    });
  }

  bootstrapFree(playerId) {
    requireValue(playerId, "playerId");
    return rpc(this.supabase, "iq_v8_family_bootstrap_free", {
      p_player_id: playerId
    });
  }

  getProductSnapshot(playerId) {
    requireValue(playerId, "playerId");
    return rpc(this.supabase, "iq_v8_family_product_snapshot", {
      p_player_id: playerId
    });
  }

  getPassport(playerId) {
    requireValue(playerId, "playerId");
    return rpc(this.supabase, "iq_v8_family_player_passport", {
      p_player_id: playerId
    });
  }

  getPlayer360Snapshot(playerId, teamSeasonId = null) {
    requireValue(playerId, "playerId");
    return rpc(this.supabase, "iq_v8_family_player360_snapshot", {
      p_player_id: playerId,
      p_team_season_id: teamSeasonId || null
    });
  }

  getDevelopmentContext(playerId, teamSeasonId = null) {
    requireValue(playerId, "playerId");
    return rpc(this.supabase, "iq_v10_family_development_context", {
      p_player_id: playerId,
      p_team_season_id: teamSeasonId || null
    });
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
