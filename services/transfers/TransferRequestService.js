/**
 * @fileoverview Persistent player-transfer request workflow for IQBasket v3.
 * @description Keeps transfer request persistence and approval orchestration
 * separate from roster execution. Approved transfers are still executed by the
 * database through the atomic temporal transfer RPC.
 */

function toIsoDate(value = null) {
  if (!value) return null;
  const raw = String(value).trim().slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? raw
    : null;
}

export class TransferRequestService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this._capabilities = null;
  }

  async getCapabilities({ force = false } = {}) {
    if (!this.supabase) return { ready: false };
    if (!force && this._capabilities) return this._capabilities;

    try {
      const { data, error } = await this.supabase.rpc(
        "iq_v3_transfer_request_capabilities"
      );
      if (error) throw error;
      this._capabilities = data || { ready: false };
    } catch (error) {
      console.warn(
        "[TransferRequestService] Backend de solicitudes de traspaso no disponible:",
        error?.message || error
      );
      this._capabilities = { ready: false };
    }

    return this._capabilities;
  }

  async listPending({ targetTeamSeasonId = null } = {}) {
    const capabilities = await this.getCapabilities();
    if (!capabilities?.ready || !this.supabase) return [];

    let query = this.supabase
      .from("roster_transfer_requests")
      .select(
        "id,player_id,from_team_season_id,to_team_season_id,status,requested_by,requested_at,workflow_version"
      )
      .eq("status", "PENDING")
      .order("requested_at", { ascending: true });

    if (targetTeamSeasonId) {
      query = query.eq("to_team_season_id", targetTeamSeasonId);
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    if (!rows?.length) return [];

    const playerIds = [...new Set(rows.map(row => row.player_id).filter(Boolean))];
    const teamSeasonIds = [...new Set(
      rows
        .flatMap(row => [row.from_team_season_id, row.to_team_season_id])
        .filter(Boolean)
    )];

    const [playersResult, scopesResult] = await Promise.all([
      playerIds.length
        ? this.supabase
            .from("players")
            .select("id,first_name,last_name,jersey,primary_position")
            .in("id", playerIds)
        : Promise.resolve({ data: [], error: null }),
      teamSeasonIds.length
        ? this.supabase
            .from("team_seasons")
            .select("id,team_id,season_id,status")
            .in("id", teamSeasonIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (playersResult.error) throw playersResult.error;
    if (scopesResult.error) throw scopesResult.error;

    const players = new Map(
      (playersResult.data || []).map(player => [String(player.id), player])
    );
    const scopes = new Map(
      (scopesResult.data || []).map(scope => [String(scope.id), scope])
    );

    return rows.map(row => {
      const player = players.get(String(row.player_id)) || {};
      const sourceScope = scopes.get(String(row.from_team_season_id)) || {};
      const targetScope = scopes.get(String(row.to_team_season_id)) || {};

      return {
        id: row.id,
        playerId: row.player_id,
        playerName: [player.first_name, player.last_name].filter(Boolean).join(" ")
          || "Jugador",
        fromTeamSeasonId: row.from_team_season_id,
        toTeamSeasonId: row.to_team_season_id,
        originTeamId: sourceScope.team_id || null,
        targetTeamId: targetScope.team_id || null,
        globalSeasonId: targetScope.season_id || sourceScope.season_id || null,
        status: row.status,
        requestedBy: row.requested_by,
        requestedAt: row.requested_at,
        workflowVersion: row.workflow_version
      };
    });
  }

  async listMarket({ targetTeamSeasonId }) {
    if (!this.supabase) {
      throw new Error("No hay conexión disponible con la base de datos.");
    }
    if (!targetTeamSeasonId) {
      throw new Error("No se pudo resolver el equipo-temporada de destino.");
    }

    const { data, error } = await this.supabase.rpc(
      "iq_v3_list_transfer_market",
      {
        p_target_team_season_id: targetTeamSeasonId
      }
    );

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.player_id,
      playerId: row.player_id,
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      playerName: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Jugador",
      jersey: row.jersey,
      primary_position: row.primary_position || "Jugador",
      team_id: row.source_team_id,
      team_name: row.source_team_name || "Equipo",
      from_team_season_id: row.from_team_season_id,
      global_season_id: row.global_season_id,
      source_stint_from: row.source_stint_from,
      pending_to_target: Boolean(row.pending_to_target)
    }));
  }

  async requestTransfer({
    playerId,
    fromTeamSeasonId,
    toTeamSeasonId
  }) {
    if (!this.supabase) {
      throw new Error("No hay conexión disponible con la base de datos.");
    }

    const { data, error } = await this.supabase.rpc("iq_v3_request_transfer", {
      p_player_id: playerId,
      p_from_team_season_id: fromTeamSeasonId,
      p_to_team_season_id: toTeamSeasonId
    });

    if (error) throw error;
    return data;
  }

  async approveTransfer({
    requestId,
    lastDateFrom,
    firstDateTo
  }) {
    if (!this.supabase) {
      throw new Error("No hay conexión disponible con la base de datos.");
    }

    const sourceEnd = toIsoDate(lastDateFrom);
    const targetStart = toIsoDate(firstDateTo);
    if (!sourceEnd || !targetStart) {
      throw new Error("Las fechas de salida y alta son obligatorias.");
    }
    if (targetStart <= sourceEnd) {
      throw new Error("La fecha de alta en destino debe ser posterior al último día en origen.");
    }

    const { data, error } = await this.supabase.rpc(
      "iq_v3_approve_transfer_request",
      {
        p_request_id: requestId,
        p_last_date_from: sourceEnd,
        p_first_date_to: targetStart
      }
    );

    if (error) throw error;
    return data;
  }

  async rejectTransfer({ requestId, reason = null }) {
    if (!this.supabase) {
      throw new Error("No hay conexión disponible con la base de datos.");
    }

    const { data, error } = await this.supabase.rpc(
      "iq_v3_reject_transfer_request",
      {
        p_request_id: requestId,
        p_reason: reason || null
      }
    );

    if (error) throw error;
    return data;
  }
}

export default TransferRequestService;
