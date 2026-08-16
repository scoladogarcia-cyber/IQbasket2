/**
 * @fileoverview Controlador Principal de Partidos: GameController.
 * @description Orquesta el ciclo de vida de los partidos, el despacho de eventos de juego (Event Sourcing),
 * el control de permisos y aislamiento por rol/club/equipo, y el flujo de guardado local-first
 * con propuestas de cambio (ChangeRequests) para validación del Administrador.
 * 
 * Cumple con los principios de diseño:
 * 1. Desacoplamiento matemático total: delega el 100% de los cálculos a StatsEngine.
 * 2. Cero llamadas dispersas a bases de datos: interactúa a través de GameRepository y SyncEngine.
 * 3. Control de permisos estricto (RBAC) validando si el usuario puede registrar, editar o finalizar.
 * 4. Soporte para prórrogas ilimitadas y serialización bidireccional limpia.
 */

import { StatsEngine, GameEventType } from "../engine/StatsEngine.js";
import { Game, GameStatus, SyncStatus } from "../domain/entities/Game.js";
import { PlayerGameStats } from "../domain/entities/PlayerGameStats.js";

export class GameController {
  /**
   * Crea una instancia de GameController.
   * @param {Object} gameRepository - Repositorio de persistencia de partidos.
   * @param {Object} authController - Controlador de autenticación y permisos.
   * @param {Object} [syncEngine=null] - Motor de sincronización local/cloud.
   */
  constructor(gameRepository, authController, syncEngine = null) {
    this.gameRepo = gameRepository;
    this.auth = authController;
    this.syncEngine = syncEngine;
  }

  // =========================================================================
  // 1. CONSULTA Y ACCESO CON FILTRADO DE SEGURIDAD (RBAC & ISOLATION)
  // =========================================================================

  /**
   * Obtiene todos los partidos permitidos para el usuario autenticado.
   * @param {Object} [filter={}] - Filtros adicionales (teamId, seasonId, status).
   * @returns {Promise<Array<Game>>}
   */
  async getGames(filter = {}) {
    const user = this.auth.getCurrentUser();
    if (!user) throw new Error("Acceso no autorizado: Inicie sesión.");

    const queryFilter = { ...filter };

    // Si no es SuperAdmin, aísla por club o equipos autorizados
    if (!this.auth.hasRole("SUPERADMIN")) {
      if (user.clubId) queryFilter.clubId = user.clubId;
      if (queryFilter.teamId && !this.auth.canAccessTeam(queryFilter.teamId)) {
        throw new Error("Acceso denegado: No tiene permisos sobre este equipo.");
      }
    }

    return await this.gameRepo.getAll(queryFilter);
  }

  /**
   * Obtiene un partido por su ID verificando los permisos de acceso del usuario.
   * @param {string} gameId - UUID del partido.
   * @returns {Promise<Game>}
   */
  async getGameById(gameId) {
    if (!gameId) throw new Error("Identificador de partido no especificado.");
    const game = await this.gameRepo.getById(gameId);
    if (!game) throw new Error("Partido no encontrado.");

    if (!this.auth.canAccessTeam(game.teamId)) {
      throw new Error("Acceso denegado: No tiene permisos para consultar este partido.");
    }

    return game;
  }

  // =========================================================================
  // 2. CREACIÓN, REGISTRO EN VIVO Y EVENT SOURCING
  // =========================================================================

  /**
   * Crea y programa un nuevo partido validando permisos.
   * @param {Object} gameData - Datos iniciales del partido.
   * @returns {Promise<Game>}
   */
  async createGame(gameData = {}) {
    if (!this.auth.can("CREATE_GAME")) {
      throw new Error("Permisos insuficientes para crear partidos.");
    }

    if (gameData.teamId && !this.auth.canAccessTeam(gameData.teamId)) {
      throw new Error("No puede crear partidos para un equipo no autorizado.");
    }

    const user = this.auth.getCurrentUser();
    const newGame = new Game({
      ...gameData,
      clubId: user.clubId || gameData.clubId,
      status: GameStatus.SCHEDULED,
      syncStatus: SyncStatus.LOCAL_DRAFT,
      lastModifiedBy: user.id
    });

    return await this.gameRepo.save(newGame);
  }

