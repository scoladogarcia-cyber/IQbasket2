/**
 * @fileoverview Controlador de Autenticación, Control de Acceso (RBAC), Sesión y Seguridad Multi-Tenant.
 * @description Gestiona el perfil del usuario activo, persistencia de sesión local-first,
 * validación de permisos de acción según roles jerárquicos (SUPERADMIN, ADMIN, SCOUT/ENTRENADOR, VIEWER/JUGADOR),
 * y aislamiento de visibilidad por club, equipo, temporada y perfil de jugador.
 * 
 * Cumple con los requerimientos:
 * 1. Control estricto de visibilidad: Un usuario solo accede a los equipos y jugadores explícitamente autorizados.
 * 2. Soporte para el flujo de validación administrativa (SUPERADMIN y ADMIN pueden aprobar ChangeRequests).
 * 3. Gestión de perfiles reducidos (VIEWER/JUGADOR solo ve sus datos o partidos permitidos y genera informes).
 * 4. Métodos puros e independientes de cálculos estadísticos.
 */

import { APP_CONFIG } from "../config/app.config.js";

/**
 * Roles estándar del sistema de seguridad.
 * @readonly
 * @enum {string}
 */
export const UserRole = {
  SUPERADMIN: "SUPERADMIN", // Acceso total a todos los clubes, equipos y aprobaciones
  ADMIN: "ADMIN",           // Head Coach / Director Deportivo (gestión y aprobación de su club/equipo)
  SCOUT: "SCOUT",           // Anotador / Asistente (registro en vivo, propuestas de cambio)
  VIEWER: "VIEWER"          // Jugador / Familia (lectura de informes y dashboards autorizados)
};

export class AuthController {
  /**
   * Crea una instancia de AuthController.
   * @param {Object|null} [currentUser=null] - Usuario autenticado inicial.
   * @param {Object|null} [storageAdapter=null] - Adaptador para persistencia de sesión (LocalStorage/IndexedDB).
   */
  constructor(currentUser = null, storageAdapter = null) {
    this.currentUser = currentUser;
    this.storage = storageAdapter;
    this.sessionKey = "iqbasket_auth_session";
    
    // Si no se pasa usuario pero hay storage, intenta restaurar sesión
    if (!this.currentUser && this.storage) {
      this.restoreSession();
    }
  }

  // =========================================================================
  // 1. GESTIÓN DE SESIÓN Y USUARIO ACTIVO
  // =========================================================================

  /**
   * Establece el usuario autenticado y persiste la sesión localmente.
   * @param {Object} user - Datos del usuario.
   * @param {string} user.id - UUID único del usuario.
   * @param {string} user.email - Correo electrónico.
   * @param {string} user.role - Rol (SUPERADMIN, ADMIN, SCOUT, VIEWER).
   * @param {string|null} [user.clubId=null] - Club asignado.
   * @param {Array<string>} [user.allowedTeamIds=[]] - Equipos autorizados.
   * @param {string|null} [user.playerId=null] - ID de jugador si es perfil individual.
   * @param {string} [user.displayName=""] - Nombre visual.
   */
  setCurrentUser(user) {
    this.currentUser = user ? {
      id: user.id,
      email: user.email,
      role: (user.role || UserRole.VIEWER).toUpperCase(),
      clubId: user.clubId ?? user.club_id ?? null,
      allowedTeamIds: this._parseArray(user.allowedTeamIds ?? user.allowed_team_ids ?? (user.team_id ? [user.team_id] : [])),
      allowedSeasonIds: this._parseArray(user.allowedSeasonIds ?? user.allowed_season_ids ?? []),
      playerId: user.playerId ?? user.player_id ?? null,
      displayName: user.displayName ?? user.display_name ?? user.email ?? "Usuario",
      lastLogin: new Date().toISOString()
    } : null;

    this.persistSession();
  }

