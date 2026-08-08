/**
 * @fileoverview Configuración global, marca, reglas deportivas y matriz RBAC de IQ Basket.
 * @description Centraliza el nombre oficial "IQ Basket", las reglas de baloncesto, los 6 roles oficiales,
 * la matriz de permisos RBAC con restricciones por rol y los límites mensuales de consultas para el Asistente IA.
 */

export const APP_CONFIG = Object.freeze({
  /** Nombre principal unificado de la marca */
  appName: "IQ Basket",
  
  /** Título extendido para PWA y encabezado de navegador */
  appTitle: "IQ Basket - Basketball Stats Studio Pro",
  
  /** Versión del software */
  version: "2.0.0",
  env: "development",

  /**
   * Parámetros oficiales de juego (Reglas reglamentarias y prórrogas)
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
    JUGADOR: "JUGADOR",            // Solo ve su equipo y sus propias stats
    INVITADO: "INVITADO"          // Modo lectura pública / demostración
  },

  /**
   * Límites mensuales de consultas al Asistente IA por rol (-1 = ilimitado, 0 = bloqueado)
   */
  aiMonthlyLimits: {
    SUPERADMIN: -1,
    ADMIN: 200,
    ENTRENADOR: 100,
    ANALISTA: 100,
    JUGADOR: 0,
    INVITADO: 0
  },

  /**
   * Matriz RBAC (Role-Based Access Control): Vincula acciones con los roles autorizados.
   */
  permissions: {
    // 1. Clubes y Estructura
    VIEW_CLUBS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    CREATE_CLUB: ["SUPERADMIN"],
    EDIT_CLUB: ["SUPERADMIN", "ADMIN"],
    DELETE_CLUB: ["SUPERADMIN"],

    // 2. Equipos y Temporadas
    VIEW_TEAMS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    CREATE_TEAM: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    EDIT_TEAM: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    SWITCH_TEAM_CONTEXT: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    CREATE_SEASON: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    EDIT_SEASON: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    SWITCH_SEASON: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],

    // 3. Plantilla y Jugadores
    VIEW_ROSTER: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    CREATE_PLAYER: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    EDIT_PLAYER: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    SEARCH_GLOBAL_MARKET: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    REQUEST_TRANSFER: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    APPROVE_TRANSFER: ["SUPERADMIN", "ADMIN"],

    // 4. Anotación y Partidos
    RECORD_GAME: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"],
    RECORD_LIVE_GAME: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    EDIT_BOXSCORE: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],
    VIEW_GAMES: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    CREATE_GAME: ["SUPERADMIN", "ADMIN", "ENTRENADOR"],

    // 5. Visualización de Estadísticas (Privacidad y Métricas)
    VIEW_GAME_STATS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    VIEW_TEAM_STATS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    VIEW_ALL_PLAYER_STATS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"],
    VIEW_OWN_PLAYER_STATS: ["JUGADOR"],
    VIEW_DASHBOARD: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    VIEW_ADVANCED_STATS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    VIEW_LINEUP_STATS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    VIEW_COMPARATOR: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],

    // 6. Informes y Exportaciones
    EXPORT_DATA: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"],
    GENERATE_REPORTS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    EXPORT_REPORTS_PDF: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"],

    // 7. Gestión de Usuarios, Solicitudes y Roles
    VIEW_USERS: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    INVITE_USER: ["SUPERADMIN", "ADMIN"],
    ASSIGN_ROLES_AND_TEAMS: ["SUPERADMIN", "ADMIN"],
    CHANGE_USER_ROLE: ["SUPERADMIN"],
    REQUEST_TEAM_MEMBERSHIP: ["ENTRENADOR", "ANALISTA", "JUGADOR"],
    APPROVE_JOIN_REQUEST: ["SUPERADMIN", "ADMIN"],

    // 8. Asistente IA
    VIEW_AI_NAV: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"],
    QUERY_AI: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"],

    // 9. Administración del Sistema e Internacionalización
    MANAGE_TRANSLATIONS: ["SUPERADMIN"],
    SWITCH_LOCALE: ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA", "JUGADOR", "INVITADO"]
  }
});

export default APP_CONFIG;