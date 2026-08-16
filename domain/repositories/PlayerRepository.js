/**
 * @fileoverview Repositorio del Dominio: PlayerRepository (Plantilla de Jugadores).
 * @description Capa de persistencia y consulta para la entidad `Player`.
 * Optimizado bajo el principio Local-First con soporte para:
 * - Aislamiento estricto multiclub (clubId), multiequipo (teamId) y multitemporada (seasonId).
 * - Carga optimizada por lotes (batch) para plantillas completas.
 * - Flujo de auditoría y propuestas de cambio (ChangeRequests) para aprobación de Admin/SuperAdmin.
 * - Control de concurrencia optimista y prevención de conflictos servidor vs local.
 */

import { DATABASE_CONFIG } from "../../config/database.config.js";
import { Player, PlayerStatus } from "../entities/Player.js";

export class PlayerRepository {
  /**
   * Crea una instancia de PlayerRepository.
   * @param {Object} dbAdapter - Adaptador de persistencia (LocalStorageAdapter o SupabaseAdapter).
   */
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.collection = DATABASE_CONFIG.collections.PLAYERS;
    this.changeRequestsCollection = DATABASE_CONFIG.collections.CHANGE_REQUESTS || "change_requests";
  }

  // =========================================================================
  // 1. MÉTODOS DE CONSULTA Y FILTRADO (MULTI-ENTIDAD Y AISLAMIENTO)
  // =========================================================================

  /**
   * Obtiene todos los jugadores aplicando filtros de seguridad multitenant.
   * @param {Object} [filter={}] - Criterios de filtrado (teamId, seasonId, clubId, status).
   * @returns {Promise<Array<Player>>} Lista de instancias de Player.
   */
  async getAll(filter = {}) {
    const criteria = {};
    if (filter.teamId) criteria.team_id = filter.teamId;
    if (filter.seasonId) criteria.season_id = filter.seasonId;
    if (filter.clubId) criteria.club_id = filter.clubId;
    if (filter.status) criteria.status = filter.status;

    const rawItems = await this.db.query(this.collection, criteria);
    return (rawItems || []).map((item) => Player.fromJSON(item));
  }

  /**
   * Obtiene un jugador por su identificador único.
   * @param {string} id - UUID del jugador.
   * @returns {Promise<Player|null>} Instancia de Player o null.
   */
  async getById(id) {
    if (!id) return null;
    const item = await this.db.getById(this.collection, id);
    return item ? Player.fromJSON(item) : null;
  }

  /**
   * Obtiene la plantilla completa de jugadores asignados a un equipo en una temporada.
   * @param {string} teamId - UUID del equipo.
   * @param {string} [seasonId=null] - UUID de la temporada (opcional).
   * @param {boolean} [onlyActive=false] - Filtrar solo jugadores con estado ACTIVE.
   * @returns {Promise<Array<Player>>} Lista de jugadores ordenada por dorsal.
   */
  async getByTeamId(teamId, seasonId = null, onlyActive = false) {
    if (!teamId) return [];
    const criteria = { team_id: teamId };
    if (seasonId) criteria.season_id = seasonId;
    if (onlyActive) criteria.status = PlayerStatus.ACTIVE;

    const rawItems = await this.db.query(this.collection, criteria);
    const players = (rawItems || []).map((item) => Player.fromJSON(item));

    // Ordenación numérica natural por dorsal para HUDs, Box Scores y Convocatorias
    return players.sort((a, b) => a.jersey - b.jersey);
  }

  /**
   * Obtiene un conjunto de jugadores a partir de un array de identificadores (ej. convocados).
   * @param {Array<string>} playerIds - Lista de UUIDs de jugadores.
   * @returns {Promise<Array<Player>>}
   */
  async getByIds(playerIds = []) {
    if (!Array.isArray(playerIds) || playerIds.length === 0) return [];
    
    if (typeof this.db.getByIds === "function") {
      const rawItems = await this.db.getByIds(this.collection, playerIds);
      return (rawItems || []).map((item) => Player.fromJSON(item));
    }

    const promises = playerIds.map((id) => this.getById(id));
    const results = await Promise.all(promises);
    return results.filter((p) => p !== null);
  }

  // =========================================================================
  // 2. MÉTODOS DE PERSISTENCIA (LOCAL & CLOUD)
  // =========================================================================

  /**
   * Guarda un nuevo jugador en la base de datos.
   * @param {Player} playerInstance - Instancia de Player a persistir.
   * @returns {Promise<Player>} Instancia guardada con metadatos actualizados.
   */
  async save(playerInstance) {
    if (!(playerInstance instanceof Player)) {
      throw new Error("PlayerRepository.save: Se requiere una instancia válida de Player");
    }
    const data = playerInstance.toJSON();
    const savedData = await this.db.save(this.collection, data);
    return Player.fromJSON(savedData);
  }

  /**
   * Guarda o sincroniza una lista completa de jugadores en lote.
   * @param {Array<Player>} playerInstances - Lista de instancias a persistir.
   * @returns {Promise<Array<Player>>}
   */
  async saveBatch(playerInstances = []) {
    if (!Array.isArray(playerInstances) || playerInstances.length === 0) return [];
    
    const serializedData = playerInstances.map((p) => p.toJSON());
    if (typeof this.db.saveBatch === "function") {
      const saved = await this.db.saveBatch(this.collection, serializedData);
      return saved.map((item) => Player.fromJSON(item));
    }

    const promises = serializedData.map((data) => this.db.save(this.collection, data));
    const results = await Promise.all(promises);
    return results.map((item) => Player.fromJSON(item));
  }

  /**
   * Actualiza los datos de un jugador existente.
   * @param {string} id - UUID del jugador.
   * @param {Player} playerInstance - Instancia con datos modificados.
   * @returns {Promise<Player>}
   */
  async update(id, playerInstance) {
    if (!id || !(playerInstance instanceof Player)) {
      throw new Error("PlayerRepository.update: Parámetros inválidos");
    }
    playerInstance.touchLocal();
    const data = playerInstance.toJSON();
    const updatedData = await this.db.update(this.collection, id, data);
    return Player.fromJSON(updatedData);
  }

  /**
   * Elimina un jugador del sistema.
   * @param {string} id - UUID del jugador.
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    if (!id) return false;
    return await this.db.delete(this.collection, id);
  }

  // =========================================================================
  // 3. CONTROL DE AUDITORÍA, PROPUESTAS Y CONCURRENCIA
  // =========================================================================

  /**
   * Envía una propuesta de cambio de datos de jugador al Admin/SuperAdmin.
   * @param {Object} params
   * @param {string} params.playerId - UUID del jugador.
   * @param {Player} params.proposedPlayer - Datos modificados en local.
   * @param {string} params.requestedBy - ID del usuario solicitante.
   * @param {string} params.userRole - Rol del usuario ('scout', 'assistant').
   * @returns {Promise<Object>} Registro de la solicitud creada.
   */
  async submitChangeRequest({ playerId, proposedPlayer, requestedBy, userRole }) {
    const currentServerPlayer = await this.getById(playerId);

    const changeRequestData = {
      id: `cr_player_${playerId}_${Date.now()}`,
      table_name: this.collection,
      record_id: playerId,
      club_id: proposedPlayer.clubId,
      team_id: proposedPlayer.teamId,
      previous_state: currentServerPlayer ? JSON.stringify(currentServerPlayer.toJSON()) : null,
      proposed_state: JSON.stringify(proposedPlayer.toJSON()),
      requested_by: requestedBy,
      user_role: userRole,
      status: "PENDING",
      request_timestamp: new Date().toISOString(),
      server_last_modified: currentServerPlayer ? currentServerPlayer.serverUpdatedAt : null
    };

    proposedPlayer.syncStatus = "PENDING_APPROVAL";
    await this.save(proposedPlayer);

    return await this.db.save(this.changeRequestsCollection, changeRequestData);
  }

  /**
   * Compara la versión local con la del servidor para detectar cambios más recientes.
   * @param {string} playerId - UUID del jugador.
   * @param {string} localUpdatedAt - Timestamp ISO local.
   * @returns {Promise<{ hasConflict: boolean, serverPlayer: Player|null }>}
   */
  async checkServerVersionConflict(playerId, localUpdatedAt) {
    const serverPlayer = await this.getById(playerId);
    if (!serverPlayer || !serverPlayer.serverUpdatedAt || !localUpdatedAt) {
      return { hasConflict: false, serverPlayer };
    }

    const localTime = new Date(localUpdatedAt).getTime();
    const serverTime = new Date(serverPlayer.serverUpdatedAt).getTime();

    return {
      hasConflict: serverTime > localTime,
      serverPlayer
    };
  }
}