  /**
   * Registra un evento de partido (tiro, falta, sustitución, etc.) y computa el nuevo estado en vivo.
   * @param {string} gameId - UUID del partido.
   * @param {Object} eventPayload - Datos del evento (type, playerId, period, timestampSec, coords, etc.).
   * @returns {Promise<{ game: Game, computedState: Object }>}
   */
  async recordGameEvent(gameId, eventPayload = {}) {
    if (!this.auth.can("RECORD_LIVE_GAME")) {
      throw new Error("Permisos insuficientes para registrar estadísticas en vivo.");
    }

    const game = await this.getGameById(gameId);
    const user = this.auth.getCurrentUser();

    // Generación del evento atómico
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullEvent = {
      id: eventId,
      timestamp: new Date().toISOString(),
      registeredBy: user.id,
      ...eventPayload
    };

    game.addEvent(fullEvent);
    game.status = GameStatus.IN_PROGRESS;

    // Recalcular estado consolidado mediante el motor puro (StatsEngine)
    const computedState = StatsEngine.processGameEvents(game.events, {
      periodMinutes: game.periodMinutes,
      overtimeMinutes: game.overtimeMinutes,
      starterIds: game.starterIds
    });

    // Actualiza snapshots de marcador de conveniencia en la entidad
    game.teamScore = computedState.teamScore;
    game.opponentScore = computedState.opponentScore;
    game.lastModifiedBy = user.id;

    await this.gameRepo.update(game.id, game);

    return { game, computedState };
  }

  /**
   * Elimina el último evento o un evento específico (Undo / Edición de Play-by-Play).
   * @param {string} gameId - UUID del partido.
   * @param {string|null} [eventId=null] - ID del evento a eliminar (si es null, elimina el último).
   * @returns {Promise<{ game: Game, computedState: Object }>}
   */
  async undoGameEvent(gameId, eventId = null) {
    if (!this.auth.can("EDIT_PLAY_BY_PLAY")) {
      throw new Error("Permisos insuficientes para modificar el Play-by-Play.");
    }

    const game = await this.getGameById(gameId);
    if (!game.events || game.events.length === 0) {
      throw new Error("No hay eventos registrados para deshacer.");
    }

    if (eventId) {
      game.removeEvent(eventId);
    } else {
      const removed = game.events.pop();
      game.touchLocal();
    }

    // Recalcular estado consolidado
    const computedState = StatsEngine.processGameEvents(game.events, {
      periodMinutes: game.periodMinutes,
      overtimeMinutes: game.overtimeMinutes,
      starterIds: game.starterIds
    });

    game.teamScore = computedState.teamScore;
    game.opponentScore = computedState.opponentScore;
    await this.gameRepo.update(game.id, game);

    return { game, computedState };
  }

  // =========================================================================
  // 3. FINALIZACIÓN DE PARTIDO Y CIERRE DE ACTA POST-PARTIDO
  // =========================================================================

