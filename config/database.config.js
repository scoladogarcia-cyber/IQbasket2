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
    CHANGE_REQUESTS: "change_requests",         // Propuestas de cambio pendientes de validación
    USERS: "profiles",
    TRANSLATIONS: "translations"
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