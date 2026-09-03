/**
 * @fileoverview Entidad del Dominio: Game (Partido).
 * @description Representa el estado y metadatos de un partido en iqbasket.
 * Implementa la arquitectura de Fuente Única de Verdad (Single Source of Truth)
 * mediante Event Sourcing inmutable (events), delegando cualquier cálculo
 * estadístico o matemático al motor central (StatsEngine).
 * 
 * Cumple con soporte para:
 * - Prórrogas ilimitadas (OT1, OT2, ...).
 * - Convocatoria y quintetos iniciales por periodo.
 * - Control de sincronización local-first con aprobación administrativa.
 * - Aislamiento multi-equipo y multi-temporada.
 */

import { GamePeriod } from "./GamePeriod.js";

/**
 * Estados de sincronización del partido con el servidor central.
 * @readonly
 * @enum {string}
 */
export const SyncStatus = {
  SYNCHRONIZED: "SYNCHRONIZED",       // Datos idénticos a los aprobados en el servidor
  PENDING_APPROVAL: "PENDING_APPROVAL", // Propuesta de cambio enviada al Admin
  LOCAL_DRAFT: "LOCAL_DRAFT",         // Modificaciones exclusivas en local sin enviar
  CONFLICT: "CONFLICT"                // Servidor tiene versión más reciente que la local
};

/**
 * Estados operativos del ciclo de vida del partido.
 * @readonly
 * @enum {string}
 */
export const GameStatus = {
  SCHEDULED: "SCHEDULED", // Programado
  IN_PROGRESS: "IN_PROGRESS", // En juego
  FINISHED: "FINISHED",   // Finalizado (pendiente de validación de acta)
  CLOSED: "CLOSED"        // Acta cerrada y oficializada
};

