/**
 * @fileoverview Controlador de Jugadores e Indicadores Individuales: PlayerController.
 * @description Orquesta el ciclo de vida de los jugadores (altas, modificaciones, bajas),
 * la consulta de plantillas y el acceso a los históricos estadísticos individuales.
 * 
 * Reglas de diseño y seguridad:
 * 1. Control estricto de privacidad: perfiles VIEWER/JUGADOR solo acceden a sus propios datos biométricos y estadísticos.
 * 2. Desacoplamiento matemático total: cualquier agregación se delega en StatsAggregator/StatsEngine.
 * 3. Gestión local-first con ChangeRequests: las modificaciones de scouts/asistentes pasan por aprobación de Admin.
 * 4. Aislamiento multi-tenant por club, equipo y temporada.
 */

import { Player, PlayerStatus } from "../domain/entities/Player.js";
import { StatsAggregator } from "../domain/stats/StatsAggregator.js";
import { UserRole } from "./AuthController.js";

export class PlayerController {
  /**
   * Crea una instancia de PlayerController.
   * @param {Object} playerRepository - Repositorio de jugadores.
   * @param {Object} gameRepository - Repositorio de partidos y player_game_stats.
   * @param {Object} authController - Controlador de autenticación y permisos.
   * @param {Object} [syncEngine=null] - Motor de sincronización local/cloud.
   */
  constructor(playerRepository, gameRepository, authController, syncEngine = null) {
    this.playerRepo = playerRepository;
    this.gameRepo = gameRepository;
    this.auth = authController;
    this.syncEngine = syncEngine;
  }

  // =========================================================================
  // 1. CONSULTA Y ACCESO CON PRIVACIDAD ESTRICTA (RBAC)
  // =========================================================================

  /**
   * Obtiene la plantilla de jugadores de un equipo con filtrado de visibilidad.
   * @param {string} teamId - UUID del equipo.
   * @param {string|null} [seasonId=null] - UUID de la temporada.
   * @param {boolean} [onlyActive=false] - Filtrar solo jugadores activos.
   * @returns {Promise<Array<Player>>} Lista de jugadores autorizados ordenada por dorsal.
   */
  async getPlayersByTeam(teamId, seasonId = null, onlyActive = false) {
    if (!this.auth.canAccessTeam(teamId)) {
      throw new Error("Acceso denegado: No tiene permisos sobre este equipo.");
    }

    const players = await this.playerRepo.getByTeamId(teamId, seasonId, onlyActive);

    // Regla de privacidad: Si el usuario es un jugador o familiar (VIEWER), solo ve su propia ficha
    const currentUser = this.auth.getCurrentUser();
    if (currentUser?.role === UserRole.VIEWER && currentUser.playerId) {
      return players.filter((p) => String(p.id) === String(currentUser.playerId));
    }

    return players;
  }

  /**
   * Obtiene la ficha de un jugador verificando permisos de acceso individual.
   * @param {string} playerId - UUID del jugador.
   * @returns {Promise<Player>}
   */
  async getPlayerById(playerId) {
    const player = await this.playerRepo.getById(playerId);
    if (!player) throw new Error("Jugador no encontrado.");

    if (!this.auth.canAccessPlayer(player.id, player.teamId)) {
      throw new Error("Acceso denegado: No tiene autorización para consultar este jugador.");
    }

    return player;
  }

  // =========================================================================
  // 2. HISTÓRICO Y AGREGACIONES ESTADÍSTICAS DEL JUGADOR
  // =========================================================================

  /**
   * Obtiene el histórico completo de partidos de un jugador con agregación de temporada.
   * Cruza datos con StatsAggregator sin ejecutar operaciones matemáticas locales.
   * @param {string} playerId - UUID del jugador.
   * @param {string|null} [seasonId=null] - UUID de la temporada a filtrar.
   * @returns {Promise<{ player: Player, gameStats: Array<Object>, seasonTotals: Object|null }>}
   */
  async getPlayerProfileAndStats(playerId, seasonId = null) {
    const player = await this.getPlayerById(playerId);

    // Obtiene los registros brutos de partidos jugados
    let gameStats = await this.gameRepo.getPlayerStatsByPlayer(playerId);
    if (seasonId) {
      gameStats = gameStats.filter((st) => String(st.seasonId) === String(seasonId));
    }

    // Calcula totales acumulados, medias por partido y avanzadas mediante el agregador puro
    const seasonTotals = StatsAggregator.aggregatePlayerSeasonStats(gameStats);

    return {
      player,
      gameStats,
      seasonTotals
    };
  }