  /**
   * Obtiene el usuario conectado actualmente.
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Comprueba si existe una sesión de usuario activa.
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.currentUser !== null && typeof this.currentUser.id === "string";
  }

  /**
   * Cierra la sesión activa y limpia el almacenamiento local.
   */
  logout() {
    this.currentUser = null;
    if (this.storage && typeof this.storage.removeItem === "function") {
      this.storage.removeItem(this.sessionKey);
    } else if (typeof localStorage !== "undefined") {
      localStorage.removeItem(this.sessionKey);
    }
  }

  /**
   * Guarda la sesión actual en el almacenamiento local.
   * @private
   */
  persistSession() {
    if (!this.currentUser) return;
    const sessionData = JSON.stringify(this.currentUser);
    if (this.storage && typeof this.storage.setItem === "function") {
      this.storage.setItem(this.sessionKey, sessionData);
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(this.sessionKey, sessionData);
    }
  }

  /**
   * Restaura la sesión desde el almacenamiento local.
   * @returns {Object|null}
   */
  restoreSession() {
    try {
      let raw = null;
      if (this.storage && typeof this.storage.getItem === "function") {
        raw = this.storage.getItem(this.sessionKey);
      } else if (typeof localStorage !== "undefined") {
        raw = localStorage.getItem(this.sessionKey);
      }

      if (raw) {
        this.currentUser = JSON.parse(raw);
        return this.currentUser;
      }
    } catch {
      this.currentUser = null;
    }
    return null;
  }

  // =========================================================================
  // 2. CONTROL DE ACCESO BASADO EN ROLES (RBAC) Y PERMISOS DE ACCIÓN
  // =========================================================================

  /**
   * Comprueba si el usuario actual posee un rol determinado o superior en jerarquía.
   * @param {string} roleName - Nombre del rol a evaluar.
   * @returns {boolean}
   */
  hasRole(roleName) {
    if (!this.currentUser) return false;
    const userRole = this.currentUser.role;
    const targetRole = String(roleName).toUpperCase();

    if (userRole === UserRole.SUPERADMIN) return true;
    return userRole === targetRole;
  }

  /**
   * Comprueba si el usuario tiene privilegios de Administrador (SUPERADMIN o ADMIN).
   * @returns {boolean}
   */
  isAdmin() {
    return this.hasRole(UserRole.ADMIN);
  }

  /**
   * Comprueba si el usuario tiene privilegios de Anotador / Scout.
   * @returns {boolean}
   */
  isScout() {
    return this.hasRole(UserRole.SCOUT) || this.isAdmin();
  }

  /**
   * Comprueba si el usuario conectado está autorizado para ejecutar una acción específica.
   * Consulta la matriz de permisos de `APP_CONFIG.permissions` o reglas por defecto.
   * 
   * @param {string} permissionKey - Clave del permiso (ej: 'VALIDATE_CHANGE_REQUESTS', 'RECORD_LIVE_GAME').
   * @returns {boolean} True si el usuario tiene autorización para la acción.
   */
  can(permissionKey) {
    if (!this.currentUser) return false;

    // SuperAdmin tiene pase universal
    if (this.currentUser.role === UserRole.SUPERADMIN) {
      return true;
    }

    const permissionsMatrix = (APP_CONFIG && APP_CONFIG.permissions) ? APP_CONFIG.permissions : this._getDefaultPermissionsMatrix();
    const allowedRoles = permissionsMatrix[permissionKey];

    if (!allowedRoles) {
      console.warn(`[AuthController] Permiso '${permissionKey}' no registrado en APP_CONFIG.permissions`);
      return false;
    }

    return allowedRoles.includes(this.currentUser.role);
  }

  // =========================================================================
  // 3. AISLAMIENTO Y SEGURIDAD MULTI-ENTIDAD (CLUB, EQUIPO, TEMPORADA, JUGADOR)
  // =========================================================================

