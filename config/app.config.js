/**
 * @fileoverview Configuración Global de la Aplicación: APP_CONFIG.
 * @description Centraliza metadatos del sistema, matriz de permisos RBAC oficial,
 * constantes reglamentarias de baloncesto FIBA, rutas de vistas y parámetros de IA.
 */

export const APP_CONFIG = {
  appName: "IQ Basket",
  version: "2.4.0",
  environment: "production",
  defaultSeason: "2026",
  
  // =========================================================================
  // MATRIZ OFICIAL DE CONTROL DE ACCESO BASADO EN ROLES (RBAC)
  // =========================================================================
  permissions: {
    // Dashboards y Consultas Generales
    VIEW_DASHBOARD: ["SUPERADMIN", "ADMIN", "SCOUT", "VIEWER"],
    VIEW_REPORTS: ["SUPERADMIN", "ADMIN", "SCOUT", "VIEWER"],
    EXPORT_REPORTS: ["SUPERADMIN", "ADMIN", "SCOUT", "VIEWER"],
    VIEW_ALL_PLAYER_STATS: ["SUPERADMIN", "ADMIN", "SCOUT"],
    VIEW_TEAM_STATS: ["SUPERADMIN", "ADMIN", "SCOUT", "VIEWER"],
    
    // Registro y Toma de Datos en Vivo (Event Sourcing / Play-by-Play)
    RECORD_LIVE_GAME: ["SUPERADMIN", "ADMIN", "SCOUT"],
    EDIT_PLAY_BY_PLAY: ["SUPERADMIN", "ADMIN", "SCOUT"],
    CREATE_GAME: ["SUPERADMIN", "ADMIN", "SCOUT"],
    DELETE_GAME: ["SUPERADMIN", "ADMIN"],
    
    // Gestión de Entidades (Plantilla y Estructura Deportiva)
    MANAGE_ROSTER: ["SUPERADMIN", "ADMIN"],
    CREATE_PLAYER: ["SUPERADMIN", "ADMIN"],
    EDIT_PLAYER: ["SUPERADMIN", "ADMIN"],
    DELETE_PLAYER: ["SUPERADMIN", "ADMIN"],
    MANAGE_TEAMS: ["SUPERADMIN", "ADMIN"],
    CREATE_TEAM: ["SUPERADMIN", "ADMIN"],
    EDIT_TEAM: ["SUPERADMIN", "ADMIN"],
    DELETE_TEAM: ["SUPERADMIN", "ADMIN"],
    
    // Auditoría, Aprobaciones y Sistema
    VALIDATE_CHANGE_REQUESTS: ["SUPERADMIN", "ADMIN"],
    MANAGE_TRANSLATIONS: ["SUPERADMIN", "ADMIN"],
    MANAGE_USERS: ["SUPERADMIN"]
  },

  // =========================================================================
  // PARÁMETROS REGLAMENTARIOS DE BALONCESTO (FIBA)
  // =========================================================================
  basketball: {
    periodMinutes: 10,
    overtimeMinutes: 5,
    regulationPeriods: 4,
    foulsBonusLimit: 5,
    playersOnCourt: 5,
    positions: [
      { id: "PG", name: "Base", shortName: "1" },
      { id: "SG", name: "Escolta", shortName: "2" },
      { id: "SF", name: "Alero", shortName: "3" },
      { id: "PF", name: "Ala-Pívot", shortName: "4" },
      { id: "C", name: "Pívot", shortName: "5" }
    ],
    shotZones: {
      RESTRICTED_AREA_RADIUS: 1.25, // metros
      PAINT_WIDTH: 4.9,
      PAINT_LENGTH: 5.8,
      THREE_POINT_RADIUS: 6.75,     // Distancia FIBA oficial
      CORNER_THREE_DISTANCE: 6.60
    }
  },

  // =========================================================================
  // CONFIGURACIÓN DEL ASISTENTE DE IA (LLM)
  // =========================================================================
  ai: {
    defaultModel: "gemini-2.5-pro",
    temperature: 0.2,
    maxTokens: 1500,
    supportedLanguages: ["es", "ca", "en", "fr"]
  }
};

export default APP_CONFIG;