export class Game {
  /**
   * Crea una instancia de Partido.
   * @param {Object} params - Parámetros de inicialización del partido.
   * @param {string|null} [params.id=null] - Identificador único universal (UUID).
   * @param {string|null} [params.teamId=null] - ID del equipo propio asociado.
   * @param {string|null} [params.seasonId=null] - ID legacy de public.seasons durante la transición.
   * @param {string|null} [params.teamSeasonId=null] - ID v3 del contexto equipo-temporada.
   * @param {string|null} [params.clubId=null] - ID del club o tenant para aislamiento multiclub.
   * @param {string|null} [params.date=null] - Fecha del partido (YYYY-MM-DD).
   * @param {string} [params.time=""] - Hora del encuentro (HH:mm).
   * @param {string} [params.opponent=""] - Nombre del equipo rival.
   * @param {string} [params.competition=""] - Nombre de la competición / liga.
   * @param {string} [params.round=""] - Jornada o fase del torneo.
   * @param {string} [params.venue="Local"] - Condición de juego: "Local" | "Visitante" | "Neutral".
   * @param {string} [params.venueName=""] - Nombre del pabellón o pista de juego.
   * @param {number} [params.periodsCount=4] - Número reglamentario de periodos estándar.
   * @param {number} [params.periodMinutes=10] - Duración reglamentaria de cada periodo en minutos.
   * @param {number} [params.overtimeMinutes=5] - Duración de cada periodo de prórroga en minutos.
   * @param {string} [params.status=GameStatus.SCHEDULED] - Estado del partido.
   * @param {number} [params.teamScore=0] - Marcador acumulado del equipo propio.
   * @param {number} [params.opponentScore=0] - Marcador acumulado del rival.
   * @param {Array<Object|GamePeriod>} [params.periods=[]] - Metadatos de cada cuarto/prórroga.
   * @param {Array<string>} [params.rosterIds=[]] - IDs de los jugadores convocados al partido.
   * @param {Array<string>} [params.starterIds=[]] - IDs de los 5 titulares iniciales del Q1.
   * @param {Array<Object>} [params.events=[]] - Lista atómica de eventos (Event Sourcing).
   * @param {Object} [params.playerMinutes={}] - Mapa { playerId: minutosJugadosEnSegundos }.
   * @param {string} [params.observations=""] - Observaciones técnicas o tácticas del partido.
   * @param {string|null} [params.videoUrl=null] - Enlace a vídeo para scouting o análisis.
   * @param {string} [params.notes=""] - Notas privadas del cuerpo técnico.
   * @param {string} [params.syncStatus=SyncStatus.LOCAL_DRAFT] - Estado de sincronización cloud.
   * @param {number} [params.version=1] - Versión incremental para control de concurrencia optimista.
   * @param {string|null} [params.lastModifiedBy=null] - ID del usuario que realizó el último cambio.
   * @param {string|null} [params.serverUpdatedAt=null] - Timestamp ISO de última validación en servidor.
   * @param {string|null} [params.localUpdatedAt=null] - Timestamp ISO de última edición en local.
   * @param {string|null} [params.createdAt=null] - Timestamp ISO de creación del registro.
   * @param {string|null} [params.updatedAt=null] - Timestamp ISO de actualización general.
   */
  constructor({
    id = null,
    teamId = null,
    seasonId = null,
    teamSeasonId = null,
    clubId = null,
    date = null,
    time = "",
    opponent = "",
    competition = "",
    round = "",
    venue = "Local",
    venueName = "",
    periodsCount = 4,
    periodMinutes = 10,
    overtimeMinutes = 5,
    status = GameStatus.SCHEDULED,
    teamScore = 0,
    opponentScore = 0,
    periods = [],
    rosterIds = [],
    starterIds = [],
    events = [],
    playerMinutes = {},
    observations = "",
    videoUrl = null,
    notes = "",
    syncStatus = SyncStatus.LOCAL_DRAFT,
    version = 1,
    lastModifiedBy = null,
    serverUpdatedAt = null,
    localUpdatedAt = null,
    createdAt = null,
    updatedAt = null
  } = {}) {
    // Identificadores relacionales y contexto multitenant
    this.id = id;
    this.teamId = teamId;
    this.seasonId = seasonId;
    this.teamSeasonId = teamSeasonId;
    this.clubId = clubId;

    // Metadatos y calendario del encuentro
    this.date = date;
    this.time = time;
    this.opponent = opponent;
    this.competition = competition;
    this.round = round;
    this.venue = venue;
    this.venueName = venueName;

    // Configuración reglamentaria del tiempo
    this.periodsCount = Number(periodsCount) || 4;
    this.periodMinutes = Number(periodMinutes) || 10;
    this.overtimeMinutes = Number(overtimeMinutes) || 5;
    this.status = status;

    // Marcadores acumulados (snapshots de conveniencia, derivados de events por StatsEngine)
    this.teamScore = Number(teamScore) || 0;
    this.opponentScore = Number(opponentScore) || 0;

    // Parseo seguro de periodos
    let rawPeriods = periods;
    if (typeof periods === "string") {
      try {
        rawPeriods = JSON.parse(periods);
      } catch {
        rawPeriods = [];
      }
    }
    this.periods = Array.isArray(rawPeriods)
      ? rawPeriods.map((p) => (p instanceof GamePeriod ? p : new GamePeriod(p)))
      : [];

    // Parseo seguro de convocatoria (rosterIds)
    this.rosterIds = this._parseArraySafe(rosterIds);

    // Parseo seguro de quinteto titular (starterIds)
    this.starterIds = this._parseArraySafe(starterIds);

    // Parseo seguro de eventos (Single Source of Truth)
    this.events = this._parseArraySafe(events);

    // Mapeo de minutos reales ajustados en acta { [playerId]: seconds }
    let rawPlayerMinutes = playerMinutes;
    if (typeof playerMinutes === "string") {
      try {
        rawPlayerMinutes = JSON.parse(playerMinutes);
      } catch {
        rawPlayerMinutes = {};
      }
    }
    this.playerMinutes = (typeof rawPlayerMinutes === "object" && rawPlayerMinutes !== null)
      ? rawPlayerMinutes
      : {};

    // Multimedia y anotaciones
    this.observations = observations || "";
    this.videoUrl = videoUrl || null;
    this.notes = notes || "";

    // Control de sincronización, auditoría y concurrencia
    this.syncStatus = syncStatus;
    this.version = Number(version) || 1;
    this.lastModifiedBy = lastModifiedBy;
    this.serverUpdatedAt = serverUpdatedAt;
    this.localUpdatedAt = localUpdatedAt || new Date().toISOString();
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  /**
   * Helper privado para parsear arrays de forma segura ante cadenas JSON o entradas nulas.
   * @private
   * @param {Array|string|null} input - Dato a parsear.
   * @returns {Array} Array resultante.
   */
  _parseArraySafe(input) {
    if (typeof input === "string") {
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(input) ? input : [];
  }

  /**
   * Añade un nuevo evento atómico a la lista inmutable del partido.
   * La actualización de marcadores y estadísticas derivadas debe gestionarse en StatsEngine.
   * @param {Object} gameEvent - Evento a registrar (tiro, falta, rebote, sustitución, etc.).
   */
  addEvent(gameEvent) {
    if (!gameEvent || typeof gameEvent !== "object") return;
    this.events.push(gameEvent);
    this.touchLocal();
  }

  /**
   * Elimina un evento específico por su identificador único (utilizado por el Play-by-Play editable o Undo).
   * @param {string} eventId - UUID del evento a eliminar.
   * @returns {boolean} True si se encontró y eliminó el evento, false en caso contrario.
   */
  removeEvent(eventId) {
    const initialLength = this.events.length;
    this.events = this.events.filter((evt) => evt.id !== eventId);
    const removed = this.events.length < initialLength;
    if (removed) {
      this.touchLocal();
    }
    return removed;
  }

  /**
   * Registra una estructura de periodo (cuarto reglamentario o prórroga ilimitada).
   * @param {GamePeriod|Object} periodInstance - Instancia o datos del periodo.
   */
  addPeriod(periodInstance) {
    const period = periodInstance instanceof GamePeriod
      ? periodInstance
      : new GamePeriod(periodInstance);
    this.periods.push(period);
    this.touchLocal();
  }

  /**
   * Actualiza la marca de tiempo local y el estado a borrador cuando se produce una modificación.
   */
  touchLocal() {
    this.localUpdatedAt = new Date().toISOString();
    this.updatedAt = this.localUpdatedAt;
    if (this.syncStatus === SyncStatus.SYNCHRONIZED) {
      this.syncStatus = SyncStatus.LOCAL_DRAFT;
    }
  }

  /**
   * Convierte la entidad a un objeto plano preparado para persistencia (SQLite, IndexedDB, Supabase).
   * Respeta los convenios de nombres en snake_case para la base de datos central.
   * @returns {Object} Representación serializable del partido.
   */
  toJSON() {
    return {
      id: this.id,
      team_id: this.teamId,
      season_id: this.seasonId,
      team_season_id: this.teamSeasonId,
      club_id: this.clubId,
      date: this.date,
      time: this.time,
      opponent: this.opponent,
      competition: this.competition,
      round: this.round,
      venue: this.venue,
      venue_name: this.venueName,
      periods_count: this.periodsCount,
      period_minutes: this.periodMinutes,
      overtime_minutes: this.overtimeMinutes,
      status: this.status,
      team_score: this.teamScore,
      opponent_score: this.opponentScore,
      periods: JSON.stringify(this.periods.map((p) => (p.toJSON ? p.toJSON() : p))),
      roster_ids: JSON.stringify(this.rosterIds),
      starter_ids: JSON.stringify(this.starterIds),
      events: JSON.stringify(this.events),
      player_minutes: JSON.stringify(this.playerMinutes),
      observations: this.observations,
      video_url: this.videoUrl,
      notes: this.notes,
      sync_status: this.syncStatus,
      version: this.version,
      last_modified_by: this.lastModifiedBy,
      server_updated_at: this.serverUpdatedAt,
      local_updated_at: this.localUpdatedAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * Instancia una entidad Game a partir de un registro de base de datos (snake_case o camelCase).
   * @param {Object} row - Fila obtenida de la base de datos o API.
   * @returns {Game} Nueva instancia de la entidad Game.
   */
  static fromJSON(row = {}) {
    return new Game({
      id: row.id,
      teamId: row.team_id ?? row.teamId,
      seasonId: row.season_id ?? row.seasonId,
      teamSeasonId: row.team_season_id ?? row.teamSeasonId,
      clubId: row.club_id ?? row.clubId,
      date: row.date,
      time: row.time,
      opponent: row.opponent,
      competition: row.competition,
      round: row.round,
      venue: row.venue,
      venueName: row.venue_name ?? row.venueName,
      periodsCount: row.periods_count ?? row.periodsCount,
      periodMinutes: row.period_minutes ?? row.periodMinutes,
      overtimeMinutes: row.overtime_minutes ?? row.overtimeMinutes,
      status: row.status,
      teamScore: row.team_score ?? row.teamScore,
      opponentScore: row.opponent_score ?? row.opponentScore,
      periods: row.periods,
      rosterIds: row.roster_ids ?? row.rosterIds,
      starterIds: row.starter_ids ?? row.starterIds,
      events: row.events,
      playerMinutes: row.player_minutes ?? row.playerMinutes,
      observations: row.observations,
      videoUrl: row.video_url ?? row.videoUrl,
      notes: row.notes,
      syncStatus: row.sync_status ?? row.syncStatus,
      version: row.version,
      lastModifiedBy: row.last_modified_by ?? row.lastModifiedBy,
      serverUpdatedAt: row.server_updated_at ?? row.serverUpdatedAt,
      localUpdatedAt: row.local_updated_at ?? row.localUpdatedAt,
      createdAt: row.created_at ?? row.createdAt,
      updatedAt: row.updated_at ?? row.updatedAt
    });
  }
}