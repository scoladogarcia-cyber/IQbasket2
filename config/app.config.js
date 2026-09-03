import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";

const PERMISSIONS_BY_ACTION = Object.freeze(
  Object.fromEntries(
    Object.values(Permission).map(permission => [
      permission,
      Object.entries(ROLE_PERMISSIONS)
        .filter(([, permissions]) => permissions.includes(permission))
        .map(([role]) => role)
    ])
  )
);

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
  permissions: PERMISSIONS_BY_ACTION,

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