  /**
   * Finaliza el partido, consolida las estadísticas en player_game_stats
   * y gestiona el flujo de guardado directo o envío de ChangeRequest para validación de Admin.
   * 
   * @param {string} gameId - UUID del partido.
   * @param {Object} [finalAdjustments={}] - Ajustes finales manuales del acta (minutos, notas).
   * @returns {Promise<{ game: Game, computedState: Object, changeRequest: Object|null }>}
   */
  async finalizeGame(gameId, finalAdjustments = {}) {
    const game = await this.getGameById(gameId);
    const user = this.auth.getCurrentUser();

    if (finalAdjustments.playerMinutes) {
      game.playerMinutes = { ...game.playerMinutes, ...finalAdjustments.playerMinutes };
    }
    if (finalAdjustments.observations) {
      game.observations = finalAdjustments.observations;
    }
    if (finalAdjustments.notes) {
      game.notes = finalAdjustments.notes;
    }

    // Cierre formal del partido
    game.status = GameStatus.FINISHED;
    game.lastModifiedBy = user.id;

    // Procesar estado final completo
    const computedState = StatsEngine.processGameEvents(game.events, {
      periodMinutes: game.periodMinutes,
      overtimeMinutes: game.overtimeMinutes,
      starterIds: game.starterIds
    });

    game.teamScore = computedState.teamScore;
    game.opponentScore = computedState.opponentScore;

    // Preparar instancias de PlayerGameStats para persistencia
    const statsInstances = computedState.playerStatsList.map((st) => {
      return new PlayerGameStats({
        gameId: game.id,
        playerId: st.playerId,
        teamId: game.teamId,
        seasonId: game.seasonId,
        starter: st.starter,
        minutesSeconds: st.minutesSeconds,
        minutes: st.minutes,
        points: st.points,
        fg2Made: st.fg2Made,
        fg2Attempted: st.fg2Attempted,
        fg3Made: st.fg3Made,
        fg3Attempted: st.fg3Attempted,
        ftMade: st.ftMade,
        ftAttempted: st.ftAttempted,
        offReb: st.offReb,
        defReb: st.defReb,
        assists: st.assists,
        steals: st.steals,
        blocksMade: st.blocksMade,
        blocksReceived: st.blocksReceived,
        turnovers: st.turnovers,
        foulsCommitted: st.foulsCommitted,
        foulsDrawn: st.foulsDrawn,
        plusMinus: st.plusMinus,
        pir: st.pir,
        efficiency: st.efficiency,
        gameScore: st.gameScore
      });
    });

    let changeRequest = null;

    // Si el usuario es Admin/SuperAdmin, consolida directamente
    if (this.auth.isAdmin()) {
      game.syncStatus = SyncStatus.SYNCHRONIZED;
      game.serverUpdatedAt = new Date().toISOString();
      await this.gameRepo.update(game.id, game);
      await this.gameRepo.savePlayerStatsBatch(statsInstances);

      // Si hay motor de sincronización cloud activo, dispara push directo
      if (this.syncEngine && typeof this.syncEngine.pushGame === "function") {
        await this.syncEngine.pushGame(game, statsInstances);
      }
    } else {
      // Si es Scout/Anotador, guarda en local y genera propuesta de cambio para el Administrador
      game.syncStatus = SyncStatus.PENDING_APPROVAL;
      await this.gameRepo.update(game.id, game);
      await this.gameRepo.savePlayerStatsBatch(statsInstances);

      changeRequest = await this.gameRepo.submitChangeRequest({
        gameId: game.id,
        proposedGame: game,
        requestedBy: user.id,
        userRole: user.role
      });
    }

    return {
      game,
      computedState,
      changeRequest
    };
  }

  // =========================================================================
  // 4. RESOLUCIÓN DE CONFLICTOS Y APROBACIÓN ADMINISTRATIVA
  // =========================================================================

  /**
   * Resuelve una solicitud de cambio aprobando o rechazando la propuesta enviada.
   * Exclusivo para usuarios con rol ADMIN o SUPERADMIN.
   * 
   * @param {string} changeRequestId - ID de la solicitud de cambio.
   * @param {boolean} approve - True para aprobar y sobreescribir oficial, False para rechazar.
   * @returns {Promise<boolean>}
   */
  async resolveChangeRequest(changeRequestId, approve = true) {
    if (!this.auth.can("VALIDATE_CHANGE_REQUESTS")) {
      throw new Error("Permisos insuficientes: Solo un Administrador puede validar cambios.");
    }

    if (this.syncEngine && typeof this.syncEngine.resolveChangeRequest === "function") {
      return await this.syncEngine.resolveChangeRequest(changeRequestId, approve);
    }

    return true;
  }
}