  // =========================================================================
  // 3. GESTIÓN DE PLANTILLA (ALTAS, MODIFICACIONES Y BAJAS)
  // =========================================================================

  /**
   * Da de alta a un nuevo jugador en la plantilla.
   * @param {Object} playerData - Datos del nuevo jugador.
   * @returns {Promise<{ player: Player, changeRequest: Object|null }>}
   */
  async createPlayer(playerData = {}) {
    if (!this.auth.can("MANAGE_ROSTER")) {
      throw new Error("Permisos insuficientes: No puede gestionar la plantilla.");
    }

    if (playerData.teamId && !this.auth.canAccessTeam(playerData.teamId)) {
      throw new Error("Acceso denegado: No puede dar de alta en este equipo.");
    }

    const currentUser = this.auth.getCurrentUser();
    const newPlayer = new Player({
      ...playerData,
      clubId: currentUser.clubId || playerData.clubId,
      status: playerData.status || PlayerStatus.ACTIVE,
      lastModifiedBy: currentUser.id,
      syncStatus: this.auth.isAdmin() ? "SYNCHRONIZED" : "PENDING_APPROVAL"
    });

    let savedPlayer = null;
    let changeRequest = null;

    if (this.auth.isAdmin()) {
      savedPlayer = await this.playerRepo.save(newPlayer);
      if (this.syncEngine && typeof this.syncEngine.pushRecord === "function") {
        await this.syncEngine.pushRecord("players", savedPlayer.toJSON());
      }
    } else {
      // Guardado local y propuesta de cambio al Admin
      savedPlayer = await this.playerRepo.save(newPlayer);
      changeRequest = await this.playerRepo.submitChangeRequest({
        playerId: savedPlayer.id,
        proposedPlayer: savedPlayer,
        requestedBy: currentUser.id,
        userRole: currentUser.role
      });
    }

    return { player: savedPlayer, changeRequest };
  }

  /**
   * Actualiza los datos de un jugador existente.
   * @param {string} playerId - UUID del jugador.
   * @param {Object} updateData - Campos modificados.
   * @returns {Promise<{ player: Player, changeRequest: Object|null }>}
   */
  async updatePlayer(playerId, updateData = {}) {
    const existingPlayer = await this.getPlayerById(playerId);
    if (!this.auth.can("MANAGE_ROSTER")) {
      throw new Error("Permisos insuficientes para editar jugadores.");
    }

    const currentUser = this.auth.getCurrentUser();
    const updatedPlayer = new Player({
      ...existingPlayer,
      ...updateData,
      id: playerId,
      lastModifiedBy: currentUser.id
    });

    let savedPlayer = null;
    let changeRequest = null;

    if (this.auth.isAdmin()) {
      savedPlayer = await this.playerRepo.update(playerId, updatedPlayer);
      if (this.syncEngine && typeof this.syncEngine.pushRecord === "function") {
        await this.syncEngine.pushRecord("players", savedPlayer.toJSON());
      }
    } else {
      savedPlayer = await this.playerRepo.update(playerId, updatedPlayer);
      changeRequest = await this.playerRepo.submitChangeRequest({
        playerId,
        proposedPlayer: updatedPlayer,
        requestedBy: currentUser.id,
        userRole: currentUser.role
      });
    }

    return { player: savedPlayer, changeRequest };
  }

  /**
   * Da de baja o elimina a un jugador.
   * @param {string} playerId - UUID del jugador.
   * @returns {Promise<boolean>}
   */
  async deletePlayer(playerId) {
    await this.getPlayerById(playerId); // Valida permisos de visibilidad previa
    if (!this.auth.can("MANAGE_ROSTER")) {
      throw new Error("Permisos insuficientes para eliminar jugadores.");
    }

    return await this.playerRepo.delete(playerId);
  }
}