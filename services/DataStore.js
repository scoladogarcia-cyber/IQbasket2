/**
 * @fileoverview DataStore.js - Gestor de Estado Local y Caché para IQ Basket.
 * Resuelve la recuperación de datos al alternar entre múltiples equipos sin necesidad de reiniciar la app.
 */

import { supabase } from "../config/database.config.js";

class DataStoreService {
  constructor() {
    this.clubs = [];
    this.teams = [];
    this.players = [];
    this.games = [];
    this.playerGameStats = [];
    this.gamePeriodScores = [];
    this.isLoaded = false;
    this.isLoading = false;
  }

  /**
   * Carga los datos del equipo activo. Si se cambia de equipo (forceRefresh = true),
   * vacía la caché antigua y consulta Supabase para recuperar la plantilla y partidos del nuevo equipo.
   */
  async init(teamId, forceRefresh = false) {
    const activeTeamId = teamId || this.getActiveTeamId();

    if (this.isLoaded && !forceRefresh) return;
    if (this.isLoading) return;

    this.isLoading = true;
    console.log(`⚡ [DataStore] Carga limpia para equipo: ${activeTeamId}...`);

    try {
      // 1. Limpieza de caché local para evitar contaminación de datos entre equipos
      this.players = [];
      this.games = [];
      this.playerGameStats = [];
      this.gamePeriodScores = [];

      // 2. Consulta paralela a Supabase para el team_id solicitado
      const [cRes, tRes, pRes, gRes, sRes, psRes] = await Promise.all([
        supabase.from("clubs").select("*"),
        supabase.from("teams").select("*"),
        supabase.from("players").select("*").eq("team_id", activeTeamId),
        supabase.from("games").select("*").eq("team_id", activeTeamId).order("date", { ascending: false }),
        supabase.from("player_game_stats").select("*"),
        supabase.from("game_period_scores").select("*")
      ]);

      this.clubs = cRes.data || [];
      this.teams = tRes.data || [];
      this.players = pRes.data || [];
      this.games = gRes.data || [];
      this.playerGameStats = sRes.data || [];
      this.gamePeriodScores = psRes.data || [];

      this.isLoaded = true;
      console.log(`✅ [DataStore] Carga completada. ${this.players.length} jugadores y ${this.games.length} partidos recuperados.`);
    } catch (err) {
      console.error("❌ [DataStore] Error cargando datos del equipo:", err);
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

  setActiveTeamAndSeason(teamId, season) {
    if (teamId) localStorage.setItem("iq_active_team_id", teamId);
    if (season) localStorage.setItem("iq_active_season", season);
    
    // Reset de seguridad para garantizar que el siguiente init() reconsulte Supabase
    this.isLoaded = false;
  }

  // --- GETTERS ULTRARRÁPIDOS ---

  getClubs() { 
    return this.clubs || []; 
  }

  getClubById(id) { 
    if (!id) return null;
    return (this.clubs || []).find(c => String(c.id).toLowerCase() === String(id).toLowerCase()); 
  }

  getTeams() { 
    return (this.teams || []).map(t => {
      const parentClub = (this.clubs || []).find(c => 
        t.club_id && c.id && String(c.id).trim().toLowerCase() === String(t.club_id).trim().toLowerCase()
      );

      const assignedCoach = t.coach_name || (parentClub ? parentClub.coordinator_name : null) || 'Por definir';

      return {
        ...t,
        clubName: parentClub ? parentClub.name : 'JMJ Manyanet Sant Andreu',
        coach_name: assignedCoach,
        coach: assignedCoach
      };
    }); 
  }

  getTeamById(id) { 
    if (!id) return null;
    return (this.teams || []).find(t => String(t.id).toLowerCase() === String(id).toLowerCase()); 
  }

  getPlayers() { 
    const activeTeamId = this.getActiveTeamId();
    return (this.players || []).filter(p => String(p.team_id) === String(activeTeamId)); 
  }

  getPlayerById(id) { 
    return (this.players || []).find(p => String(p.id) === String(id)); 
  }

  getGames() { 
    const activeTeamId = this.getActiveTeamId();
    const activeSeason = this.getActiveSeason();

    return (this.games || []).filter(g => 
      String(g.team_id) === String(activeTeamId) && 
      (g.season ? String(g.season) === String(activeSeason) : true)
    ); 
  }

  getGameById(id) { 
    return (this.games || []).find(g => String(g.id) === String(id)); 
  }

  getPlayerGameStats(playerId = null, gameId = null) {
    return (this.playerGameStats || []).filter(s => {
      const matchP = playerId ? String(s.player_id) === String(playerId) : true;
      const matchG = gameId ? String(s.game_id) === String(gameId) : true;
      return matchP && matchG;
    });
  }

  getGamePeriodScores(gameId) {
    return (this.gamePeriodScores || [])
      .filter(p => String(p.game_id) === String(gameId))
      .sort((a, b) => {
        if (a.is_overtime !== b.is_overtime) return a.is_overtime ? 1 : -1;
        return a.period_number - b.period_number;
      });
  }

  // --- OPERACIONES DE PERSISTENCIA ---

  async saveClub(clubData) {
    if (clubData.id) {
      const { error } = await supabase.from("clubs").update(clubData).eq("id", clubData.id);
      if (!error) {
        const idx = this.clubs.findIndex(c => String(c.id) === String(clubData.id));
        if (idx !== -1) this.clubs[idx] = { ...this.clubs[idx], ...clubData };
      }
    } else {
      const { data, error } = await supabase.from("clubs").insert([clubData]).select().single();
      if (data && !error) {
        this.clubs.push(data);
      }
    }
  }

  async saveTeam(teamData) {
    if (teamData.id) {
      const { error } = await supabase.from("teams").update(teamData).eq("id", teamData.id);
      if (!error) {
        const idx = this.teams.findIndex(t => String(t.id) === String(teamData.id));
        if (idx !== -1) this.teams[idx] = { ...this.teams[idx], ...teamData };
      }
    } else {
      const { data, error } = await supabase.from("teams").insert([teamData]).select().single();
      if (data && !error) {
        this.teams.push(data);
      }
    }
  }

  async updatePlayer(playerId, updates) {
    const idx = this.players.findIndex(p => String(p.id) === String(playerId));
    if (idx !== -1) {
      this.players[idx] = { ...this.players[idx], ...updates };
    }

    const { error } = await supabase.from("players").update(updates).eq("id", playerId);
    if (error) console.error("Error al hacer push de jugador:", error);
  }

  async saveGameAndStats(gameData, statsList, periodScoresList) {
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

    for (const st of statsList) {
      const payload = { ...st, game_id: savedGameId };
      await supabase.from("player_game_stats").upsert(payload, { onConflict: "game_id,player_id" });

      const sIdx = this.playerGameStats.findIndex(
        s => String(s.game_id) === String(savedGameId) && String(s.player_id) === String(st.player_id)
      );
      if (sIdx !== -1) {
        this.playerGameStats[sIdx] = { ...this.playerGameStats[sIdx], ...payload };
      } else {
        this.playerGameStats.push(payload);
      }
    }

    if (periodScoresList) {
      await supabase.from("game_period_scores").delete().eq("game_id", savedGameId);
      this.gamePeriodScores = this.gamePeriodScores.filter(p => String(p.game_id) !== String(savedGameId));

      const preparedPeriods = periodScoresList.map(p => ({
        game_id: savedGameId,
        period_type: p.period_type || (p.is_overtime ? 'overtime' : 'quarter'),
        period_number: p.period_number,
        team_score: Number(p.team_score || 0),
        opponent_score: Number(p.opponent_score || 0),
        is_overtime: Boolean(p.is_overtime)
      }));

      const { data: insertedPeriods } = await supabase
        .from("game_period_scores")
        .insert(preparedPeriods)
        .select();

      if (insertedPeriods) {
        this.gamePeriodScores.push(...insertedPeriods);
      } else {
        this.gamePeriodScores.push(...preparedPeriods);
      }
    }
  }
}

export const DataStore = new DataStoreService();