/**
 * @fileoverview Controlador de Equipos, Clubes y Estructura Deportiva: TeamController.
 * @description Administra la creación, modificación, consulta y aislamiento de equipos,
 * categorías y temporadas en iqbasket.
 * 
 * Reglas de diseño y seguridad:
 * 1. Aislamiento multi-club y multi-equipo: Un usuario solo puede acceder a los equipos autorizados por RBAC.
 * 2. Desacoplamiento de cálculos: Las métricas agregadas del equipo se delegan a StatsEngine/StatsAggregator.
 * 3. Gestión local-first con ChangeRequests: Cambios realizados por roles no administradores pasan por propuesta y validación.
 * 4. Métodos asíncronos y robustos con tipado seguro y control de errores.
 */

import { Team } from "../domain/entities/Team.js";
import { UserRole } from "./AuthController.js";

export class TeamController {
  /**
   * Crea una instancia de TeamController.
   * @param {Object} teamRepository - Repositorio de persistencia de equipos.
   * @param {Object} authController - Controlador de autenticación y permisos.
   * @param {Object} [syncEngine=null] - Motor de sincronización local/cloud.
   */
  constructor(teamRepository, authController, syncEngine = null) {
    this.teamRepo = teamRepository;
    this.auth = authController;
    this.syncEngine = syncEngine;
  }

  // =========================================================================
  // 1. CONSULTA Y ACCESO MULTI-ENTIDAD (CLUB & EQUIPO)
  // =========================================================================

  /**
   * Recupera todos los equipos a los que el usuario activo tiene acceso permitido.
   * @param {Object} [filter={}] - Filtros adicionales (category, gender, clubId).
   * @returns {Promise<Array<Team>>} Lista de equipos autorizados.
   */
  async getAllTeams(filter = {}) {
    const user = this.auth.getCurrentUser();
    if (!user) {
      throw new Error("Acceso denegado: Inicie sesión para continuar.");
    }

    const queryFilter = { ...filter };

    // Si no es SuperAdmin, aísla por su club
    if (!this.auth.hasRole(UserRole.SUPERADMIN)) {
      if (user.clubId) {
        queryFilter.clubId = user.clubId;
      }
    }

    const allTeams = await this.teamRepo.getAll(queryFilter);

    // Filtrado por lista de equipos permitidos para el usuario
    if (this.auth.hasRole(UserRole.SUPERADMIN)) {
      return allTeams;
    }

    const allowedIds = user.allowedTeamIds || [];
    return allTeams.filter((t) => allowedIds.includes(t.id));
  }

  /**
   * Obtiene la ficha de un equipo por su ID verificando permisos de acceso.
   * @param {string} teamId - UUID del equipo.
   * @returns {Promise<Team>} Instancia del equipo.
   */
  async getTeamById(teamId) {
    if (!teamId) {
      throw new Error("Identificador de equipo no especificado.");
    }

    if (!this.auth.canAccessTeam(teamId)) {
      throw new Error("Acceso denegado: No tiene permisos sobre este equipo.");
    }

    const team = await this.teamRepo.getById(teamId);
    if (!team) {
      throw new Error("Equipo no encontrado.");
    }

    return team;
  }

  // =========================================================================
  // 2. GESTIÓN DE EQUIPOS (ALTAS, MODIFICACIONES Y BAJAS)
  // =========================================================================

  /**
   * Crea un nuevo equipo deportivo con control de permisos y auditoría.
   * @param {Object} teamData - Atributos del equipo (nombre, categoría, color, técnico, etc.).
   * @returns {Promise<{ team: Team, changeRequest: Object|null }>}
   */
  async createTeam(teamData = {}) {
    if (!this.auth.can("MANAGE_TEAMS")) {
      throw new Error("Permisos insuficientes para crear equipos.");
    }

    const user = this.auth.getCurrentUser();
    const newTeam = new Team({
      ...teamData,
      clubId: user.clubId || teamData.clubId,
      lastModifiedBy: user.id,
      syncStatus: this.auth.isAdmin() ? "SYNCHRONIZED" : "PENDING_APPROVAL"
    });

    let savedTeam = null;
    let changeRequest = null;

    if (this.auth.isAdmin()) {
      savedTeam = await this.teamRepo.save(newTeam);
      if (this.syncEngine && typeof this.syncEngine.pushRecord === "function") {
        await this.syncEngine.pushRecord("teams", savedTeam.toJSON());
      }
    } else {
      // Guardado local y generación de propuesta de cambio para el Administrador
      savedTeam = await this.teamRepo.save(newTeam);
      changeRequest = await this.teamRepo.submitChangeRequest({
        teamId: savedTeam.id,
        proposedTeam: savedTeam,
        requestedBy: user.id,
        userRole: user.role
      });
    }

    return { team: savedTeam, changeRequest };
  }

  /**
   * Actualiza los datos de un equipo existente.
   * @param {string} teamId - UUID del equipo.
   * @param {Object} updateData - Propiedades modificadas.
   * @returns {Promise<{ team: Team, changeRequest: Object|null }>}
   */
  async updateTeam(teamId, updateData = {}) {
    const existingTeam = await this.getTeamById(teamId);
    if (!this.auth.can("MANAGE_TEAMS")) {
      throw new Error("Permisos insuficientes para modificar datos de equipos.");
    }

    const user = this.auth.getCurrentUser();
    const updatedTeam = new Team({
      ...existingTeam,
      ...updateData,
      id: teamId,
      lastModifiedBy: user.id
    });

    let savedTeam = null;
    let changeRequest = null;

    if (this.auth.isAdmin()) {
      savedTeam = await this.teamRepo.update(teamId, updatedTeam);
      if (this.syncEngine && typeof this.syncEngine.pushRecord === "function") {
        await this.syncEngine.pushRecord("teams", savedTeam.toJSON());
      }
    } else {
      savedTeam = await this.teamRepo.update(teamId, updatedTeam);
      changeRequest = await this.teamRepo.submitChangeRequest({
        teamId,
        proposedTeam: updatedTeam,
        requestedBy: user.id,
        userRole: user.role
      });
    }

    return { team: savedTeam, changeRequest };
  }

  /**
   * Elimina un equipo deportivo del sistema.
   * Requiere rol de Administrador o Superadministrador.
   * @param {string} teamId - UUID del equipo.
   * @returns {Promise<boolean>}
   */
  async deleteTeam(teamId) {
    await this.getTeamById(teamId); // Valida acceso previo
    if (!this.auth.can("MANAGE_TEAMS")) {
      throw new Error("Permisos insuficientes para eliminar equipos.");
    }

    return await this.teamRepo.delete(teamId);
  }
}