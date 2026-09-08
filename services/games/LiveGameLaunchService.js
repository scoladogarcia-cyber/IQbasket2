/**
 * @fileoverview Secure creation + launch boundary for a new live game.
 * @description A live capture session must always have a persisted game id before
 * acquiring a writer lease or publishing data to followers. This service keeps
 * creation, sporting lifecycle and authorization in one place while reusing the
 * existing DataStore and GamePlayStateService backends.
 */

import { DataStore } from "../DataStore.js";
import { Permission } from "../../security/PermissionService.js";
import { GamePlayStateService } from "./GamePlayStateService.js";

const GamePlayState = Object.freeze({
  SCHEDULED: "SCHEDULED",
  READY: "READY",
  LIVE: "LIVE"
});

function text(value = "") {
  return String(value ?? "").trim();
}

function dateOnly(value = "") {
  const raw = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function timeOnly(value = "") {
  const raw = text(value);
  return /^\d{2}:\d{2}$/.test(raw) ? raw : "";
}

export class LiveGameLaunchService {
  constructor(supabaseClient = null, authController = null) {
    this.auth = authController || DataStore.permissionService || null;
    this.playState = new GamePlayStateService(supabaseClient);
  }

  _assert(permission, context, message) {
    if (!this.auth?.can?.(permission, context)) throw new Error(message);
  }

  _validatePlayers(teamId, effectiveDate, starterIds = []) {
    const eligibleIds = new Set(
      (DataStore.getPlayersEligibleOnDate?.(teamId, effectiveDate) || [])
        .map(player => String(player.id))
    );
    const unique = [...new Set(starterIds.map(String).filter(Boolean))];
    if (unique.length !== 5) {
      throw new Error("Selecciona exactamente 5 jugadoras para iniciar el partido.");
    }
    const invalid = unique.filter(id => !eligibleIds.has(id));
    if (invalid.length) {
      throw new Error("El quinteto contiene jugadoras que no son elegibles en la fecha del partido.");
    }
    return unique;
  }

  /**
   * Persist the game first, then move the sporting lifecycle to LIVE.
   * If a lifecycle transition fails, the already-created game is intentionally
   * preserved so it can be resumed safely instead of silently losing the setup.
   */
  async createAndStart(input = {}) {
    const teamId = text(input.teamId || DataStore.getActiveTeamId?.());
    const seasonId = input.seasonId || DataStore.getActiveSeasonId?.(teamId) || null;
    const teamSeasonId = input.teamSeasonId || DataStore.getActiveTeamSeasonId?.(teamId) || null;
    const date = dateOnly(input.date) || new Date().toISOString().slice(0, 10);
    const time = timeOnly(input.time) || "18:00";
    const opponent = text(input.opponent);
    const venue = ["Local", "Visitante"].includes(input.venue) ? input.venue : "Local";
    const context = { teamId, seasonId, teamSeasonId };

    if (!teamId || !teamSeasonId) throw new Error("No se pudo resolver el equipo y la temporada activos.");
    if (!opponent) throw new Error("Indica el rival antes de iniciar el partido.");

    this._assert(Permission.CREATE_GAME, context, "No tienes permiso para crear un partido nuevo.");
    this._assert(Permission.RECORD_LIVE_GAME, context, "No tienes permiso para anotar partidos en vivo.");
    this._assert(Permission.PREPARE_GAME, context, "No tienes permiso para preparar el partido.");
    this._assert(Permission.START_GAME, context, "No tienes permiso para iniciar el partido.");

    const starterIds = this._validatePlayers(teamId, date, input.starterIds || []);
    const team = DataStore.getTeamById?.(teamId) || {};
    const periods = [1, 2, 3, 4].map(periodNumber => ({
      period_type: "quarter",
      period_number: periodNumber,
      team_score: 0,
      opponent_score: 0,
      is_overtime: false
    }));

    const gameId = await DataStore.saveGameAndStats({
      team_id: teamId,
      season_id: seasonId,
      team_season_id: teamSeasonId,
      date,
      time,
      opponent,
      competition: text(input.competition) || team.competition || "Liga",
      round: text(input.round) || "Partido en vivo",
      venue,
      venue_name: text(input.venueName),
      status: "Programado",
      edit_state: "OPEN",
      starter_ids: starterIds,
      notes: text(input.notes),
      team_score: 0,
      opponent_score: 0
    }, [], periods, []);

    try {
      const snapshot = await this.playState.snapshot(gameId);
      let state = text(snapshot.play_state || snapshot.playState || GamePlayState.SCHEDULED).toUpperCase();

      if (state === GamePlayState.SCHEDULED) {
        const prepared = await this.playState.transition({
          gameId,
          targetState: GamePlayState.READY,
          reason: "Preparado desde alta de anotación en vivo V39"
        });
        state = text(prepared.play_state || GamePlayState.READY).toUpperCase();
      }

      if (state === GamePlayState.READY) {
        const started = await this.playState.transition({
          gameId,
          targetState: GamePlayState.LIVE,
          reason: "Inicio desde alta de anotación en vivo V39"
        });
        state = text(started.play_state || GamePlayState.LIVE).toUpperCase();
      }

      if (state !== GamePlayState.LIVE) {
        throw new Error(`El partido quedó en estado ${state || "desconocido"} y no pudo iniciarse.`);
      }

      const local = DataStore.getGameById?.(gameId);
      if (local) {
        local.play_state = GamePlayState.LIVE;
        local.playState = GamePlayState.LIVE;
        local.status = "En vivo";
      }
      return { gameId, state: GamePlayState.LIVE };
    } catch (error) {
      error.gameId = gameId;
      throw error;
    }
  }
}

export default LiveGameLaunchService;
