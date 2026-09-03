/**
 * @fileoverview Agregador read-only de auditoría operativa de IQBasket.
 * @description Unifica históricos ya persistidos sin crear una segunda fuente
 * de verdad. Nunca escribe en tablas, RPCs ni datos deportivos.
 */

import { TeamAccessRequestService } from "./TeamAccessRequestService.js";
import { TransferRequestService } from "./transfers/TransferRequestService.js";

export const AuditEventType = Object.freeze({
  GAME: "GAME",
  SEASON: "SEASON",
  TRANSFER: "TRANSFER",
  ACCESS: "ACCESS"
});

function upper(value = "") {
  return String(value || "").trim().toUpperCase();
}

function safeDate(value = null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : value;
}

function teamContext(dataStore, teamId) {
  const team = dataStore?.getTeamById?.(teamId)
    || (dataStore?.getTeams?.() || []).find(item => String(item.id) === String(teamId || ""))
    || {};
  const scope = dataStore?.getActiveSeasonContext?.(teamId) || null;
  return { team, scope };
}

export class AuditCenterService {
  constructor(supabaseClient, dataStore) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.dataStore = dataStore;
    this.teamAccessService = new TeamAccessRequestService(this.supabase);
    this.transferService = new TransferRequestService(this.supabase);
  }

  _gamesForScope(teamId, teamSeasonId = null) {
    const source = this.dataStore?.getGamesForActiveSeason?.(teamId)
      || this.dataStore?.getGames?.(teamId)
      || [];

    if (!teamSeasonId) return source;
    return source.filter(game => {
      const scopeId = game.team_season_id || game.teamSeasonId || null;
      return !scopeId || String(scopeId) === String(teamSeasonId);
    });
  }

  async _loadGameHistory(games = []) {
    if (!this.supabase || games.length === 0) return [];
    const ids = games.map(game => game.id).filter(Boolean);
    if (ids.length === 0) return [];

    const { data, error } = await this.supabase
      .from("game_lock_history")
      .select("id,game_id,request_id,action,actor_id,actor_role,reason,created_at")
      .in("game_id", ids)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async _loadSeasonHistory(teamSeasonId = null) {
    if (!this.supabase || !teamSeasonId) return [];

    const { data, error } = await this.supabase
      .from("team_season_freeze_history")
      .select("id,team_season_id,request_id,action,actor_id,actor_role,reason,metadata,created_at")
      .eq("team_season_id", teamSeasonId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async _loadTransferWorkflow(teamSeasonId = null) {
    if (!teamSeasonId) return [];
    return this.transferService.listRequests({ scopeTeamSeasonId: teamSeasonId });
  }

  async _loadAccessWorkflow(teamId = null, teamSeasonId = null) {
    if (!teamId) return [];
    const rows = await this.teamAccessService.listRequests();
    return (rows || []).filter(row => {
      if (String(row.teamId || row.team_id || "") !== String(teamId)) return false;
      const scopeId = row.team_season_id || row.teamSeasonId || null;
      return !teamSeasonId || !scopeId || String(scopeId) === String(teamSeasonId);
    });
  }

  async _loadActors(actorIds = []) {
    if (!this.supabase) return new Map();
    const ids = [...new Set(actorIds.map(String).filter(Boolean))];
    if (ids.length === 0) return new Map();

    try {
      const { data, error } = await this.supabase
        .from("user_profiles")
        .select("id,email,first_name,last_name")
        .in("id", ids);

      if (error) return new Map();
      return new Map((data || []).map(user => [String(user.id), user]));
    } catch {
      return new Map();
    }
  }

  _actorLabel(actorId, actorRole, actors) {
    const user = actorId ? actors.get(String(actorId)) : null;
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
    return {
      actorId: actorId || null,
      actorRole: actorRole || null,
      actorName: fullName || user?.email || actorRole || "Sistema"
    };
  }

  _normalizeGameRows(rows, gamesById, actors, context) {
    return (rows || []).map(row => {
      const game = gamesById.get(String(row.game_id)) || {};
      return {
        id: "game:" + row.id,
        sourceId: row.id,
        type: AuditEventType.GAME,
        action: "GAME_" + upper(row.action),
        occurredAt: safeDate(row.created_at),
        title: game.opponent || game.opponent_name || game.opponentName || "Partido",
        subtitle: [game.date || null, context.team?.name || null].filter(Boolean).join(" · "),
        reason: row.reason || "",
        teamId: game.team_id || game.teamId || context.team?.id || null,
        teamSeasonId: game.team_season_id || game.teamSeasonId || context.scope?.team_season_id || null,
        requestId: row.request_id || null,
        ...this._actorLabel(row.actor_id, row.actor_role, actors),
        raw: row
      };
    });
  }

  _normalizeSeasonRows(rows, actors, context) {
    return (rows || []).map(row => ({
      id: "season:" + row.id,
      sourceId: row.id,
      type: AuditEventType.SEASON,
      action: "SEASON_" + upper(row.action),
      occurredAt: safeDate(row.created_at),
      title: context.team?.name || "Equipo",
      subtitle: context.scope?.name || context.scope?.code || "Temporada",
      reason: row.reason || "",
      teamId: context.team?.id || null,
      teamSeasonId: row.team_season_id || null,
      requestId: row.request_id || null,
      metadata: row.metadata || {},
      ...this._actorLabel(row.actor_id, row.actor_role, actors),
      raw: row
    }));
  }

  _normalizeTransfers(rows, actors, context) {
    const events = [];

    (rows || []).forEach(row => {
      const route = [
        this.dataStore?.getTeamById?.(row.originTeamId)?.name || "Origen",
        this.dataStore?.getTeamById?.(row.targetTeamId)?.name || "Destino"
      ].join(" → ");

      if (row.requestedAt) {
        events.push({
          id: "transfer:" + row.id + ":requested",
          sourceId: row.id,
          type: AuditEventType.TRANSFER,
          action: "TRANSFER_REQUESTED",
          occurredAt: safeDate(row.requestedAt),
          title: row.playerName || "Jugador",
          subtitle: route,
          reason: "",
          teamId: context.team?.id || null,
          teamSeasonId: context.scope?.team_season_id || null,
          ...this._actorLabel(row.requestedBy, "SOLICITANTE", actors),
          raw: row
        });
      }

      const sideEvents = [
        {
          side: "SOURCE",
          decision: row.sourceDecision,
          at: row.sourceReviewedAt,
          actor: row.sourceReviewedBy,
          reason: row.sourceReason,
          date: row.sourceDate
        },
        {
          side: "DESTINATION",
          decision: row.destinationDecision,
          at: row.destinationReviewedAt,
          actor: row.destinationReviewedBy,
          reason: row.destinationReason,
          date: row.destinationDate
        }
      ];

      sideEvents.forEach(side => {
        if (!side.at || !side.decision || upper(side.decision) === "PENDING") return;
        events.push({
          id: "transfer:" + row.id + ":" + side.side.toLowerCase(),
          sourceId: row.id,
          type: AuditEventType.TRANSFER,
          action: "TRANSFER_" + side.side + "_" + upper(side.decision),
          occurredAt: safeDate(side.at),
          title: row.playerName || "Jugador",
          subtitle: route,
          reason: side.reason || "",
          effectiveDate: side.date || null,
          teamId: context.team?.id || null,
          teamSeasonId: context.scope?.team_season_id || null,
          ...this._actorLabel(side.actor, "REVISOR", actors),
          raw: row
        });
      });

      const finalStatus = upper(row.status);
      if (row.reviewedAt && ["APPROVED","REJECTED","CANCELLED"].includes(finalStatus)) {
        events.push({
          id: "transfer:" + row.id + ":final",
          sourceId: row.id,
          type: AuditEventType.TRANSFER,
          action: finalStatus === "APPROVED"
            ? "TRANSFER_FINALIZED"
            : "TRANSFER_" + finalStatus,
          occurredAt: safeDate(row.reviewedAt),
          title: row.playerName || "Jugador",
          subtitle: route,
          reason: row.rejectionReason || "",
          teamId: context.team?.id || null,
          teamSeasonId: context.scope?.team_season_id || null,
          ...this._actorLabel(row.reviewedBy, "REVISOR", actors),
          raw: row
        });
      }
    });

    return events;
  }

  _normalizeAccess(rows, context) {
    return (rows || []).map(row => {
      const status = upper(row.status === "PENDIENTE" ? "PENDING" : row.status);
      return {
        id: "access:" + row.id,
        sourceId: row.id,
        type: AuditEventType.ACCESS,
        action: "ACCESS_REQUEST_" + status,
        occurredAt: safeDate(row.created_at),
        title: row.userName || row.userEmail || "Usuario",
        subtitle: [row.teamName || context.team?.name, row.requestedRole].filter(Boolean).join(" · "),
        reason: row.notes || "",
        teamId: row.teamId || row.team_id || context.team?.id || null,
        teamSeasonId: row.team_season_id || null,
        actorId: row.user_id || null,
        actorRole: row.requestedRole || null,
        actorName: row.userName || row.userEmail || "Usuario",
        timestampSemantics: "REQUEST_CREATED",
        raw: row
      };
    });
  }

  async load({ teamId = null, teamSeasonId = null } = {}) {
    const activeTeamId = teamId || this.dataStore?.getActiveTeamId?.() || null;
    const context = teamContext(this.dataStore, activeTeamId);
    const activeTeamSeasonId = teamSeasonId
      || this.dataStore?.getActiveTeamSeasonId?.(activeTeamId)
      || context.scope?.team_season_id
      || context.scope?.teamSeasonId
      || null;
    const games = this._gamesForScope(activeTeamId, activeTeamSeasonId);
    const gamesById = new Map(games.map(game => [String(game.id), game]));

    const [gameResult, seasonResult, transferResult, accessResult] = await Promise.allSettled([
      this._loadGameHistory(games),
      this._loadSeasonHistory(activeTeamSeasonId),
      this._loadTransferWorkflow(activeTeamSeasonId),
      this._loadAccessWorkflow(activeTeamId, activeTeamSeasonId)
    ]);

    const errors = [];
    const gameRows = gameResult.status === "fulfilled" ? gameResult.value : [];
    const seasonRows = seasonResult.status === "fulfilled" ? seasonResult.value : [];
    const transferRows = transferResult.status === "fulfilled" ? transferResult.value : [];
    const accessRows = accessResult.status === "fulfilled" ? accessResult.value : [];

    [
      [AuditEventType.GAME, gameResult],
      [AuditEventType.SEASON, seasonResult],
      [AuditEventType.TRANSFER, transferResult],
      [AuditEventType.ACCESS, accessResult]
    ].forEach(([source, result]) => {
      if (result.status === "rejected") {
        errors.push({ source, message: result.reason?.message || String(result.reason || "Error") });
      }
    });

    const actorIds = [
      ...gameRows.flatMap(row => [row.actor_id]),
      ...seasonRows.flatMap(row => [row.actor_id]),
      ...transferRows.flatMap(row => [
        row.requestedBy,
        row.sourceReviewedBy,
        row.destinationReviewedBy,
        row.reviewedBy
      ])
    ].filter(Boolean);
    const actors = await this._loadActors(actorIds);

    const scopedContext = {
      ...context,
      scope: {
        ...(context.scope || {}),
        team_season_id: activeTeamSeasonId
      }
    };

    const events = [
      ...this._normalizeGameRows(gameRows, gamesById, actors, scopedContext),
      ...this._normalizeSeasonRows(seasonRows, actors, scopedContext),
      ...this._normalizeTransfers(transferRows, actors, scopedContext),
      ...this._normalizeAccess(accessRows, scopedContext)
    ].sort((a, b) => {
      const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
      const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
      return bTime - aTime;
    });

    return {
      teamId: activeTeamId,
      teamSeasonId: activeTeamSeasonId,
      teamName: context.team?.name || "Equipo",
      seasonName: context.scope?.name || context.scope?.code || "",
      events,
      errors,
      partial: errors.length > 0
    };
  }
}

export default AuditCenterService;
