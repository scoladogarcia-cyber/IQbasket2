/**
 * @fileoverview Configuración global y parámetros operativos de IQ Basket.
 * @description Centraliza reglas del deporte, los 5 roles oficiales (SUPERADMIN, ADMIN, ENTRENADOR, ANALISTA, JUGADOR)
 * y la matriz completa de permisos con restricción de privacidad para el rol JUGADOR.
 */

/**
 * @typedef {Object} BasketballRules
 * @property {number} regularPeriodsPerGame - Periodos reglamentarios (4 cuartos).
 * @property {number} periodDurationMinutes - Duración en minutos de cada cuarto.
 * @property {number} overtimeDurationMinutes - Duración en minutos de cada prórroga.
 * @property {number} maxFoulsPerPlayer - Límite de faltas para aviso/expulsión de jugador.
 * @property {boolean} allowUnlimitedOvertimes - Permite añadir prórrogas dinámicas ilimitadas (OT1, OT2... OTn).
 */

/**
 * Configuración maestra de IQ Basket.
 */
export const APP_CONFIG = {
  /** Nombre oficial de la aplicación */
  appName: "IQ Basket - Basketball Stats Studio Pro",
  /** Versión del software */
  version: "2.0.0",
  env: "development",
  
  /**
   * Parámetros reales de juego utilizados en la app.
   * Soporta periodos reglamentarios y prórrogas ilimitadas dinámicas.
   * @type {BasketballRules}
   */
  basketball: {
    regularPeriodsPerGame: 4,      // Periodos reglamentarios (4 cuartos)
    periodDurationMinutes: 10,     // Duración en minutos de cada cuarto
    overtimeDurationMinutes: 5,    // Duración en minutos de cada prórroga
    maxFoulsPerPlayer: 5,          // Límite de faltas para aviso/expulsión de jugador
    allowUnlimitedOvertimes: true  // Permite añadir prórrogas dinámicas ilimitadas (OT1, OT2... OTn)
  },

  /**
   * Roles de usuario oficiales e innegociables del sistema IQ Basket.
   */
  roles: {
    SUPERADMIN: "SUPERADMIN",     // Acceso y visibilidad total de la plataforma
    ADMIN: "ADMIN",               // Gestión de club / liga
    ENTRENADOR: "ENTRENADOR",     // Gestión de plantilla y partidos
    ANALISTA: "ANALISTA",         // Scouting y analítica avanzada
    JUGADOR: "JUGADOR"            // Solo ve su equipo y sus propias stats
  },

  /**
   * Matriz de Permisos: Vincula las acciones del sistema con los roles autorizados.
   */
  permissions: {
    // Estructura y Altas
    CREATE_SEASON: ["SUPERADMIN", "ADMIN"],
    CREATE_TEAM: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    CREATE_PLAYER: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    EDIT_PLAYER: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    
    // Anotación y Partidos
    RECORD_GAME: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"],
    
    // Visualización de Estadísticas de Partido y Equipo
    VIEW_GAME_STATS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR"],
    VIEW_TEAM_STATS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR"],
    
    // Visualización de Estadísticas Individuales de Jugador (Restricción de Privacidad)
    VIEW_ALL_PLAYER_STATS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"], // Ve a todos los jugadores
    VIEW_OWN_PLAYER_STATS: ["JUGADOR"],                                      // Solo ve sus propias estadísticas
    
    // Informes y Exportaciones
    EXPORT_DATA: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"],
    GENERATE_REPORTS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR"],
    
    // Gestión de Usuarios, Roles, Equipos y Solicitudes
    ASSIGN_ROLES_AND_TEAMS: ["SUPERADMIN", "ADMIN"],
    REQUEST_TEAM_MEMBERSHIP: ["ENTRENADOR", "ANALISTA", "JUGADOR"],
    
    // Administración del Sistema
    MANAGE_TRANSLATIONS: ["SUPERADMIN"]
  }
};