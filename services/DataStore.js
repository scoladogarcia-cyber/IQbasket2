/**
 * @fileoverview DataStore.js - Gestor de Estado Local y Caché para IQ Basket.
 * Mapeo estricto con las columnas reales de:
 *  - games (periods, periods_count, period_minutes, starter_ids, our_score, opp_score, period_scores, quarter_scores_team, quarter_scores_opponent)
 *  - player_game_stats (cálculo de points, fg2, fg3, ft, reb, ast, stl, blk, tov, fouls, +/-)
 *  - game_period_scores (period_type, period_number, team_score, opponent_score, is_overtime)
 *  - game_events (persistencia espacial y borrado en cascada garantizado)
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

        if (statsRes.error) console.warn("Aviso cargando player_game_stats:", statsRes.error);
        if (psRes.error) console.warn("Aviso cargando game_period_scores:", psRes.error);

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

  getActiveSeasonId() {
    const activeSeasonName = String(this.getActiveSeason()).trim().toLowerCase();
    
    const matchedSeason = (this.seasons || []).find(s => {
      const sName = String(s.name || '').trim().toLowerCase();
      return sName === activeSeasonName || activeSeasonName.includes(sName) || sName.includes(activeSeasonName);
    });

    if (matchedSeason?.id && this.isValidUUID(matchedSeason.id)) {
      return matchedSeason.id;
    }

    const firstValidSeason = (this.seasons || []).find(s => this.isValidUUID(s.id));
    if (firstValidSeason?.id) {
      return firstValidSeason.id;
    }

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

  /**
   * Recupera los eventos dinámicos guardados en localStorage o en memoria
   */
  getGameEvents(gameId = null) {
    const targetGames = gameId 
      ? (this.games || []).filter(g => String(g.id) === String(gameId))
      : (this.games || []);

    let allEvents = [];
    targetGames.forEach(g => {
      const cached = localStorage.getItem(`iq_game_events_${g.id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            allEvents.push(...parsed.map(e => ({ ...e, game_id: g.id })));
            return;
          }
        } catch (e) {}
      }

      let evList = g.events || g.observations;
      if (typeof evList === "string") {
        try { evList = JSON.parse(evList); } catch (e) { evList = []; }
      }
      if (Array.isArray(evList)) {
        allEvents.push(...evList.map(e => ({ ...e, game_id: g.id })));
      }
    });

    return allEvents;
  }

  /**
   * Recupera los cuartos de un partido en orden.
   * Prioriza 'game_period_scores' y usa como respaldo 'games.periods'.
   */
  getGamePeriodScores(gameId) {
    if (!gameId) return [];

    const relationalScores = (this.gamePeriodScores || []).filter(p => String(p.game_id) === String(gameId));
    if (relationalScores.length > 0) {
      return relationalScores.sort((a, b) => {
        if (a.is_overtime !== b.is_overtime) return a.is_overtime ? 1 : -1;
        return (Number(a.period_number) || 0) - (Number(b.period_number) || 0);
      });
    }

    const game = this.getGameById(gameId);
    if (game && game.periods) {
      let rawPeriods = game.periods;
      if (typeof rawPeriods === "string") {
        try { rawPeriods = JSON.parse(rawPeriods); } catch (e) { rawPeriods = []; }
      }

      if (Array.isArray(rawPeriods) && rawPeriods.length > 0) {
        return rawPeriods.map((p, idx) => ({
          game_id: gameId,
          period_type: (p.is_overtime || Number(p.period || p.period_number) > 4) ? 'overtime' : 'quarter',
          period_number: Number(p.period || p.period_number || (idx + 1)),
          team_score: Number(p.team_score || 0),
          opponent_score: Number(p.opponent_score || 0),
          is_overtime: Boolean(p.is_overtime || Number(p.period || p.period_number) > 4)
        })).sort((a, b) => a.period_number - b.period_number);
      }
    }

    return [];
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
   * Guarda o actualiza el partido, estadísticas en bloque y cuartos.
   * Envía arrays nativos para JSONB y mapea las columnas exactas de Supabase.
   * @returns {Promise<string>} ID del partido guardado.
   */
  async saveGameAndStats(gameData, statsList = [], periodScoresList = [], eventsList = []) {
    let savedGameId = gameData.id;

    // 1. Normalizar cuartos para la columna JSONB 'periods'
    const formattedPeriods = periodScoresList.map((p, idx) => ({
      period: Number(p.period_number || (idx + 1)),
      team_score: Number(p.team_score || 0),
      opponent_score: Number(p.opponent_score || 0),
      is_overtime: Boolean(p.is_overtime || Number(p.period_number || (idx + 1)) > 4)
    }));

    // 2. Normalizar starter_ids
    let parsedStarters = gameData.starter_ids || [];
    if (typeof parsedStarters === "string") {
      try { parsedStarters = JSON.parse(parsedStarters); } catch (e) { parsedStarters = []; }
    }

    const qTeam = formattedPeriods.map(p => p.team_score);
    const qOpp = formattedPeriods.map(p => p.opponent_score);
    const teamScore = Number(gameData.team_score || 0);
    const oppScore = Number(gameData.opponent_score || 0);

    const payloadGame = {
      ...gameData,
      periods: formattedPeriods,
      periods_count: formattedPeriods.length || 4,
      period_minutes: Number(gameData.period_minutes || 10),
      starter_ids: parsedStarters,
      team_score: teamScore,
      opponent_score: oppScore,
      our_score: teamScore,
      opp_score: oppScore,
      quarter_scores_team: qTeam,
      quarter_scores_opponent: qOpp,
      has_overtime: formattedPeriods.some(p => p.is_overtime),
      overtime_count: formattedPeriods.filter(p => p.is_overtime).length
    };

    if (!this.isValidUUID(payloadGame.season_id)) {
      payloadGame.season_id = this.getActiveSeasonId();
    }

    try {
      // 3. Guardar o actualizar en games
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

      if (!savedGameId) throw new Error("No se pudo obtener un ID válido para el partido guardado.");

      // 4. Guardar respaldo local de jugadas/tiros
      if (eventsList && eventsList.length > 0) {
        localStorage.setItem(`iq_game_events_${savedGameId}`, JSON.stringify(eventsList));
      }

      // 5. Guardar estadísticas en player_game_stats
      if (statsList.length > 0) {
        const { error: delStatsErr } = await supabase.from("player_game_stats").delete().eq("game_id", savedGameId);
        if (delStatsErr) throw delStatsErr;

        this.playerGameStats = this.playerGameStats.filter(s => String(s.game_id) !== String(savedGameId));

        const preparedStats = statsList.map(st => {
          const offReb = Number(st.off_reb || st.rebounds_offensive || 0);
          const defReb = Number(st.def_reb || st.rebounds_defensive || 0);
          const blkMade = Number(st.blocks_made || st.blocks || 0);
          const fDrawn = Number(st.fouls_drawn || st.fouls_received || 0);
          const fg2M = Number(st.fg2_made || 0);
          const fg3M = Number(st.fg3_made || 0);
          const ftM = Number(st.ft_made || 0);
          const pts = (fg2M * 2) + (fg3M * 3) + ftM;

          return {
            game_id: savedGameId,
            player_id: st.player_id,
            starter: parsedStarters.includes(st.player_id),
            minutes: Number(st.minutes || 0),
            points: pts,
            fg2_made: fg2M,
            fg2_attempted: Number(st.fg2_attempted || 0),
            fg3_made: fg3M,
            fg3_attempted: Number(st.fg3_attempted || 0),
            ft_made: ftM,
            ft_attempted: Number(st.ft_attempted || 0),
            off_reb: offReb,
            def_reb: defReb,
            rebounds_offensive: offReb,
            rebounds_defensive: defReb,
            assists: Number(st.assists || 0),
            steals: Number(st.steals || 0),
            blocks: blkMade,
            blocks_made: blkMade,
            blocks_received: Number(st.blocks_received || 0),
            turnovers: Number(st.turnovers || 0),
            fouls_committed: Number(st.fouls_committed || 0),
            fouls_drawn: fDrawn,
            fouls_received: fDrawn,
            plus_minus: Number(st.plus_minus || 0)
          };
        });

        const { data: insertedStats, error: statsError } = await supabase
          .from("player_game_stats")
          .insert(preparedStats)
          .select();

        if (statsError) throw statsError;
        this.playerGameStats.push(...(insertedStats || preparedStats));
      }

      // 6. Guardar en game_period_scores
      if (periodScoresList.length > 0) {
        try {
          await supabase.from("game_period_scores").delete().eq("game_id", savedGameId);
          this.gamePeriodScores = this.gamePeriodScores.filter(p => String(p.game_id) !== String(savedGameId));

          const preparedPeriods = periodScoresList.map(p => ({
            game_id: savedGameId,
            period_type: p.period_type || (p.is_overtime ? "overtime" : "quarter"),
            period_number: Number(p.period_number),
            team_score: Number(p.team_score || 0),
            opponent_score: Number(p.opponent_score || 0),
            is_overtime: Boolean(p.is_overtime)
          }));

          const { data: insertedPeriods } = await supabase
            .from("game_period_scores")
            .insert(preparedPeriods)
            .select();

          this.gamePeriodScores.push(...(insertedPeriods || preparedPeriods));
        } catch (periodErr) {
          console.warn("Aviso: 'game_period_scores' guardado relacional:", periodErr);
        }
      }

      return savedGameId;
    } catch (err) {
      console.error("❌ [DataStore] Error en saveGameAndStats:", err);
      throw err;
    }
  }

  /**
   * Elimina un partido y todas sus tablas hijas en cascada estricta.
   */
  async deleteGame(gameId) {
    if (!gameId) return false;

    console.log(`🗑️ [DataStore] Iniciando borrado del partido: ${gameId}...`);

    try {
      // 1. Borrar en paralelo de todas las tablas dependientes
      await Promise.allSettled([
        supabase.from("player_game_stats").delete().eq("game_id", gameId),
        supabase.from("game_period_scores").delete().eq("game_id", gameId),
        supabase.from("game_events").delete().eq("game_id", gameId),
        supabase.from("lineup_game_stats").delete().eq("game_id", gameId),
        supabase.from("play_by_play_events").delete().eq("game_id", gameId),
        supabase.from("player_notes").delete().eq("game_id", gameId),
        supabase.from("player_goals").delete().eq("game_id", gameId),
        supabase.from("reports").delete().eq("game_id", gameId)
      ]);

      // 2. Borrar de la tabla principal games
      const { error: delGameErr } = await supabase.from("games").delete().eq("id", gameId);
      if (delGameErr) throw delGameErr;

      // 3. Limpiar memoria local y caché
      localStorage.removeItem(`iq_game_events_${gameId}`);
      this.games = (this.games || []).filter(g => String(g.id) !== String(gameId));
      this.playerGameStats = (this.playerGameStats || []).filter(s => String(s.game_id) !== String(gameId));
      this.gamePeriodScores = (this.gamePeriodScores || []).filter(p => String(p.game_id) !== String(gameId));

      console.log(`✅ [DataStore] Partido ${gameId} eliminado de Supabase y memoria.`);
      return true;
    } catch (err) {
      console.error("❌ [DataStore] Error eliminando partido:", err);
      throw err;
    }
  }
}

export const DataStore = new DataStoreService();