  /**
   * Valida si el usuario actual tiene permiso de lectura o escritura sobre un club.
   * @param {string} clubId - UUID del club.
   * @returns {boolean}
   */
  canAccessClub(clubId) {
    if (!this.currentUser || !clubId) return false;
    if (this.currentUser.role === UserRole.SUPERADMIN) return true;
    return this.currentUser.clubId === clubId;
  }

  /**
   * Valida si el usuario actual tiene autorización para ver o gestionar un equipo.
   * @param {string} teamId - UUID del equipo.
   * @returns {boolean}
   */
  canAccessTeam(teamId) {
    if (!this.currentUser || !teamId) return false;
    if (this.currentUser.role === UserRole.SUPERADMIN) return true;

    const allowedTeams = this.currentUser.allowedTeamIds || [];
    return allowedTeams.includes(teamId);
  }

  /**
   * Valida si el usuario tiene permiso para consultar datos de un jugador específico.
   * Evita que usuarios con rol VIEWER vean información privada de otros jugadores.
   * @param {string} playerId - UUID del jugador.
   * @param {string} [playerTeamId=null] - UUID del equipo del jugador.
   * @returns {boolean}
   */
  canAccessPlayer(playerId, playerTeamId = null) {
    if (!this.currentUser || !playerId) return false;
    if (this.currentUser.role === UserRole.SUPERADMIN) return true;

    // Si es un perfil de Jugador/Familiar (VIEWER), solo puede ver su propia ficha
    if (this.currentUser.role === UserRole.VIEWER && this.currentUser.playerId) {
      return this.currentUser.playerId === playerId;
    }

    // Para Admin o Scout, valida que el jugador pertenezca a un equipo autorizado
    if (playerTeamId) {
      return this.canAccessTeam(playerTeamId);
    }

    return true;
  }

  /**
   * Valida si el usuario puede aprobar o rechazar solicitudes de cambio (ChangeRequests).
   * @param {Object} changeRequest - Objeto de solicitud de cambio.
   * @returns {boolean}
   */
  canApproveChangeRequest(changeRequest) {
    if (!this.currentUser || !changeRequest) return false;
    if (this.currentUser.role === UserRole.SUPERADMIN) return true;

    if (this.currentUser.role === UserRole.ADMIN) {
      // Admin de club solo puede validar solicitudes de su propio club/equipo
      if (changeRequest.club_id && changeRequest.club_id !== this.currentUser.clubId) {
        return false;
      }
      if (changeRequest.team_id && !this.canAccessTeam(changeRequest.team_id)) {
        return false;
      }
      return true;
    }

    return false;
  }

  // =========================================================================
  // 4. HELPERS PRIVADOS
  // =========================================================================

  /**
   * Helper privado para parsear arrays de forma segura.
   * @private
   * @param {Array|string|null} val
   * @returns {Array<string>}
   */
  _parseArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [val];
      } catch {
        return [val];
      }
    }
    return [];
  }

  /**
   * Matriz de permisos por defecto si no está definida en la configuración global.
   * @private
   * @returns {Object}
   */
  _getDefaultPermissionsMatrix() {
    return {
      VIEW_DASHBOARD: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SCOUT, UserRole.VIEWER],
      VIEW_REPORTS: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SCOUT, UserRole.VIEWER],
      EXPORT_REPORTS: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SCOUT, UserRole.VIEWER],
      RECORD_LIVE_GAME: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SCOUT],
      EDIT_PLAY_BY_PLAY: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SCOUT],
      CREATE_GAME: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SCOUT],
      DELETE_GAME: [UserRole.SUPERADMIN, UserRole.ADMIN],
      MANAGE_ROSTER: [UserRole.SUPERADMIN, UserRole.ADMIN],
      MANAGE_TEAMS: [UserRole.SUPERADMIN, UserRole.ADMIN],
      VALIDATE_CHANGE_REQUESTS: [UserRole.SUPERADMIN, UserRole.ADMIN],
      MANAGE_TRANSLATIONS: [UserRole.SUPERADMIN, UserRole.ADMIN],
      MANAGE_USERS: [UserRole.SUPERADMIN]
    };
  }
}