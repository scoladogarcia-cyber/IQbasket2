/**
 * @fileoverview Configuración de Persistencia, Conexión y Colecciones: DATABASE_CONFIG.
 * @description Centraliza las credenciales, nombres de tablas relacionales de Supabase,
 * prefijos de almacenamiento local (LocalStorage / IndexedDB) y crea la instancia singleton del cliente Supabase.
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { ENV } from "./env.js";

export const DATABASE_CONFIG = {
  strategy: "HYBRID", // Local-First con sincronización en background
  localStoragePrefix: "iqbasket_v2_",
  supabaseUrl: ENV.SUPABASE_URL,
  supabaseAnonKey: ENV.SUPABASE_ANON_KEY,

  // Mapeo exacto de colecciones y tablas en Supabase
  collections: {
    CLUBS: "clubs",
    TEAMS: "teams",
    PLAYERS: "players",
    SEASONS: "seasons",
    GAMES: "games",
    GAME_PERIODS: "game_period_scores",
    GAME_EVENTS: "game_events",
    PLAYER_GAME_STATS: "player_game_stats",     // Box score y fórmulas individuales del catálogo
    TEAM_GAME_STATS: "team_game_stats",         // Four Factors y métricas colectivas
    LINEUP_GAME_STATS: "lineup_game_stats",     // Rendimiento de quintetos
    PLAY_BY_PLAY: "play_by_play_events",

    // Identidad real auditada: auth.users.id === user_profiles.id.
    USERS: "user_profiles",
    USER_PROFILES: "user_profiles",
    LEGACY_PROFILES: "profiles",

    // Tablas de acceso existentes en el esquema real.
    TEAM_MEMBERS: "team_members",
    TEAM_JOIN_REQUESTS: "team_join_requests",
    JOIN_REQUESTS: "join_requests",
    INVITATIONS: "invitations",

    // Colección propuesta por arquitectura antigua. No existe en la BD auditada
    // y no debe usarse hasta que el modelo v3 defina el flujo definitivo.
    CHANGE_REQUESTS: "change_requests",

    TRANSLATIONS: "translations",

    // Modelo v3 Fase 1: estructura y backfill ya validados.
    // El runtime adopta estas colecciones progresivamente con compatibilidad legacy;
    // RLS permanece desactivado hasta la fase de seguridad.
    SEASON_CATALOG: "season_catalog",
    TEAM_SEASONS: "team_seasons",
    ROSTER_MEMBERSHIPS: "roster_memberships",
    TEAM_SEASON_MEMBERSHIPS: "team_season_memberships",
    CLUB_SEASON_MEMBERSHIPS: "club_season_memberships",
    USER_PLAYER_LINKS: "user_player_links",
    ANALYTICS_RUNS: "analytics_runs",
    PLAYER_SEASON_METRICS: "player_season_metrics",
    TEAM_SEASON_METRICS: "team_season_metrics",
    LINEUP_SEASON_METRICS: "lineup_season_metrics"
  }
};

/**
 * Instancia singleton universal de Supabase Client.
 */
export const supabase = createClient(
  DATABASE_CONFIG.supabaseUrl,
  DATABASE_CONFIG.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

export default supabase;