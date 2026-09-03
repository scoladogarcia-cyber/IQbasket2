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
        "iq_v4_transfer_request_capabilities"
      );
      if (error) throw error;
      this._capabilities = data || { ready: false };
      return this._capabilities;
    } catch {
      // Progressive rollout: V3 remains a valid fallback until V4 is installed.
    }

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

  async listRequests({
    scopeTeamSeasonId = null,
    targetTeamSeasonId = null,
    status = null
  } = {}) {
    const capabilities = await this.getCapabilities();
    if (!capabilities?.ready || !this.supabase) return [];

    const dualReview = Boolean(capabilities?.dual_review);
    const fields = [
      "id",
      "player_id",
      "from_team_season_id",
      "to_team_season_id",
      "status",
      "requested_by",
      "requested_at",
      "workflow_version",
      "reviewed_by",
      "reviewed_at",
      "approved_last_date_from",
      "approved_first_date_to",
      "rejection_reason"
    ];
    if (dualReview) fields.push("requested_first_date_to");

    let query = this.supabase
      .from("roster_transfer_requests")
      .select(fields.join(","))
      .order("requested_at", { ascending: false });

    const normalizedStatus = status ? String(status).trim().toUpperCase() : null;
    if (normalizedStatus) query = query.eq("status", normalizedStatus);

    const scopeId = scopeTeamSeasonId || targetTeamSeasonId || null;
    if (scopeId) {
      query = query.or(
        `from_team_season_id.eq.${scopeId},to_team_season_id.eq.${scopeId}`
      );
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

    const requestsIds = rows.map(row => row.id).filter(Boolean);
    const reviewPromise = dualReview && requestsIds.length > 0
      ? this.supabase
          .from("roster_transfer_reviews")
          .select("id,request_id,side,decision,effective_date,reviewer_id,reviewed_at,reason")
          .in("request_id", requestsIds)
      : Promise.resolve({ data: [], error: null });

    const [playersResult, scopesResult, reviewsResult] = await Promise.all([
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
        : Promise.resolve({ data: [], error: null }),
      reviewPromise
    ]);

    if (playersResult.error) throw playersResult.error;
    if (scopesResult.error) throw scopesResult.error;
    if (reviewsResult.error) throw reviewsResult.error;

    const players = new Map(
      (playersResult.data || []).map(player => [String(player.id), player])
    );
    const scopes = new Map(
      (scopesResult.data || []).map(scope => [String(scope.id), scope])
    );
    const reviewsByRequest = new Map();

    (reviewsResult.data || []).forEach(review => {
      const requestId = String(review.request_id || "");
      if (!reviewsByRequest.has(requestId)) reviewsByRequest.set(requestId, {});
      reviewsByRequest.get(requestId)[String(review.side || "").toUpperCase()] = review;
    });

    return rows.map(row => {
      const player = players.get(String(row.player_id)) || {};
      const sourceScope = scopes.get(String(row.from_team_season_id)) || {};
      const targetScope = scopes.get(String(row.to_team_season_id)) || {};
      const reviews = reviewsByRequest.get(String(row.id)) || {};
      const sourceReview = reviews.SOURCE || null;
      const destinationReview = reviews.DESTINATION || null;
      const dualWorkflow = String(row.workflow_version || "").toUpperCase() === "DUAL_REVIEW_V2";

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
        requestedFirstDateTo: row.requested_first_date_to || null,
        workflowVersion: row.workflow_version,
        dualWorkflow,
        sourceDecision: sourceReview?.decision || (dualWorkflow ? "PENDING" : null),
        sourceDate: sourceReview?.effective_date || row.approved_last_date_from || null,
        sourceReviewedBy: sourceReview?.reviewer_id || null,
        sourceReviewedAt: sourceReview?.reviewed_at || null,
        sourceReason: sourceReview?.reason || null,
        destinationDecision: destinationReview?.decision || (dualWorkflow ? "PENDING" : null),
        destinationDate: destinationReview?.effective_date
          || row.approved_first_date_to
          || row.requested_first_date_to
          || null,
        destinationReviewedBy: destinationReview?.reviewer_id || null,
        destinationReviewedAt: destinationReview?.reviewed_at || null,
        destinationReason: destinationReview?.reason || null,
        readyForFinalization: dualWorkflow
          && sourceReview?.decision === "APPROVED"
          && destinationReview?.decision === "APPROVED",
        reviewedBy: row.reviewed_by || null,
        reviewedAt: row.reviewed_at || null,
        rejectionReason: row.rejection_reason || null
      };
    });
  }

  async listPending({ scopeTeamSeasonId = null, targetTeamSeasonId = null } = {}) {
    return this.listRequests({
      scopeTeamSeasonId,
      targetTeamSeasonId,
      status: "PENDING"
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
    toTeamSeasonId,
    firstDateTo = null
  }) {
    if (!this.supabase) {
      throw new Error("No hay conexión disponible con la base de datos.");
    }

    const capabilities = await this.getCapabilities();
    if (capabilities?.dual_review) {
      const targetStart = toIsoDate(firstDateTo);
      if (!targetStart) {
        throw new Error("La fecha prevista de alta en destino es obligatoria.");
      }

      const { data, error } = await this.supabase.rpc("iq_v4_request_transfer", {
        p_player_id: playerId,
        p_from_team_season_id: fromTeamSeasonId,
        p_to_team_season_id: toTeamSeasonId,
        p_requested_first_date_to: targetStart
      });

      if (error) throw error;
      return data;
    }

    const { data, error } = await this.supabase.rpc("iq_v3_request_transfer", {
      p_player_id: playerId,
      p_from_team_season_id: fromTeamSeasonId,
      p_to_team_season_id: toTeamSeasonId
    });

    if (error) throw error;
    return data;
  }

  async reviewTransferSide({
    requestId,
    side,
    decision,
    effectiveDate = null,
    reason = null
  }) {
    if (!this.supabase) {
      throw new Error("No hay conexión disponible con la base de datos.");
    }

    const normalizedSide = String(side || "").trim().toUpperCase();
    const normalizedDecision = String(decision || "").trim().toUpperCase();
    if (!["SOURCE", "DESTINATION"].includes(normalizedSide)) {
      throw new Error("El lado de revisión del traspaso no es válido.");
    }
    if (!["APPROVED", "REJECTED"].includes(normalizedDecision)) {
      throw new Error("La decisión del traspaso no es válida.");
    }

    const date = normalizedDecision === "APPROVED"
      ? toIsoDate(effectiveDate)
      : null;
    if (normalizedDecision === "APPROVED" && !date) {
      throw new Error("La fecha efectiva es obligatoria para aprobar.");
    }

    const { data, error } = await this.supabase.rpc(
      "iq_v4_review_transfer_side",
      {
        p_request_id: requestId,
        p_side: normalizedSide,
        p_decision: normalizedDecision,
        p_effective_date: date,
        p_reason: reason || null
      }
    );

    if (error) throw error;
    return data;
  }

  async finalizeTransfer({ requestId }) {
    if (!this.supabase) {
      throw new Error("No hay conexión disponible con la base de datos.");
    }

    const { data, error } = await this.supabase.rpc(
      "iq_v4_finalize_transfer_request",
      { p_request_id: requestId }
    );

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
