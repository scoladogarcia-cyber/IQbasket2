/**
 * @fileoverview Gestor Central de Estado Local, Caché y Sincronización: DataStore.js
 * @description Almacén reactivo en memoria con persistencia en LocalStorage y Supabase.
 * Normaliza automáticamente todas las propiedades en snake_case y camelCase para total compatibilidad.
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
    this.gameEvents = [];
    this.listeners = new Set();
    this.isLoaded = false;
    this.isLoading = false;
  }

  // =========================================================================
  // 1. NORMALIZACIÓN DE ENTIDADES
  // =========================================================================

  _normalizeTeam(t) {
    if (!t) return t;
    return {
      ...t,
      id: String(t.id),
      club_id: t.club_id || t.clubId || null,
      clubId: t.club_id || t.clubId || null,
      name: t.name || "JMJ Manyanet Sant Andreu",
      category: t.category || "Sénior Masculino",
      competition: t.competition || "B1",
      coach_name: t.coach_name || t.coachName || t.coach || "Por definir",
      coachName: t.coach_name || t.coachName || t.coach || "Por definir",
      coach: t.coach_name || t.coachName || t.coach || "Por definir",
      color: t.color || "#1e3a8a"
    };
  }

  _normalizePlayer(p) {
    if (!p) return p;
    const fName = p.first_name || p.firstName || "";
    const lName = p.last_name || p.lastName || "";
    const jersey = p.jersey !== undefined && p.jersey !== null ? String(p.jersey) : (p.number || "?");
    const pos = p.primary_position || p.primaryPosition || p.position || "Alero";

    return {
      ...p,
      id: String(p.id),
      team_id: p.team_id || p.teamId || null,
      teamId: p.team_id || p.teamId || null,
      first_name: fName,
      firstName: fName,
      last_name: lName,
      lastName: lName,
      name: `${fName} ${lName}`.trim() || p.name || `Jugador #${jersey}`,
      jersey: jersey,
      number: jersey,
      primary_position: pos,
      primaryPosition: pos,
      position: pos,
      height: p.height || p.height_cm || "1.88 m",
      status: p.status || "Activo"
    };
  }

  _normalizeGame(g) {
    if (!g) return g;
    const teamScore = Number(g.team_score ?? g.teamScore ?? g.our_score ?? g.points ?? 0);
    const oppScore = Number(g.opponent_score ?? g.opponentScore ?? g.opp_score ?? g.opp_points ?? 0);
    const oppName = g.opponent || g.opponent_name || g.opponentName || "Rival";

    return {
      ...g,
      id: String(g.id),
      team_id: g.team_id || g.teamId || null,
      teamId: g.team_id || g.teamId || null,
      season_id: g.season_id || g.seasonId || null,
      seasonId: g.season_id || g.seasonId || null,
      opponent: oppName,
      opponent_name: oppName,
      opponentName: oppName,
      team_score: teamScore,
      teamScore: teamScore,
      our_score: teamScore,
      opponent_score: oppScore,
      opponentScore: oppScore,
      opp_score: oppScore,
      date: g.date || "",
      venue: g.venue || "Local",
      status: g.status || "completed"
    };
  }

  _normalizeStat(s) {
    if (!s) return s;
    const fg2m = Number(s.fg2_made ?? s.fg2Made ?? s.points_2_made ?? 0);
    const fg2a = Number(s.fg2_attempted ?? s.fg2Attempted ?? s.points_2_attempted ?? 0);
    const fg3m = Number(s.fg3_made ?? s.fg3Made ?? s.points_3_made ?? 0);
    const fg3a = Number(s.fg3_attempted ?? s.fg3Attempted ?? s.points_3_attempted ?? 0);
    const ftm = Number(s.ft_made ?? s.ftMade ?? s.free_throws_made ?? 0);
    const fta = Number(s.ft_attempted ?? s.ftAttempted ?? s.free_throws_attempted ?? 0);
    const oreb = Number(s.off_reb ?? s.offReb ?? s.rebounds_offensive ?? 0);
    const dreb = Number(s.def_reb ?? s.defReb ?? s.rebounds_defensive ?? 0);
    const reb = Number(s.rebounds ?? (oreb + dreb));
    const ast = Number(s.assists ?? s.ast ?? 0);
    const stl = Number(s.steals ?? s.stl ?? 0);
    const blk = Number(s.blocks ?? s.blocks_made ?? s.blocksMade ?? 0);
    const tov = Number(s.turnovers ?? s.tov ?? 0);
    const fouls = Number(s.fouls_committed ?? s.foulsCommitted ?? s.fouls ?? 0);
    const foulsDrawn = Number(s.fouls_drawn ?? s.foulsDrawn ?? s.fouls_received ?? 0);
    
    const points = (s.points !== undefined && s.points !== null && Number(s.points) > 0)
      ? Number(s.points)
      : (fg2m * 2 + fg3m * 3 + ftm);

    const fga = fg2a + fg3a;
    const fgm = fg2m + fg3m;
    const missedFg = Math.max(0, fga - fgm);
    const missedFt = Math.max(0, fta - ftm);
    const val = (points + reb + ast + stl + blk + foulsDrawn) - (missedFg + missedFt + tov + fouls);

    return {
      ...s,
      game_id: String(s.game_id || s.gameId),
      gameId: String(s.game_id || s.gameId),
      player_id: String(s.player_id || s.playerId),
      playerId: String(s.player_id || s.playerId),
      minutes: Number(s.minutes ?? s.minutesPlayed ?? 0),
      minutesPlayed: Number(s.minutes ?? s.minutesPlayed ?? 0),
      points,
      fg2_made: fg2m,
      fg2Made: fg2m,
      fg2_attempted: fg2a,
      fg2Attempted: fg2a,
      fg3_made: fg3m,
      fg3Made: fg3m,
      fg3_attempted: fg3a,
      fg3Attempted: fg3a,
      ft_made: ftm,
      ftMade: ftm,
      ft_attempted: fta,
      ftAttempted: fta,
      off_reb: oreb,
      offReb: oreb,
      def_reb: dreb,
      defReb: dreb,
      rebounds: reb,
      assists: ast,
      ast,
      steals: stl,
      stl,
      blocks: blk,
      turnovers: tov,
      tov,
      fouls_committed: fouls,
      fouls,
      fouls_drawn: foulsDrawn,
      foulsDrawn,
      evaluation: Number(s.evaluation ?? val),
      val: Number(s.evaluation ?? val),
      pir: Number(s.evaluation ?? val)
    };
  }

  // =========================================================================
  // 2. INICIALIZACIÓN ROBUSTA Y AUTO-DETECCIÓN DE EQUIPO ACTIVO
  // =========================================================================

  async init(teamId = null, forceRefresh = false) {
    if (this.isLoaded && !forceRefresh) return;
    if (this.isLoading) return;

    this.isLoading = true;

    try {
      if (typeof localStorage !== "undefined") {
        const cTeams = localStorage.getItem("iq_cache_teams");
        const cPlayers = localStorage.getItem("iq_cache_players");
        const cGames = localStorage.getItem("iq_cache_games");
        const cStats = localStorage.getItem("iq_cache_stats");
        const cPeriods = localStorage.getItem("iq_cache_periods");

        if (cTeams) this.teams = JSON.parse(cTeams).map(t => this._normalizeTeam(t));
        if (cPlayers) this.players = JSON.parse(cPlayers).map(p => this._normalizePlayer(p));
        if (cGames) this.games = JSON.parse(cGames).map(g => this._normalizeGame(g));
        if (cStats) this.playerGameStats = JSON.parse(cStats).map(s => this._normalizeStat(s));
        if (cPeriods) this.gamePeriodScores = JSON.parse(cPeriods);
      }

      if (supabase) {
        const [cRes, tRes, pRes, gRes, sRes, statsRes, psRes] = await Promise.all([
          supabase.from("clubs").select("*"),
          supabase.from("teams").select("*"),
          supabase.from("players").select("*"),
          supabase.from("games").select("*").order("date", { ascending: false }),
          supabase.from("seasons").select("*").order("created_at", { ascending: false }),
          supabase.from("player_game_stats").select("*"),
          supabase.from("game_period_scores").select("*")
        ]);

        if (cRes.data) this.clubs = cRes.data;
        if (tRes.data && tRes.data.length > 0) this.teams = tRes.data.map(t => this._normalizeTeam(t));
        if (pRes.data && pRes.data.length > 0) this.players = pRes.data.map(p => this._normalizePlayer(p));
        if (gRes.data && gRes.data.length > 0) this.games = gRes.data.map(g => this._normalizeGame(g));
        if (sRes.data) this.seasons = sRes.data;
        if (statsRes.data && statsRes.data.length > 0) this.playerGameStats = statsRes.data.map(s => this._normalizeStat(s));
        if (psRes.data && psRes.data.length > 0) this.gamePeriodScores = psRes.data;

        // Auto-detección: si el ID activo no tiene partidos ni jugadores, fijar el que sí los tiene
        const currentActive = this.getActiveTeamId();
        const hasData = this.games.some(g => String(g.team_id).toLowerCase() === String(currentActive).toLowerCase());
        
        if (!hasData && this.games.length > 0 && this.games[0].team_id) {
          this.setActiveTeamAndSeason(this.games[0].team_id, this.getActiveSeason());
        } else if (!hasData && this.players.length > 0 && this.players[0].team_id) {
          this.setActiveTeamAndSeason(this.players[0].team_id, this.getActiveSeason());
        }

        if (typeof localStorage !== "undefined") {
          localStorage.setItem("iq_cache_teams", JSON.stringify(this.teams));
          localStorage.setItem("iq_cache_players", JSON.stringify(this.players));
          localStorage.setItem("iq_cache_games", JSON.stringify(this.games));
          localStorage.setItem("iq_cache_stats", JSON.stringify(this.playerGameStats));
          localStorage.setItem("iq_cache_periods", JSON.stringify(this.gamePeriodScores));
        }
      }
    } catch (err) {
      console.warn("[DataStore] Inicialización local:", err.message);
    } finally {
      this.isLoaded = true;
      this.isLoading = false;
      this._notifyListeners();
    }
  }

  // =========================================================================
  // 3. SESIÓN, EQUIPO Y TEMPORADA ACTIVA
  // =========================================================================

  getActiveTeamId() {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("iq_active_team_id");
      if (stored) return stored;
    }
    if (this.teams.length > 0) return String(this.teams[0].id);
    if (this.games.length > 0 && this.games[0].team_id) return String(this.games[0].team_id);
    if (this.players.length > 0 && this.players[0].team_id) return String(this.players[0].team_id);
    return "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22";
  }

  getActiveSeason() {
    return localStorage.getItem("iq_active_season") || "2026";
  }

  getActiveSeasonId() {
    const activeSeasonName = String(this.getActiveSeason()).trim().toLowerCase();
    const matchedSeason = (this.seasons || []).find((s) => {
      const sName = String(s.name || "").trim().toLowerCase();
      return sName === activeSeasonName || activeSeasonName.includes(sName);
    });
    return matchedSeason ? matchedSeason.id : "d7a70e68-d3d1-4ae9-b590-3d3291bd8a4d";
  }

  setActiveTeamAndSeason(teamId, season) {
    if (typeof localStorage !== "undefined") {
      if (teamId) localStorage.setItem("iq_active_team_id", teamId);
      if (season) localStorage.setItem("iq_active_season", season);
    }
    this._notifyListeners();
  }

  // =========================================================================
  // 4. GETTERS Y SELECTORES DE DOMINIO
  // =========================================================================

  getClubs() {
    return this.clubs || [];
  }

  getClubById(id) {
    if (!id) return null;
    return (this.clubs || []).find((c) => String(c.id).toLowerCase() === String(id).toLowerCase()) || null;
  }

  getTeams() {
    if (!this.teams || this.teams.length === 0) {
      return [{
        id: this.getActiveTeamId(),
        name: "JMJ Manyanet Sant Andreu",
        category: "Sénior Masculino",
        competition: "B1",
        coachName: "Por definir",
        color: "#1e3a8a"
      }];
    }
    return this.teams;
  }

  getTeamById(id) {
    const targetId = String(id || this.getActiveTeamId()).toLowerCase();
    return this.getTeams().find(t => String(t.id).toLowerCase() === targetId) || this.getTeams()[0];
  }

  getPlayers(teamId = null) {
    const all = this.players || [];
    if (all.length === 0) return [];
    const targetTeamId = String(teamId || this.getActiveTeamId()).toLowerCase();

    const filtered = all.filter((p) => String(p.team_id || "").toLowerCase() === targetTeamId);
    const result = filtered.length > 0 ? filtered : all;
    return [...result].sort((a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0));
  }

  getPlayerById(id) {
    if (!id) return null;
    return (this.players || []).find((p) => String(p.id) === String(id)) || null;
  }

  getGames(teamId = null) {
    const all = this.games || [];
    if (all.length === 0) return [];
    const targetTeamId = String(teamId || this.getActiveTeamId()).toLowerCase();

    const filtered = all.filter((g) => String(g.team_id || "").toLowerCase() === targetTeamId);
    const result = filtered.length > 0 ? filtered : all;
    return [...result].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  getGameById(id) {
    if (!id) return null;
    return (this.games || []).find((g) => String(g.id) === String(id)) || null;
  }

  getPlayerGameStats(playerId = null, gameId = null) {
    let list = this.playerGameStats || [];
    if (playerId) {
      list = list.filter((s) => String(s.player_id || s.playerId) === String(playerId));
    }
    if (gameId) {
      list = list.filter((s) => String(s.game_id || s.gameId) === String(gameId));
    }
    return list;
  }

  getGamePeriodScores(gameId) {
    if (!gameId) return [];
    return (this.gamePeriodScores || [])
      .filter((p) => String(p.game_id || p.gameId) === String(gameId))
      .sort((a, b) => Number(a.period_number) - Number(b.period_number));
  }

  getGameEvents(gameId = null) {
    if (!gameId) return this.gameEvents || [];
    return (this.gameEvents || []).filter((e) => String(e.game_id || e.gameId) === String(gameId));
  }

  // =========================================================================
  // 5. GUARDADO Y PERSISTENCIA ATÓMICA
  // =========================================================================

  async saveGameAndStats(gameData, statsList = [], periodScores = [], liveEvents = []) {
    const gId = gameData.id || "g-" + Date.now();
    const normalizedGame = this._normalizeGame({ ...gameData, id: gId });

    const gIdx = this.games.findIndex((g) => String(g.id) === String(gId));
    if (gIdx >= 0) this.games[gIdx] = normalizedGame;
    else this.games.unshift(normalizedGame);

    if (statsList.length > 0) {
      this.playerGameStats = this.playerGameStats.filter((s) => String(s.game_id || s.gameId) !== String(gId));
      const formattedStats = statsList.map((st) => this._normalizeStat({ ...st, game_id: gId }));
      this.playerGameStats.push(...formattedStats);
    }

    if (periodScores.length > 0) {
      this.gamePeriodScores = this.gamePeriodScores.filter((p) => String(p.game_id || p.gameId) !== String(gId));
      const formattedPeriods = periodScores.map((p) => ({ ...p, game_id: gId }));
      this.gamePeriodScores.push(...formattedPeriods);
    }

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("iq_cache_games", JSON.stringify(this.games));
      localStorage.setItem("iq_cache_stats", JSON.stringify(this.playerGameStats));
      localStorage.setItem("iq_cache_periods", JSON.stringify(this.gamePeriodScores));
    }

    if (supabase) {
      try {
        await supabase.from("games").upsert([normalizedGame]);
        if (statsList.length > 0) {
          const dbStats = statsList.map((st) => this._normalizeStat({ ...st, game_id: gId }));
          await supabase.from("player_game_stats").upsert(dbStats, { onConflict: "game_id,player_id" });
        }
      } catch (err) {
        console.warn("[DataStore] Guardado en segundo plano:", err.message);
      }
    }

    this._notifyListeners();
    return gId;
  }

  async deleteGame(gameId) {
    if (!gameId) return false;
    this.games = this.games.filter((g) => String(g.id) !== String(gameId));
    this.playerGameStats = this.playerGameStats.filter((s) => String(s.game_id || s.gameId) !== String(gameId));
    this.gamePeriodScores = this.gamePeriodScores.filter((p) => String(p.game_id || p.gameId) !== String(gameId));

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("iq_cache_games", JSON.stringify(this.games));
      localStorage.setItem("iq_cache_stats", JSON.stringify(this.playerGameStats));
    }

    if (supabase) {
      try {
        await Promise.allSettled([
          supabase.from("games").delete().eq("id", gameId),
          supabase.from("player_game_stats").delete().eq("game_id", gameId),
          supabase.from("game_period_scores").delete().eq("game_id", gameId)
        ]);
      } catch (err) {
        console.warn("[DataStore] Error en borrado remoto:", err.message);
      }
    }

    this._notifyListeners();
    return true;
  }

  async updatePlayer(playerId, updates) {
    const idx = this.players.findIndex((p) => String(p.id) === String(playerId));
    if (idx >= 0) {
      this.players[idx] = this._normalizePlayer({ ...this.players[idx], ...updates });
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("iq_cache_players", JSON.stringify(this.players));
      }
    }
    if (supabase) {
      try {
        await supabase.from("players").update(updates).eq("id", playerId);
      } catch (err) {
        console.warn("[DataStore] Error actualizando jugador en remoto:", err.message);
      }
    }
    this._notifyListeners();
  }

  subscribe(listener) {
    if (typeof listener === "function") {
      this.listeners.add(listener);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  _notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this);
      } catch (err) {
        console.error("[DataStore] Error en listener:", err);
      }
    });
  }
}

export const DataStore = new DataStoreService();
export default DataStore;