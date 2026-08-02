/**
 * @fileoverview Configuración de persistencia y colecciones de datos de IQ Basket.
 * Mapea las tablas de Supabase vinculándose con las credenciales de env.js
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { ENV } from './env.js';

export const DATABASE_CONFIG = {
  strategy: "HYBRID",
  localStoragePrefix: "iq_basket_v2_",
  supabaseUrl: ENV.SUPABASE_URL,
  supabaseAnonKey: ENV.SUPABASE_ANON_KEY,

  collections: {
    CLUBS: "clubs",
    TEAMS: "teams",
    PLAYERS: "players",
    SEASONS: "seasons",
    GAMES: "games",
    GAME_PERIODS: "game_period_scores",
    PLAYER_GAME_STATS: "player_game_stats",   // Box score e indicadores individuales
    TEAM_GAME_STATS: "team_game_stats",       // Métricas colectivas y Four Factors
    PLAY_BY_PLAY: "play_by_play_events",      // Eventos etiquetados (saques, tiros, etc.)
    USERS: "profiles",
    TRANSLATIONS: "translations"
  }
};

/**
 * Instancia global del cliente de Supabase vinculada con las credenciales aisladas
 */
export const supabase = createClient(
  DATABASE_CONFIG.supabaseUrl, 
  DATABASE_CONFIG.supabaseAnonKey
);

export default supabase;