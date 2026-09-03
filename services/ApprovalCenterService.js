/**
 * @fileoverview Agregador desacoplado para solicitudes y aprobaciones de IQBasket.
 * @description Normaliza flujos existentes sin duplicar sus escrituras. V1 integra:
 * - solicitudes de acceso a equipo;
 * - solicitudes de cierre de partido.
 *
 * Nuevos flujos (traspasos, privacidad, cierres de temporada, etc.) deben añadirse
 * como adaptadores independientes manteniendo este contrato común.
 */

import { DataStore } from "./DataStore.js";
import { TeamAccessRequestService } from "./TeamAccessRequestService.js";
import { GameLockService } from "./games/GameLockService.js";
import { Permission } from "../security/PermissionService.js";

const RequestType = Object.freeze({
  TEAM_ACCESS: "TEAM_ACCESS",
  GAME_LOCK: "GAME_LOCK"
});

function normalizeStatus(value = "") {
  const status = String(value || "").trim().toUpperCase();
  if (["PENDING", "PENDIENTE"].includes(status)) return "PENDING";
  if (["APPROVED", "APROBADO", "APROBADA"].includes(status)) return "APPROVED";
  if (["REJECTED", "RECHAZADO", "RECHAZADA"].includes(status)) return "REJECTED";
  if (["CANCELLED", "CANCELED", "CANCELADO", "CANCELADA"].includes(status)) return "CANCELLED";
  return status || "UNKNOWN";
}

function toTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export class ApprovalCenterService {
  constructor(supabase, authController, dataStore = DataStore) {
    this.supabase = supabase || null;
    this.auth = authController || null;
    this.dataStore = dataStore;
    this.teamAccessService = new TeamAccessRequestService(this.supabase);
    this.gameLockService = new GameLockService(this.supabase, this.auth);
  }

  _activeGames() {
    const activeTeamId = this.dataStore.getActiveTeamId?.() || null;
    return this.dataStore.getGamesForActiveSeason?.(activeTeamId)
      || this.dataStore.getGames?.(activeTeamId)
      || [];
  }

  _normalizeTeamAccessRequest(request = {}) {
    const teamId = request.teamId || request.team_id || null;
    const status = normalizeStatus(request.status);
    const canReview = status === "PENDING"
      && Boolean(this.auth?.canPreview?.(Permission.APPROVE_TEAM_ACCESS, { teamId }));

    return {
      id: request.id,
      type: RequestType.TEAM_ACCESS,
      status,
      createdAt: request.created_at || request.requested_at || null,
      resolvedAt: request.reviewed_at || request.resolved_at || null,
      title: request.userName || request.userEmail || "",
      subtitle: "",
      detail: request.notes || "",
      teamName: request.teamName || "",
      requestedRole: request.requestedRole || request.requested_role || "VISOR",
      teamId,
      teamSeasonId: request.team_season_id || request.teamSeasonId || null,
      actor: request.userEmail || request.userName || "",
      canApprove: canReview,
      canReject: canReview,
      raw: request
    };
  }

  _normalizeGameLockRequest(request = {}, gameMap = new Map()) {
    const game = gameMap.get(String(request.game_id || request.gameId || "")) || {};
    const status = normalizeStatus(request.status);
    const teamId = game.team_id || game.teamId || this.dataStore.getActiveTeamId?.() || null;
    const teamSeasonId = game.team_season_id || game.teamSeasonId || null;
    const canReview = status === "PENDING" && this.gameLockService.canReviewRequests(game);

    const opponent = game.opponent || game.opponentName || "";
    const date = game.date || "";

    return {
      id: request.id,
      type: RequestType.GAME_LOCK,
      status,
      createdAt: request.created_at || null,
      resolvedAt: request.resolved_at || null,
      title: opponent,
      subtitle: "",
      detail: request.request_reason || request.resolution_note || "",
      opponent,
      gameDate: date,
      requestedRole: request.requested_by_role || "",
      teamId,
      teamSeasonId,
      gameId: request.game_id || request.gameId || null,
      actor: request.requested_by_role || "",
      canApprove: canReview,
      canReject: canReview,
      raw: request
    };
  }

  async load() {
    const games = this._activeGames();
    const gameMap = new Map(games.map(game => [String(game.id), game]));
    const gameIds = games.map(game => game.id).filter(Boolean);

    const [accessResult, lockResult] = await Promise.allSettled([
      this.teamAccessService.listRequests(),
      gameIds.length > 0
        ? this.gameLockService.listRequests(gameIds)
        : Promise.resolve([])
    ]);

    const errors = [];
    const items = [];

    if (accessResult.status === "fulfilled") {
      items.push(...(accessResult.value || []).map(request => this._normalizeTeamAccessRequest(request)));
    } else {
      errors.push({
        source: RequestType.TEAM_ACCESS,
        message: accessResult.reason?.message || String(accessResult.reason || "Error cargando accesos")
      });
    }

    if (lockResult.status === "fulfilled") {
      items.push(...(lockResult.value || []).map(request => this._normalizeGameLockRequest(request, gameMap)));
    } else {
      errors.push({
        source: RequestType.GAME_LOCK,
        message: lockResult.reason?.message || String(lockResult.reason || "Error cargando cierres")
      });
    }

    items.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

    return {
      items,
      errors,
      pendingCount: items.filter(item => item.status === "PENDING").length,
      resolvedCount: items.filter(item => item.status !== "PENDING").length
    };
  }

  async approve(item, note = null) {
    if (!item?.id || !item?.canApprove) {
      throw new Error("No tienes permiso para aprobar esta solicitud.");
    }

    if (item.type === RequestType.TEAM_ACCESS) {
      return this.teamAccessService.reviewRequest(item.id, true);
    }

    if (item.type === RequestType.GAME_LOCK) {
      return this.gameLockService.resolveRequest(item.id, "APPROVED", note || "Aprobado desde Bandeja de Solicitudes");
    }

    throw new Error("Tipo de solicitud no soportado.");
  }

  async reject(item, note = null) {
    if (!item?.id || !item?.canReject) {
      throw new Error("No tienes permiso para rechazar esta solicitud.");
    }

    if (item.type === RequestType.TEAM_ACCESS) {
      return this.teamAccessService.reviewRequest(item.id, false);
    }

    if (item.type === RequestType.GAME_LOCK) {
      return this.gameLockService.resolveRequest(item.id, "REJECTED", note || null);
    }

    throw new Error("Tipo de solicitud no soportado.");
  }
}

export { RequestType, normalizeStatus };
export default ApprovalCenterService;
