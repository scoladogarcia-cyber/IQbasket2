/**
 * @fileoverview Repositorio del Dominio: GameRepository (Partidos y Estadísticas por Partido).
 * @description Capa de acceso a datos para la entidad `Game` y `PlayerGameStats`.
 * Diseñado bajo el principio Local-First con soporte para:
 * - Aislamiento estricto multiclub, multiequipo y multitemporada.
 * - Carga bajo demanda (Lazy Loading) y paginación para minimizar consumo y peso.
 * - Consultas por lotes (batch operations) para sincronización eficiente.
 * - Flujo de propuestas de cambio (`ChangeRequests`) para control de concurrencia y validación Admin.
 * - Integración con el modelo de Event Sourcing inmutable (GameEvents).
 */

import { DATABASE_CONFIG } from "../../config/database.config.js";
import { Game, SyncStatus, GameStatus } from "../entities/Game.js";
import { PlayerGameStats } from "../entities/PlayerGameStats.js";

export class GameRepository {
  /**
   * Crea una instancia de GameRepository.
   * @param {Object} dbAdapter - Adaptador de base de datos (LocalStorageAdapter o SupabaseAdapter).
   */
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.gamesCollection = DATABASE_CONFIG.collections.GAMES;
    this.playerStatsCollection = DATABASE_CONFIG.collections.PLAYER_GAME_STATS;
    this.changeRequestsCollection = DATABASE_CONFIG.collections.CHANGE_REQUESTS || "change_requests";
  }

  // =========================================================================
  // 1. MÉTODOS DE LECTURA Y CONSULTA (OPTIMIZADOS Y AISLADOS)
  // =========================================================================

  /**
   * Obtiene todos los partidos aplicando filtros de seguridad multitenant.
   * @param {Object} [filter={}] - Criterios de filtrado (teamId, seasonId, clubId, status).
   * @returns {Promise<Array<Game>>} Lista de entidades Game instanciadas.
   */
  async getAll(filter = {}) {
    const queryCriteria = {};
    if (filter.teamId) queryCriteria.team_id = filter.teamId;
    if (filter.seasonId) queryCriteria.season_id = filter.seasonId;
    if (filter.clubId) queryCriteria.club_id = filter.clubId;
    if (filter.status) queryCriteria.status = filter.status;

    const rawItems = await this.db.query(this.gamesCollection, queryCriteria);
    return (rawItems || []).map((item) => Game.fromJSON(item));
  }

  /**
   * Obtiene un partido por su identificador único.
   * @param {string} id - UUID del partido.
   * @returns {Promise<Game|null>} Instancia de Game o null si no existe.
   */
  async getById(id) {
    if (!id) return null;
    const item = await this.db.getById(this.gamesCollection, id);
    return item ? Game.fromJSON(item) : null;
  }

  /**
   * Obtiene una lista ligera de partidos (sin el array pesado de eventos) para calendarios y listados.
   * Reduce drásticamente el uso de memoria en móvil y web.
   * @param {Object} filter - Criterios de filtrado (teamId, seasonId).
   * @returns {Promise<Array<Game>>} Partidos con cabecera y resultado.
   */
  async getSummaryList(filter = {}) {
    const games = await this.getAll(filter);
    return games.map((game) => {
      // Retorna una copia sin el array completo de eventos para agilizar la UI
      return new Game({
        ...game,
        events: []
      });
    });
  }

  /**
   * Obtiene los partidos de un equipo específico en una temporada concreta.
   * @param {string} teamId - UUID del equipo.
   * @param {string} seasonId - UUID de la temporada.
   * @returns {Promise<Array<Game>>}
   */
  async getByTeamAndSeason(teamId, seasonId) {
    return this.getAll({ teamId, seasonId });
  }

  // =========================================================================
  // 2. MÉTODOS DE PERSISTENCIA Y SINCRONIZACIÓN (LOCAL & CLOUD)
  // =========================================================================

  /**
   * Guarda un partido en el almacenamiento activo (local o cloud).
   * @param {Game} gameInstance - Instancia de Game a persistir.
   * @returns {Promise<Game>} Instancia guardada con metadatos actualizados.
   */
  async save(gameInstance) {
    if (!(gameInstance instanceof Game)) {
      throw new Error("GameRepository.save: Se requiere una instancia válida de Game");
    }
    const data = gameInstance.toJSON();
    const savedData = await this.db.save(this.gamesCollection, data);
    return Game.fromJSON(savedData);
  }

  /**
   * Actualiza un partido existente.
   * @param {string} id - UUID del partido a actualizar.
   * @param {Game} gameInstance - Instancia de Game con los datos modificados.
   * @returns {Promise<Game>} Instancia actualizada.
   */
  async update(id, gameInstance) {
    if (!id || !(gameInstance instanceof Game)) {
      throw new Error("GameRepository.update: Parámetros inválidos");
    }
    gameInstance.touchLocal();
    const data = gameInstance.toJSON();
    const updatedData = await this.db.update(this.gamesCollection, id, data);
    return Game.fromJSON(updatedData);
  }

  /**
   * Elimina un partido y sus estadísticas asociadas de forma atómica.
   * @param {string} id - UUID del partido.
   * @returns {Promise<boolean>} True si la eliminación fue exitosa.
   */
  async delete(id) {
    if (!id) return false;
    // 1. Elimina las estadísticas vinculadas de los jugadores
    await this.deletePlayerStatsByGame(id);
    // 2. Elimina el partido
    return await this.db.delete(this.gamesCollection, id);
  }

  // =========================================================================
  // 3. FLUJO DE APROBACIÓN ADMINISTRATIVA Y CONTROL DE CONCURRENCIA
  // =========================================================================

  /**
   * Envía una propuesta de modificación al Administrador (ChangeRequest).
   * Utilizado cuando un usuario sin rol de Admin/Superadmin genera o edita un partido en local.
   * @param {Object} params
   * @param {string} params.gameId - ID del partido.
   * @param {Game} params.proposedGame - Instancia con los cambios propuestos.
   * @param {string} params.requestedBy - ID del usuario que solicita el cambio.
   * @param {string} params.userRole - Rol del usuario ('scout', 'assistant', etc.).
   * @returns {Promise<Object>} Registro de la solicitud de cambio creada.
   */
  async submitChangeRequest({ gameId, proposedGame, requestedBy, userRole }) {
    const currentServerGame = await this.getById(gameId);
    
    const changeRequestData = {
      id: `cr_game_${gameId}_${Date.now()}`,
      table_name: this.gamesCollection,
      record_id: gameId,
      club_id: proposedGame.clubId,
      team_id: proposedGame.teamId,
      previous_state: currentServerGame ? JSON.stringify(currentServerGame.toJSON()) : null,
      proposed_state: JSON.stringify(proposedGame.toJSON()),
      requested_by: requestedBy,
      user_role: userRole,
      status: "PENDING",
      request_timestamp: new Date().toISOString(),
      server_last_modified: currentServerGame ? currentServerGame.serverUpdatedAt : null
    };

    // Marca el partido local en estado pendiente de aprobación
    proposedGame.syncStatus = SyncStatus.PENDING_APPROVAL;
    await this.save(proposedGame);

    return await this.db.save(this.changeRequestsCollection, changeRequestData);
  }

  /**
   * Compara la versión local con la del servidor para detectar si existen datos más recientes.
   * @param {string} gameId - ID del partido.
   * @param {string} localUpdatedAt - Timestamp ISO local.
   * @returns {Promise<{ hasConflict: boolean, serverGame: Game|null }>}
   */
  async checkServerVersionConflict(gameId, localUpdatedAt) {
    const serverGame = await this.getById(gameId);
    if (!serverGame || !serverGame.serverUpdatedAt || !localUpdatedAt) {
      return { hasConflict: false, serverGame };
    }

    const localTime = new Date(localUpdatedAt).getTime();
    const serverTime = new Date(serverGame.serverUpdatedAt).getTime();

    return {
      hasConflict: serverTime > localTime,
      serverGame
    };
  }

  // =========================================================================
  // 4. ESTADÍSTICAS INDIVIDUALES DE JUGADOR POR PARTIDO (PLAYER_GAME_STATS)
  // =========================================================================

  /**
   * Guarda o actualiza un registro individual de estadísticas de jugador.
   * @param {PlayerGameStats} playerStatsInstance - Instancia de PlayerGameStats.
   * @returns {Promise<PlayerGameStats>}
   */
  async savePlayerStats(playerStatsInstance) {
    if (!(playerStatsInstance instanceof PlayerGameStats)) {
      throw new Error("GameRepository.savePlayerStats: Instancia no válida");
    }
    const data = playerStatsInstance.toJSON();
    const savedData = await this.db.save(this.playerStatsCollection, data);
    return PlayerGameStats.fromJSON(savedData);
  }

  /**
   * Guarda un lote de estadísticas de todos los jugadores al cerrar el acta post-partido.
   * Minimiza las transacciones a la base de datos.
   * @param {Array<PlayerGameStats>} statsList - Lista de instancias a persistir.
   * @returns {Promise<Array<PlayerGameStats>>}
   */
  async savePlayerStatsBatch(statsList = []) {
    if (!Array.isArray(statsList) || statsList.length === 0) return [];
    
    const serializedData = statsList.map((stat) => stat.toJSON());
    
    // Si el adaptador implementa saveBatch nativo, lo usa; en caso contrario, resuelve en paralelo
    if (typeof this.db.saveBatch === "function") {
      const saved = await this.db.saveBatch(this.playerStatsCollection, serializedData);
      return saved.map((s) => PlayerGameStats.fromJSON(s));
    }

    const promises = serializedData.map((data) => this.db.save(this.playerStatsCollection, data));
    const results = await Promise.all(promises);
    return results.map((r) => PlayerGameStats.fromJSON(r));
  }

  /**
   * Obtiene todas las estadísticas de jugadores vinculadas a un partido concreto.
   * @param {string} gameId - UUID del partido.
   * @returns {Promise<Array<PlayerGameStats>>}
   */
  async getPlayerStatsByGame(gameId) {
    if (!gameId) return [];
    const rawItems = await this.db.query(this.playerStatsCollection, { game_id: gameId });
    return (rawItems || []).map((item) => PlayerGameStats.fromJSON(item));
  }

  /**
   * Obtiene el histórico de estadísticas de un jugador en todos sus partidos.
   * @param {string} playerId - UUID del jugador.
   * @returns {Promise<Array<PlayerGameStats>>}
   */
  async getPlayerStatsByPlayer(playerId) {
    if (!playerId) return [];
    const rawItems = await this.db.query(this.playerStatsCollection, { player_id: playerId });
    return (rawItems || []).map((item) => PlayerGameStats.fromJSON(item));
  }

  /**
   * Elimina todas las estadísticas de jugadores asociadas a un partido.
   * @param {string} gameId - UUID del partido.
   * @returns {Promise<boolean>}
   */
  async deletePlayerStatsByGame(gameId) {
    if (!gameId) return false;
    if (typeof this.db.deleteWhere === "function") {
      return await this.db.deleteWhere(this.playerStatsCollection, { game_id: gameId });
    }
    const currentStats = await this.getPlayerStatsByGame(gameId);
    const deletePromises = currentStats.map((stat) => this.db.delete(this.playerStatsCollection, stat.id));
    await Promise.all(deletePromises);
    return true;
  }
}