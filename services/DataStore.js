/**
 * @fileoverview DataStore.js - Gestor de Estado Local y Caché para IQ Basket.
 * Resuelve la recuperación de datos al alternar entre múltiples equipos sin necesidad de reiniciar la app.
 * Garantiza la resolución correcta de UUIDs para season_id, inserciones limpias sin fallos de ON CONFLICT
 * y el retorno consistente del UUID del partido guardado.
 */

import { supabase } from "../config/database.config.js";

class DataStoreService {
  constructor() {
    this.clubs = [];
    this.teams = [];
    this.players = [];
    this.games = [];
    this.seasons = [];
    this.playerGameStats = [];
    this.gamePeriodScores = [];
    this.isLoaded = false;
    this.isLoading = false;
  }

  /**
   * Carga los datos del equipo activo y temporadas optimizando el tráfico de red.
   */
  async init(teamId, forceRefresh = false) {
    const activeTeamId = teamId || this.getActiveTeamId();

    if (this.isLoaded && !forceRefresh) return;
    if (this.isLoading) return;

    this.isLoading = true;
    console.log(`⚡ [DataStore] Sincronizando equipo: ${activeTeamId}...`);

    try {
      // 1. Consulta principal paralela
      const [cRes, tRes, pRes, gRes, sRes] = await Promise.all([
        supabase.from("clubs").select("*"),
        supabase.from("teams").select("*"),
        supabase.from("players").select("*").eq("team_id", activeTeamId),
        supabase.from("games").select("*").eq("team_id", activeTeamId).order("date", { ascending: false }),
        supabase.from("seasons").select("*").order("created_at", { ascending: false })
      ]);

      if (cRes.error) throw cRes.error;
      if (tRes.error) throw tRes.error;
      if (pRes.error) throw pRes.error;
      if (gRes.error) throw gRes.error;

      const teamGames = gRes.data || [];
      const gameIds = teamGames.map(g => g.id);

      // 2. Consulta filtrada de estadísticas y cuartos solo para los partidos del equipo
      let sData = [];
      let psData = [];

      if (gameIds.length > 0) {
        const [statsRes, psRes] = await Promise.all([
          supabase.from("player_game_stats").select("*").in("game_id", gameIds),
          supabase.from("game_period_scores").select("*").in("game_id", gameIds)
        ]);

        if (statsRes.error) throw statsRes.error;
        if (psRes.error) throw psRes.error;

        sData = statsRes.data || [];
        psData = psRes.data || [];
      }

      // 3. Volcado atómico en memoria
      this.clubs = cRes.data || [];
      this.teams = tRes.data || [];
      this.players = pRes.data || [];
      this.games = teamGames;
      this.seasons = sRes.data || [];
      this.playerGameStats = sData;
      this.gamePeriodScores = psData;

      this.isLoaded = true;
      console.log(`✅ [DataStore] Carga completada. ${this.players.length} jugadores, ${this.games.length} partidos, ${this.playerGameStats.length} registros estadísticos.`);
    } catch (err) {
      console.error("❌ [DataStore] Error cargando datos del equipo:", err);
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  // --- GESTIÓN DE EQUIPO Y TEMPORADA ACTIVA ---

  getActiveTeamId() {
    return localStorage.getItem("iq_active_team_id") || "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22";
  }

  getActiveSeason() {
    return localStorage.getItem("iq_active_season") || "2026";
  }

  /**
   * Resuelve el UUID real de la temporada activa evitando enviar nombres de texto al backend.
   */
  getActiveSeasonId() {
    const activeSeasonName = String(this.getActiveSeason()).trim().toLowerCase();
    
    // 1. Buscar coincidencia exacta por nombre en la lista de temporadas cargadas
    const matchedSeason = (this.seasons || []).find(s => {
      const sName = String(s.name || '').trim().toLowerCase();
      return sName === activeSeasonName || activeSeasonName.includes(sName) || sName.includes(activeSeasonName);
    });

    if (matchedSeason?.id && this.isValidUUID(matchedSeason.id)) {
      return matchedSeason.id;
    }

    // 2. Si hay temporadas en memoria, tomar la primera válida
    const firstValidSeason = (this.seasons || []).find(s => this.isValidUUID(s.id));
    if (firstValidSeason?.id) {
      return firstValidSeason.id;
    }

    // 3. Fallback a UUID constante de la base de datos
    return "d7a70e68-d3d1-4ae9-b590-3d3291bd8a4d";
  }

  isValidUUID(val) {
    if (!val || typeof val !== "string") return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
  }

  setActiveTeamAndSeason(teamId, season) {
    if (teamId) localStorage.setItem("iq_active_team_id", teamId);
    if (season) localStorage.setItem("iq_active_season", season);
    this.isLoaded = false;
  }

  // --- GETTERS ---

  getClubs() { 
    return this.clubs || []; 
  }

  getClubById(id) { 
    if (!id) return null;
    return (this.clubs || []).find(c => String(c.id).toLowerCase() === String(id).toLowerCase()) || null; 
  }

  getTeams() { 
    return (this.teams || []).map(t => {
      const parentClub = (this.clubs || []).find(c => 
        t.club_id && c.id && String(c.id).trim().toLowerCase() === String(t.club_id).trim().toLowerCase()
      );

      const assignedCoach = t.coach_name || (parentClub ? parentClub.coordinator_name : null) || "Por definir";

      return {
        ...t,
        clubName: parentClub ? parentClub.name : "JMJ Manyanet Sant Andreu",
        coach_name: assignedCoach,
        coach: assignedCoach
      };
    }); 
  }

  getTeamById(id) { 
    if (!id) return null;
    return (this.teams || []).find(t => String(t.id).toLowerCase() === String(id).toLowerCase()) || null; 
  }

  getPlayers() { 
    const activeTeamId = this.getActiveTeamId();
    return (this.players || []).filter(p => String(p.team_id) === String(activeTeamId)); 
  }

  getPlayerById(id) { 
    if (!id) return null;
    return (this.players || []).find(p => String(p.id) === String(id)) || null; 
  }

  getGames() { 
    const activeTeamId = this.getActiveTeamId();
    return (this.games || []).filter(g => String(g.team_id) === String(activeTeamId)); 
  }

  getGameById(id) { 
    if (!id) return null;
    return (this.games || []).find(g => String(g.id) === String(id)) || null; 
  }

  getPlayerGameStats(playerId = null, gameId = null) {
    return (this.playerGameStats || []).filter(s => {
      const matchP = playerId ? String(s.player_id) === String(playerId) : true;
      const matchG = gameId ? String(s.game_id) === String(gameId) : true;
      return matchP && matchG;
    });
  }

  getGamePeriodScores(gameId) {
    if (!gameId) return [];
    return (this.gamePeriodScores || [])
      .filter(p => String(p.game_id) === String(gameId))
      .sort((a, b) => {
        if (a.is_overtime !== b.is_overtime) return a.is_overtime ? 1 : -1;
        return (Number(a.period_number) || 0) - (Number(b.period_number) || 0);
      });
  }

  // --- OPERACIONES DE PERSISTENCIA ---

  async saveClub(clubData) {
    if (clubData.id) {
      const { data, error } = await supabase.from("clubs").update(clubData).eq("id", clubData.id).select().single();
      if (error) throw error;
      const idx = this.clubs.findIndex(c => String(c.id) === String(clubData.id));
      if (idx !== -1) this.clubs[idx] = data;
      return data;
    } else {
      const { data, error } = await supabase.from("clubs").insert([clubData]).select().single();
      if (error) throw error;
      this.clubs.push(data);
      return data;
    }
  }

  async saveTeam(teamData) {
    if (teamData.id) {
      const { data, error } = await supabase.from("teams").update(teamData).eq("id", teamData.id).select().single();
      if (error) throw error;
      const idx = this.teams.findIndex(t => String(t.id) === String(teamData.id));
      if (idx !== -1) this.teams[idx] = data;
      return data;
    } else {
      const { data, error } = await supabase.from("teams").insert([teamData]).select().single();
      if (error) throw error;
      this.teams.push(data);
      return data;
    }
  }

  async updatePlayer(playerId, updates) {
    const { data, error } = await supabase.from("players").update(updates).eq("id", playerId).select().single();
    if (error) {
      console.error("Error al actualizar jugador:", error);
      throw error;
    }
    const idx = this.players.findIndex(p => String(p.id) === String(playerId));
    if (idx !== -1) this.players[idx] = data;
    return data;
  }

  /**
   * Guarda o actualiza el partido, estadísticas en bloque y cuartos de forma atómica.
   * Evita errores de ON CONFLICT mediante delete + insert por lote.
   * @returns {Promise<string>} ID del partido guardado.
   */
  async saveGameAndStats(gameData, statsList = [], periodScoresList = []) {
    let savedGameId = gameData.id;

    // Normalizar season_id a UUID válido
    const payloadGame = { ...gameData };
    if (!this.isValidUUID(payloadGame.season_id)) {
      payloadGame.season_id = this.getActiveSeasonId();
    }

    try {
      // 1. Guardar o actualizar registro principal del partido
      if (savedGameId) {
        const { data, error } = await supabase.from("games").update(payloadGame).eq("id", savedGameId).select().single();
        if (error) throw error;
        const idx = this.games.findIndex(g => String(g.id) === String(savedGameId));
        if (idx !== -1) this.games[idx] = data;
      } else {
        const { data, error } = await supabase.from("games").insert([payloadGame]).select().single();
        if (error) throw error;
        savedGameId = data.id;
        this.games.unshift(data);
      }

      if (!savedGameId) {
        throw new Error("No se pudo obtener un ID válido para el partido guardado.");
      }

      // 2. Guardar estadísticas: Limpieza previa + inserción limpia por lotes
      if (statsList.length > 0) {
        const { error: delStatsErr } = await supabase.from("player_game_stats").delete().eq("game_id", savedGameId);
        if (delStatsErr) throw delStatsErr;

        this.playerGameStats = this.playerGameStats.filter(s => String(s.game_id) !== String(savedGameId));

        const preparedStats = statsList.map(st => ({
          game_id: savedGameId,
          player_id: st.player_id,
          minutes: Number(st.minutes || 0),
          points: (Number(st.fg2_made || 0) * 2) + (Number(st.fg3_made || 0) * 3) + Number(st.ft_made || 0),
          fg2_made: Number(st.fg2_made || 0),
          fg2_attempted: Number(st.fg2_attempted || 0),
          fg3_made: Number(st.fg3_made || 0),
          fg3_attempted: Number(st.fg3_attempted || 0),
          ft_made: Number(st.ft_made || 0),
          ft_attempted: Number(st.ft_attempted || 0),
          off_reb: Number(st.off_reb || 0),
          def_reb: Number(st.def_reb || 0),
          assists: Number(st.assists || 0),
          steals: Number(st.steals || 0),
          blocks_made: Number(st.blocks_made || st.blocks || 0),
          blocks_received: Number(st.blocks_received || 0),
          turnovers: Number(st.turnovers || 0),
          fouls_committed: Number(st.fouls_committed || 0),
          fouls_drawn: Number(st.fouls_drawn || st.fouls_received || 0),
          plus_minus: Number(st.plus_minus || 0)
        }));

        const { data: insertedStats, error: statsError } = await supabase
          .from("player_game_stats")
          .insert(preparedStats)
          .select();

        if (statsError) throw statsError;

        this.playerGameStats.push(...(insertedStats || preparedStats));
      }

      // 3. Desglose de periodos: Limpieza previa + inserción limpia por lotes
      if (periodScoresList.length > 0) {
        const { error: delPeriodsErr } = await supabase.from("game_period_scores").delete().eq("game_id", savedGameId);
        if (delPeriodsErr) throw delPeriodsErr;

        this.gamePeriodScores = this.gamePeriodScores.filter(p => String(p.game_id) !== String(savedGameId));

        const preparedPeriods = periodScoresList.map(p => ({
          game_id: savedGameId,
          period_type: p.period_type || (p.is_overtime ? "overtime" : "quarter"),
          period_number: Number(p.period_number),
          team_score: Number(p.team_score || 0),
          opponent_score: Number(p.opponent_score || 0),
          is_overtime: Boolean(p.is_overtime)
        }));

        const { data: insertedPeriods, error: insError } = await supabase
          .from("game_period_scores")
          .insert(preparedPeriods)
          .select();

        if (insError) throw insError;

        this.gamePeriodScores.push(...(insertedPeriods || preparedPeriods));
      }

      return savedGameId;
    } catch (err) {
      console.error("❌ [DataStore] Error en saveGameAndStats:", err);
      throw err;
    }
  }
}

export const DataStore = new DataStoreService();