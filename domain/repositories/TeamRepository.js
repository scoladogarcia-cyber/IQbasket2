/**
 * @fileoverview Repositorio del Dominio: TeamRepository (Equipos).
 * @description Capa de persistencia y consulta para la entidad `Team`.
 * Diseñado bajo el principio Local-First con soporte para:
 * - Aislamiento estricto multiclub (clubId) y control de acceso por usuario/rol.
 * - Consultas paginadas o filtradas por club, categoría y temporada.
 * - Flujo de auditoría y solicitudes de cambio (ChangeRequests) para aprobación de Admin/SuperAdmin.
 * - Detección de conflictos de versiones y control de concurrencia optimista.
 */

import { DATABASE_CONFIG } from "../../config/database.config.js";
import { Team } from "../entities/Team.js";

export class TeamRepository {
  /**
   * Crea una instancia de TeamRepository.
   * @param {Object} dbAdapter - Adaptador de persistencia (LocalStorageAdapter o SupabaseAdapter).
   */
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.collection = DATABASE_CONFIG.collections.TEAMS;
    this.changeRequestsCollection = DATABASE_CONFIG.collections.CHANGE_REQUESTS || "change_requests";
  }

  // =========================================================================
  // 1. MÉTODOS DE CONSULTA Y FILTRADO (MULTI-CLUB & AISLAMIENTO)
  // =========================================================================

  /**
   * Obtiene todos los equipos aplicando filtros de aislamiento multitenant.
   * @param {Object} [filter={}] - Criterios de filtrado (clubId, category, gender).
   * @returns {Promise<Array<Team>>} Lista de instancias de Team.
   */
  async getAll(filter = {}) {
    const criteria = {};
    if (filter.clubId) criteria.club_id = filter.clubId;
    if (filter.category) criteria.category = filter.category;
    if (filter.gender) criteria.gender = filter.gender;

    const rawItems = await this.db.query(this.collection, criteria);
    return (rawItems || []).map((item) => Team.fromJSON(item));
  }

  /**
   * Obtiene un equipo por su identificador único.
   * @param {string} id - UUID del equipo.
   * @returns {Promise<Team|null>} Instancia de Team o null si no existe.
   */
  async getById(id) {
    if (!id) return null;
    const item = await this.db.getById(this.collection, id);
    return item ? Team.fromJSON(item) : null;
  }

  /**
   * Obtiene los equipos pertenecientes a un club específico.
   * @param {string} clubId - UUID del club/organización.
   * @returns {Promise<Array<Team>>}
   */
  async getByClubId(clubId) {
    if (!clubId) return [];
    return this.getAll({ clubId });
  }

  /**
   * Obtiene un conjunto de equipos a partir de un array de identificadores.
   * @param {Array<string>} teamIds - Lista de UUIDs de equipos.
   * @returns {Promise<Array<Team>>}
   */
  async getByIds(teamIds = []) {
    if (!Array.isArray(teamIds) || teamIds.length === 0) return [];

    if (typeof this.db.getByIds === "function") {
      const rawItems = await this.db.getByIds(this.collection, teamIds);
      return (rawItems || []).map((item) => Team.fromJSON(item));
    }

    const promises = teamIds.map((id) => this.getById(id));
    const results = await Promise.all(promises);
    return results.filter((t) => t !== null);
  }

  // =========================================================================
  // 2. MÉTODOS DE PERSISTENCIA (LOCAL & CLOUD)
  // =========================================================================

  /**
   * Guarda un nuevo equipo en el almacenamiento activo.
   * @param {Team} teamInstance - Instancia de Team a persistir.
   * @returns {Promise<Team>} Instancia guardada con metadatos actualizados.
   */
  async save(teamInstance) {
    if (!(teamInstance instanceof Team)) {
      throw new Error("TeamRepository.save: Se requiere una instancia válida de Team");
    }
    const data = teamInstance.toJSON();
    const savedData = await this.db.save(this.collection, data);
    return Team.fromJSON(savedData);
  }

  /**
   * Actualiza los datos de un equipo existente.
   * @param {string} id - UUID del equipo.
   * @param {Team} teamInstance - Instancia de Team con las modificaciones.
   * @returns {Promise<Team>} Instancia actualizada.
   */
  async update(id, teamInstance) {
    if (!id || !(teamInstance instanceof Team)) {
      throw new Error("TeamRepository.update: Parámetros inválidos");
    }
    teamInstance.touchLocal();
    const data = teamInstance.toJSON();
    const updatedData = await this.db.update(this.collection, id, data);
    return Team.fromJSON(updatedData);
  }

  /**
   * Elimina un equipo del sistema.
   * @param {string} id - UUID del equipo.
   * @returns {Promise<boolean>} True si la eliminación fue exitosa.
   */
  async delete(id) {
    if (!id) return false;
    return await this.db.delete(this.collection, id);
  }

  // =========================================================================
  // 3. CONTROL DE AUDITORÍA, PROPUESTAS Y CONCURRENCIA
  // =========================================================================

  /**
   * Envía una propuesta de cambio de datos de equipo al Administrador (ChangeRequest).
   * @param {Object} params
   * @param {string} params.teamId - UUID del equipo.
   * @param {Team} params.proposedTeam - Datos modificados en local.
   * @param {string} params.requestedBy - ID del usuario solicitante.
   * @param {string} params.userRole - Rol del usuario ('scout', 'assistant', etc.).
   * @returns {Promise<Object>} Registro de la solicitud creada.
   */
  async submitChangeRequest({ teamId, proposedTeam, requestedBy, userRole }) {
    const currentServerTeam = await this.getById(teamId);

    const changeRequestData = {
      id: `cr_team_${teamId}_${Date.now()}`,
      table_name: this.collection,
      record_id: teamId,
      club_id: proposedTeam.clubId,
      team_id: teamId,
      previous_state: currentServerTeam ? JSON.stringify(currentServerTeam.toJSON()) : null,
      proposed_state: JSON.stringify(proposedTeam.toJSON()),
      requested_by: requestedBy,
      user_role: userRole,
      status: "PENDING",
      request_timestamp: new Date().toISOString(),
      server_last_modified: currentServerTeam ? currentServerTeam.serverUpdatedAt : null
    };

    proposedTeam.syncStatus = "PENDING_APPROVAL";
    await this.save(proposedTeam);

    return await this.db.save(this.changeRequestsCollection, changeRequestData);
  }

  /**
   * Compara la versión local con la del servidor para detectar cambios más recientes.
   * @param {string} teamId - UUID del equipo.
   * @param {string} localUpdatedAt - Timestamp ISO local.
   * @returns {Promise<{ hasConflict: boolean, serverTeam: Team|null }>}
   */
  async checkServerVersionConflict(teamId, localUpdatedAt) {
    const serverTeam = await this.getById(teamId);
    if (!serverTeam || !serverTeam.serverUpdatedAt || !localUpdatedAt) {
      return { hasConflict: false, serverTeam };
    }

    const localTime = new Date(localUpdatedAt).getTime();
    const serverTime = new Date(serverTeam.serverUpdatedAt).getTime();

    return {
      hasConflict: serverTime > localTime,
      serverTeam
    };
  }
}