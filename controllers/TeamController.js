/**
 * @fileoverview Controlador de Equipos, Clubes y Temporadas.
 * @description Administra la creación y consulta de la estructura deportiva.
 */

import { Team } from "../domain/entities/Team.js";

export class TeamController {
  /**
   * @param {Object} teamRepository - Instancia de TeamRepository.
   * @param {Object} authController - Instancia de AuthController.
   * @param {Object} syncEngine - Instancia de SyncEngine.
   */
  constructor(teamRepository, authController, syncEngine) {
    this.teamRepo = teamRepository;
    this.auth = authController;
    this.syncEngine = syncEngine;
  }

  /**
   * Crea un nuevo equipo deportivo.
   * Requiere permiso 'CREATE_TEAM'.
   * 
   * @param {Object} teamData - Atributos del equipo (nombre, categoría, color, técnico, etc.).
   * @returns {Promise<Team>} Instancia del equipo guardado.
   */
  async createTeam(teamData) {
    if (!this.auth.can("CREATE_TEAM")) {
      throw new Error("PERMISO_DENEGADO: No estás autorizado para crear equipos.");
    }

    const team = new Team(teamData);
    const savedData = await this.syncEngine.enqueueOperation("teams", "CREATE", team.toJSON());
    return new Team(savedData);
  }

  /**
   * Recupera todos los equipos disponibles para el usuario conectado.
   * @returns {Promise<Array<Team>>}
   */
  async getAllTeams() {
    if (!this.auth.can("VIEW_TEAM_STATS")) {
      throw new Error("PERMISO_DENEGADO: No estás autorizado para ver equipos.");
    }
    return await this.teamRepo.getAll();
  }
}