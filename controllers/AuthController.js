/**
 * @fileoverview Controlador de Autenticación, Control de Acceso (RBAC) y Seguridad.
 * @description Gestiona el perfil del usuario conectado y valida los permisos de acción
 * según la matriz oficial definida en `APP_CONFIG.permissions`.
 */

import { APP_CONFIG } from "../config/app.config.js";

export class AuthController {
  /**
   * @param {Object} [currentUser=null] - Usuario actualmente autenticado en el sistema.
   */
  constructor(currentUser = null) {
    this.currentUser = currentUser;
  }

  /**
   * Asigna o actualiza el usuario activo en la sesión.
   * @param {Object} user - Objeto usuario con campos { id, email, role, team_id, display_name }.
   */
  setCurrentUser(user) {
    this.currentUser = user;
  }

  /**
   * Obtiene el usuario autenticado actualmente.
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Comprueba si el usuario actual tiene el rol especificado.
   * @param {string} roleName - Nombre del rol ('SUPERADMIN', 'ADMIN', 'ENTRENADOR', 'ANALISTA', 'JUGADOR').
   * @returns {boolean} True si coincide el rol, False en caso contrario.
   */
  hasRole(roleName) {
    if (!this.currentUser) return false;
    return this.currentUser.role === roleName;
  }

  /**
   * Comprueba si el usuario conectado está autorizado para ejecutar una acción específica.
   * Consulta la matriz de permisos de `APP_CONFIG.permissions`.
   * 
   * @param {string} permissionKey - Clave del permiso (ej: 'CREATE_TEAM', 'VIEW_ALL_PLAYER_STATS').
   * @returns {boolean} True si el rol del usuario está en la lista permitida.
   */
  can(permissionKey) {
    if (!this.currentUser) return false;

    const allowedRoles = APP_CONFIG.permissions[permissionKey];
    if (!allowedRoles) {
      console.warn(`[AuthController] Permiso '${permissionKey}' no definido en APP_CONFIG.`);
      return false;
    }

    return allowedRoles.includes(this.currentUser.role);
  }
}