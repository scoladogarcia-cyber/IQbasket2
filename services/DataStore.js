/**
 * @fileoverview DataStore.js - Gestor de Estado Local y Caché para IQ Basket.
 * Evita timeouts cargando la base de datos en memoria y ofreciendo respuesta instantánea.
 * Sincronizado con la tabla relacional 'game_period_scores' (cuartos y prórrogas).
 */

import { supabase } from "../config/database.config.js";

class DataStoreService {
  constructor() {
    this.players = [];
    this.games = [];
    this.playerGameStats = [];
    this.gamePeriodScores = [];
    this.isLoaded = false;
    this.isLoading = false;
  }

  /**
   * Carga inicial masiva en paralelo de todas las tablas de la temporada.
   * Se ejecuta 1 sola vez al entrar en la aplicación.
   */
  async init(teamId, forceRefresh = false) {
    if (this.isLoaded && !forceRefresh) return;
    if (this.isLoading) return;

    this.isLoading = true;
    console.log("⚡ [DataStore] Cargando datos del equipo en memoria local...");

    try {
      const [pRes, gRes, sRes, psRes] = await Promise.all([
        supabase.from("players").select("*").eq("team_id", teamId),
        supabase.from("games").select("*").eq("team_id", teamId).order("date", { ascending: false }),
        supabase.from("player_game_stats").select("*"),
        supabase.from("game_period_scores").select("*")
      ]);

      this.players = pRes.data || [];
      this.games = gRes.data || [];
      this.playerGameStats = sRes.data || [];
      this.gamePeriodScores = psRes.data || [];

      this.isLoaded = true;
      console.log("✅ [DataStore] Datos cargados con éxito en memoria local.");
    } catch (err) {
      console.error("❌ [DataStore] Error cargando caché local:", err);
    } finally {
      this.isLoading = false;
    }
  }

  // --- GETTERS ULTRARRÁPIDOS (0ms) ---
  getPlayers() { return this.players; }
  getPlayerById(id) { return this.players.find(p => String(p.id) === String(id)); }
  
  getGames() { return this.games; }
  getGameById(id) { return this.games.find(g => String(g.id) === String(id)); }

  getPlayerGameStats(playerId = null, gameId = null) {
    return this.playerGameStats.filter(s => {
      const matchP = playerId ? String(s.player_id) === String(playerId) : true;
      const matchG = gameId ? String(s.game_id) === String(gameId) : true;
      return matchP && matchG;
    });
  }

  /**
   * Obtiene los cuartos y prórrogas ordenados de un partido específico
   */
  getGamePeriodScores(gameId) {
    return this.gamePeriodScores
      .filter(p => String(p.game_id) === String(gameId))
      .sort((a, b) => {
        if (a.is_overtime !== b.is_overtime) return a.is_overtime ? 1 : -1;
        return a.period_number - b.period_number;
      });
  }

  // --- OPERACIONES DE GUARDADO (PUSH A SUPABASE + ACTUALIZACIÓN LOCAL) ---
  async updatePlayer(playerId, updates) {
    // 1. Actualización local inmediata
    const idx = this.players.findIndex(p => String(p.id) === String(playerId));
    if (idx !== -1) {
      this.players[idx] = { ...this.players[idx], ...updates };
    }

    // 2. Push a Supabase en segundo plano
    const { error } = await supabase.from("players").update(updates).eq("id", playerId);
    if (error) console.error("Error al hacer push de jugador:", error);
  }

  /**
   * Guardado unificado de partido, estadísticas individuales y marcadores por periodo/prórroga
   */
  async saveGameAndStats(gameData, statsList, periodScoresList) {
    // 1. Push Partido a Supabase
    let savedGameId = gameData.id;
    if (savedGameId) {
      await supabase.from("games").update(gameData).eq("id", savedGameId);
      const idx = this.games.findIndex(g => String(g.id) === String(savedGameId));
      if (idx !== -1) this.games[idx] = { ...this.games[idx], ...gameData };
    } else {
      const { data } = await supabase.from("games").insert([gameData]).select().single();
      if (data) {
        savedGameId = data.id;
        this.games.unshift(data);
      }
    }

    if (!savedGameId) return;

    // 2. Push Estadísticas por Jugador
    for (const st of statsList) {
      const payload = { ...st, game_id: savedGameId };
      await supabase.from("player_game_stats").upsert(payload, { onConflict: "game_id,player_id" });

      // Actualizar caché local de stats
      const sIdx = this.playerGameStats.findIndex(
        s => String(s.game_id) === String(savedGameId) && String(s.player_id) === String(st.player_id)
      );
      if (sIdx !== -1) {
        this.playerGameStats[sIdx] = { ...this.playerGameStats[sIdx], ...payload };
      } else {
        this.playerGameStats.push(payload);
      }
    }

    // 3. Reemplazar y Sincronizar 'game_period_scores' (Cuartos y Prórrogas)
    if (periodScoresList) {
      // Borrar de Supabase los periodos viejos del partido
      await supabase.from("game_period_scores").delete().eq("game_id", savedGameId);
      
      // Limpiar de la caché local los periodos viejos
      this.gamePeriodScores = this.gamePeriodScores.filter(p => String(p.game_id) !== String(savedGameId));

      const preparedPeriods = periodScoresList.map(p => ({
        game_id: savedGameId,
        period_type: p.period_type || (p.is_overtime ? 'overtime' : 'quarter'),
        period_number: p.period_number,
        team_score: Number(p.team_score || 0),
        opponent_score: Number(p.opponent_score || 0),
        is_overtime: Boolean(p.is_overtime)
      }));

      // Insertar nuevos periodos en Supabase
      const { data: insertedPeriods } = await supabase
        .from("game_period_scores")
        .insert(preparedPeriods)
        .select();

      // Actualizar la caché local
      if (insertedPeriods) {
        this.gamePeriodScores.push(...insertedPeriods);
      } else {
        this.gamePeriodScores.push(...preparedPeriods);
      }
    }
  }
}

export const DataStore = new DataStoreService();