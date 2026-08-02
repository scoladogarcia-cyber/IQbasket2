/**
 * @fileoverview Controlador de Jugadores e Indicadores Individuales.
 * @description Gestiona las altas, modificaciones y consultas de plantillas.
 * Aplica la regla estricta de privacidad: el rol JUGADOR solo puede ver sus propias estadísticas.
 */

import { Player } from "../domain/entities/Player.js";

export class PlayerController {
  /**
   * @param {Object} playerRepository - Instancia de PlayerRepository.
   * @param {Object} gameRepository - Instancia de GameRepository para leer estadísticas.
   * @param {Object} authController - Instancia de AuthController para validar permisos.
   * @param {Object} syncEngine - Instancia de SyncEngine para persistencia híbrida.
   */
  constructor(playerRepository, gameRepository, authController, syncEngine) {
    this.playerRepo = playerRepository;
    this.gameRepo = gameRepository;
    this.auth = authController;
    this.syncEngine = syncEngine;
  }

  /**
   * Da de alta a un nuevo jugador en la base de datos (Offline-First).
   * Requiere permiso 'CREATE_PLAYER'.
   * 
   * @param {Object} playerData - Datos del jugador (nombre, dorsal, posición, mano dominante, etc.).
   * @returns {Promise<Player>} Instancia del jugador guardado.
   */
  async createPlayer(playerData) {
    if (!this.auth.can("CREATE_PLAYER")) {
      throw new Error("PERMISO_DENEGADO: No tienes autorización para crear jugadores.");
    }

    const player = new Player(playerData);
    // Guarda en local (0ms) y encola sincronización a Supabase
    const savedPlayer = await this.syncEngine.enqueueOperation("players", "CREATE", player.toJSON());
    return new Player(savedPlayer);
  }

  /**
   * Obtiene la lista de jugadores de un equipo con filtrado de seguridad por rol.
   * Si el usuario conectado es 'JUGADOR', solo podrá ver su propia ficha estadística.
   * 
   * @param {string|number} teamId - Identificador del equipo.
   * @returns {Promise<Array<Player>>} Lista de jugadores autorizados.
   */
  async getPlayersByTeam(teamId) {
    const players = await this.playerRepo.getByTeamId(teamId);

    // Regla de Privacidad: Si es JUGADOR, filtra para mostrar solo su perfil
    if (this.auth.hasRole("JUGADOR")) {
      const currentUserId = this.auth.getCurrentUser()?.id;
      return players.filter((p) => String(p.id) === String(currentUserId));
    }

    return players;
  }

  /**
   * Obtiene las estadísticas acumuladas de un jugador.
   * Si es rol 'JUGADOR', valida que la consulta corresponda a su propio ID.
   * 
   * @param {string|number} playerId - ID del jugador a consultar.
   * @returns {Promise<Array<Object>>} Lista de estadísticas registradas por partido.
   */
  async getPlayerGameStats(playerId) {
    if (this.auth.hasRole("JUGADOR")) {
      const currentUserId = this.auth.getCurrentUser()?.id;
      if (String(playerId) !== String(currentUserId)) {
        throw new Error("PERMISO_DENEGADO: Solo puedes consultar tus propias estadísticas.");
      }
    } else if (!this.auth.can("VIEW_ALL_PLAYER_STATS")) {
      throw new Error("PERMISO_DENEGADO: No tienes autorización para consultar estadísticas.");
    }

    return await this.gameRepo.getPlayerStatsByPlayer(playerId);
  }
}