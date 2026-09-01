/**
 * @fileoverview Gestor Central de Estado Local, Caché y Sincronización: DataStore.js
 * @description Almacén reactivo en memoria con persistencia en LocalStorage y Supabase.
 * Normaliza automáticamente todas las propiedades en snake_case y camelCase para total compatibilidad.
 */

import { supabase } from "../config/database.config.js";
import { SupabaseAdapter } from "../core-modules/database-adapter/SupabaseAdapter.js";
import { SeasonContextService } from "./context/SeasonContextService.js";
import { Permission, UserRole } from "../security/PermissionService.js";

class DataStoreService {
  constructor() {
    this.clubs = [];
    this.teams = [];
    this.players = [];
    this.games = [];
    this.seasons = [];
    this.legacySeasons = [];
    this.staffAssignments = [];
    this.playerGameStats = [];
    this.gamePeriodScores = [];
    this.gameEvents = [];
    // IDs de partidos cuyos eventos ya se han consultado en esta sesión.
    // Evita descargar game_events en cada arranque o render.
    this.loadedGameEventIds = new Set();
    this.listeners = new Set();
    this.isLoaded = false;
    this.isLoading = false;
    this.permissionService = null;
    this.seasonContextService = supabase
      ? new SeasonContextService(new SupabaseAdapter(supabase))
      : null;
  }

  setPermissionService(permissionService) {
    this.permissionService = permissionService || null;
  }

  _assertPermission(permissionKey, context = {}, message = "Acceso denegado.") {
    if (!this.permissionService) {
      throw new Error("Seguridad no inicializada: no se permite escribir datos.");
    }
    if (!this.permissionService.can(permissionKey, context)) {
      throw new Error(message);
    }
  }

  _filterAuthorizedData() {
    const auth = this.permissionService;
    if (!auth || auth.getAuthenticatedRole() === UserRole.SUPERADMIN) return;

    const user = auth.getCurrentUser();
    auth.setTeamCatalog?.(this.teams || []);
    const allowedTeamIds = new Set((user?.allowedTeamIds || []).map(String));
    const linkedPlayerIds = new Set((user?.linkedPlayerIds || []).map(String));

    this.teams = (this.teams || []).filter(t => auth.canAccessTeam(String(t.id)));

    const visiblePlayerIds = new Set();
    this.players = (this.players || []).filter(p => {
      const teamAllowed = auth.canAccessTeam(String(p.team_id || p.teamId || ""));
      const isOwn = user?.playerId && String(user.playerId) === String(p.id);
      const isLinked = linkedPlayerIds.has(String(p.id));
      const visible = teamAllowed || isOwn || isLinked;
      if (visible) visiblePlayerIds.add(String(p.id));
      return visible;
    });

    const visibleGameIds = new Set();
    this.games = (this.games || []).filter(g => {
      const visible = auth.canAccessTeam(String(g.team_id || g.teamId || ""));
      if (visible) visibleGameIds.add(String(g.id));
      return visible;
    });

    this.playerGameStats = (this.playerGameStats || []).filter(s =>
      visibleGameIds.has(String(s.game_id || s.gameId || "")) ||
      visiblePlayerIds.has(String(s.player_id || s.playerId || ""))
    );
    this.gamePeriodScores = (this.gamePeriodScores || []).filter(p =>
      visibleGameIds.has(String(p.game_id || p.gameId || ""))
    );
    this.gameEvents = (this.gameEvents || []).filter(e =>
      visibleGameIds.has(String(e.game_id || e.gameId || ""))
    );

    this.staffAssignments = (this.staffAssignments || []).filter(a => {
      const teamId = String(a.team_id || a.teamId || "");
      const clubId = String(a.club_id || a.clubId || "");
      return (teamId && auth.canAccessTeam(teamId))
        || (user?.clubId && clubId === String(user.clubId));
    });

    if (user?.clubId) {
      this.clubs = (this.clubs || []).filter(c => String(c.id) === String(user.clubId));
    } else {
      const visibleClubIds = new Set(this.teams.map(t => String(t.club_id || t.clubId || "")));
      this.clubs = (this.clubs || []).filter(c => visibleClubIds.has(String(c.id)));
    }
  }

  _generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
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
      name: t.name || "Equipo",
      category: t.category || "General",
      competition: t.competition || "Liga",
      coach_name: t.coach_name || t.coachName || t.coach || "Por definir",
      coachName: t.coach_name || t.coachName || t.coach || "Por definir",
      coach: t.coach_name || t.coachName || t.coach || "Por definir",
      color: t.color || "#1e3a8a"
    };
  }

  _normalizeStaffAssignment(a) {
    if (!a) return a;
    return {
      ...a,
      id: String(a.id),
      club_id: a.club_id || a.clubId || null,
      clubId: a.club_id || a.clubId || null,
      team_id: a.team_id || a.teamId || null,
      teamId: a.team_id || a.teamId || null,
      season_name: a.season_name || a.seasonName || "",
      seasonName: a.season_name || a.seasonName || "",
      staff_role: a.staff_role || a.staffRole || "",
      staffRole: a.staff_role || a.staffRole || "",
      staff_name: a.staff_name || a.staffName || "",
      staffName: a.staff_name || a.staffName || ""
    };
  }

  _normalizePlayer(p) {
    if (!p) return p;
    const fName = p.first_name || p.firstName || "";
    const lName = p.last_name || p.lastName || "";
    const jersey = p.jersey !== undefined && p.jersey !== null ? String(p.jersey) : (p.number ? String(p.number) : "?");
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
      team_season_id: g.team_season_id || g.teamSeasonId || null,
      teamSeasonId: g.team_season_id || g.teamSeasonId || null,
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
      status: g.status || "Finalizado"
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
    const plusMinus = Number(s.plus_minus ?? s.plusMinus ?? 0);
    const isStarter = Boolean(s.starter || s.isStarter);

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
      starter: isStarter,
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
      blocks_made: blk,
      turnovers: tov,
      tov,
      fouls_committed: fouls,
      fouls,
      fouls_drawn: foulsDrawn,
      foulsDrawn,
      plus_minus: plusMinus,
      evaluation: Number(s.evaluation ?? val),
      val: Number(s.evaluation ?? val),
      pir: Number(s.evaluation ?? val)
    };
  }

  // =========================================================================
  // 2. INICIALIZACIÓN Y CARGA DE DATOS
  // =========================================================================

  /**
   * Carga el contexto de trabajo con consultas acotadas al equipo activo.
   *
   * Regla de rendimiento:
   * - clubs/teams son catálogos pequeños y se cargan completos.
   * - players/games/seasons se filtran en Supabase por team_id.
   * - stats/periods se cargan únicamente para los game_id visibles.
   * - game_events NO se precargan; se solicitan bajo demanda.
   *
   * Esto evita descargar toda la base para después filtrarla en el navegador.
   */
  async init(teamId = null, forceRefresh = false) {
    if (this.isLoaded && !forceRefresh) return;
    if (this.isLoading) return;

    this.isLoading = true;

    if (teamId) {
      this.setActiveTeamAndSeason(teamId, null);
    }

    try {
      // 1. Hidratación inmediata desde caché local.
      if (typeof localStorage !== "undefined") {
        const cTeams = localStorage.getItem("iq_cache_teams");
        const cPlayers = localStorage.getItem("iq_cache_players");
        const cGames = localStorage.getItem("iq_cache_games");
        const cStaffAssignments = localStorage.getItem("iq_cache_staff_assignments");
        const cStats = localStorage.getItem("iq_cache_stats");
        const cPeriods = localStorage.getItem("iq_cache_periods");
        const cEvents = localStorage.getItem("iq_cache_events");

        if (cTeams) this.teams = JSON.parse(cTeams).map(t => this._normalizeTeam(t));
        if (cPlayers) this.players = JSON.parse(cPlayers).map(p => this._normalizePlayer(p));
        if (cGames) this.games = JSON.parse(cGames).map(g => this._normalizeGame(g));
        if (cStaffAssignments) this.staffAssignments = JSON.parse(cStaffAssignments).map(a => this._normalizeStaffAssignment(a));
        if (cStats) this.playerGameStats = JSON.parse(cStats).map(s => this._normalizeStat(s));
        if (cPeriods) this.gamePeriodScores = JSON.parse(cPeriods);
        if (cEvents) {
          this.gameEvents = JSON.parse(cEvents);
          this.gameEvents.forEach(ev => {
            const gameId = ev?.game_id || ev?.gameId;
            if (gameId) this.loadedGameEventIds.add(String(gameId));
          });
        }
      }

      if (supabase) {
        // 2. Catálogos mínimos necesarios para resolver el contexto.
        const [clubsRes, teamsRes] = await Promise.allSettled([
          supabase
            .from("clubs")
            .select("id,name,logo_url,created_by,created_at,phone,address,coordinator_name"),
          supabase
            .from("teams")
            .select("id,club_id,name,category,competition,color,logo_url,periods_count,period_minutes,coach_name,created_at")
        ]);

        if (clubsRes.status === "fulfilled" && !clubsRes.value.error && Array.isArray(clubsRes.value.data)) {
          this.clubs = clubsRes.value.data;
        }
        if (teamsRes.status === "fulfilled" && !teamsRes.value.error && Array.isArray(teamsRes.value.data)) {
          this.teams = teamsRes.value.data.map(t => this._normalizeTeam(t));
        }

        this.permissionService?.setTeamCatalog?.(this.teams || []);

        const storedTeamId = typeof localStorage !== "undefined"
          ? localStorage.getItem("iq_active_team_id")
          : null;
        const requestedTeamId = String(teamId || storedTeamId || "").trim();
        const requestedExists = requestedTeamId
          && (this.teams || []).some(t => String(t.id) === requestedTeamId);

        const auth = this.permissionService;
        const isSuperadmin = auth?.getAuthenticatedRole?.() === UserRole.SUPERADMIN;
        const requestedAllowed = requestedExists
          && (!auth || isSuperadmin || auth.canAccessTeam(requestedTeamId));

        const firstAllowedTeam = (this.teams || []).find(t =>
          !auth || isSuperadmin || auth.canAccessTeam(String(t.id))
        );

        const scopeTeamId = requestedAllowed
          ? requestedTeamId
          : (firstAllowedTeam?.id ? String(firstAllowedTeam.id) : "");

        if (scopeTeamId && typeof localStorage !== "undefined") {
          localStorage.setItem("iq_active_team_id", scopeTeamId);
        }

        // 3. Datos operativos: filtrar en servidor, nunca descargar todo para filtrar después.
        // Un usuario autenticado sin ningún equipo autorizado NO debe caer en una
        // consulta global por ausencia de filtro.
        const restrictedWithoutScope = Boolean(auth && !isSuperadmin && !scopeTeamId);

        if (restrictedWithoutScope) {
          this.players = [];
          this.games = [];
          this.seasons = [];
        } else {
          let playersQuery = supabase.from("players").select("*");
          // Excluye `games.events` del arranque: es un JSONB potencialmente pesado y
          // la fuente operativa de eventos es `game_events`, que se carga bajo demanda.
          let gamesQuery = supabase
            .from("games")
            .select("id,team_id,season_id,date,time,opponent,competition,round,venue,venue_name,periods_count,period_minutes,status,periods,team_score,opponent_score,observations,video_url,created_at,starter_ids,notes,has_overtime,overtime_count")
            .order("date", { ascending: false });
          let seasonsQuery = supabase.from("seasons").select("*").order("created_at", { ascending: false });

          if (scopeTeamId) {
            playersQuery = playersQuery.eq("team_id", scopeTeamId);
            gamesQuery = gamesQuery.eq("team_id", scopeTeamId);
            // Compatibilidad con el esquema actual. En v3 seasons será global + team_seasons.
            seasonsQuery = seasonsQuery.eq("team_id", scopeTeamId);
          }

          const [playersRes, gamesRes, seasonsRes] = await Promise.allSettled([
            playersQuery,
            gamesQuery,
            seasonsQuery
          ]);

          if (playersRes.status === "fulfilled" && !playersRes.value.error) {
            this.players = (playersRes.value.data || []).map(p => this._normalizePlayer(p));
          }
          if (gamesRes.status === "fulfilled" && !gamesRes.value.error) {
            this.games = (gamesRes.value.data || []).map(g => this._normalizeGame(g));
          }
          if (seasonsRes.status === "fulfilled" && !seasonsRes.value.error) {
            this.seasons = seasonsRes.value.data || [];
          }
        }

        // 4. Las tablas dependientes se consultan solo para los partidos visibles.
        const visibleGameIds = (this.games || []).map(g => String(g.id)).filter(Boolean);
        if (visibleGameIds.length > 0) {
          const [statsRows, periodRows] = await Promise.all([
            this._fetchRowsByGameIds("player_game_stats", visibleGameIds),
            this._fetchRowsByGameIds("game_period_scores", visibleGameIds)
          ]);

          this.playerGameStats = statsRows.map(s => this._normalizeStat(s));
          this.gamePeriodScores = periodRows;
        } else {
          this.playerGameStats = [];
          this.gamePeriodScores = [];
        }

        // Eventos de pista: conservar únicamente caché del contexto actual.
        // La descarga remota se hace bajo demanda desde loadGameEvents().
        const visibleGameSet = new Set(visibleGameIds);
        this.gameEvents = (this.gameEvents || []).filter(ev =>
          visibleGameSet.has(String(ev.game_id || ev.gameId || ""))
        );
        this.loadedGameEventIds = new Set(
          [...this.loadedGameEventIds].filter(id => visibleGameSet.has(String(id)))
        );

        this._filterAuthorizedData();
        this._persistToStorage();
      }

      this._filterAuthorizedData();
    } catch (err) {
      console.warn("[DataStore] Inicialización local:", err.message);
    } finally {
      this.isLoaded = true;
      this.isLoading = false;
      this._notifyListeners();
    }
  }

  /**
   * Recupera filas de una tabla dependiente de game_id en lotes pequeños.
   * Evita URLs excesivas y permite escalar a historiales mayores.
   */
  async _fetchRowsByGameIds(tableName, gameIds = [], selectColumns = "*") {
    if (!supabase) return [];

    const ids = [...new Set((gameIds || []).map(String).filter(Boolean))];
    if (ids.length === 0) return [];

    const chunkSize = 100;
    const rows = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from(tableName)
        .select(selectColumns)
        .in("game_id", chunk);

      if (error) {
        console.warn(`[DataStore] Error cargando ${tableName} por game_id:`, error.message);
        continue;
      }
      if (Array.isArray(data)) rows.push(...data);
    }

    return rows;
  }

  _persistToStorage() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem("iq_cache_teams", JSON.stringify(this.teams));
      localStorage.setItem("iq_cache_players", JSON.stringify(this.players));
      localStorage.setItem("iq_cache_games", JSON.stringify(this.games));
      localStorage.setItem("iq_cache_staff_assignments", JSON.stringify(this.staffAssignments));
      localStorage.setItem("iq_cache_stats", JSON.stringify(this.playerGameStats));
      localStorage.setItem("iq_cache_periods", JSON.stringify(this.gamePeriodScores));
      localStorage.setItem("iq_cache_events", JSON.stringify(this.gameEvents));
    } catch (e) {
      console.warn("[DataStore] Error persistiendo en LocalStorage:", e.message);
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
    return "";
  }

  getSeasons(teamId = null) {
    const targetTeamId = String(teamId || this.getActiveTeamId() || "");
    return (this.seasons || []).filter((s) => {
      const seasonTeamId = String(s.team_id || s.teamId || "");
      return !seasonTeamId || !targetTeamId || seasonTeamId === targetTeamId;
    });
  }

  getActiveSeason() {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("iq_active_season");
      if (stored) return stored;
    }

    const activeTeamId = this.getActiveTeamId();
    const firstSeason = (this.seasons || []).find(s =>
      !activeTeamId || String(s.team_id || s.teamId || "") === String(activeTeamId)
    );

    return firstSeason?.name ? String(firstSeason.name) : "";
  }

  getActiveSeasonId(teamId = null) {
    const activeSeasonName = String(this.getActiveSeason()).trim().toLowerCase();
    const targetTeamId = String(teamId || this.getActiveTeamId() || "");

    const teamSeasons = (this.seasons || []).filter((s) => {
      const seasonTeamId = String(s.team_id || s.teamId || "");
      return !seasonTeamId || !targetTeamId || seasonTeamId === targetTeamId;
    });

    const matchedSeason = teamSeasons.find((s) => {
      const sName = String(s.name || "").trim().toLowerCase();
      return sName === activeSeasonName
        || activeSeasonName.includes(sName)
        || sName.includes(activeSeasonName);
    });

    if (matchedSeason) return matchedSeason.id;

    const firstTeamSeason = teamSeasons[0];
    if (firstTeamSeason) return firstTeamSeason.id;

    return null;
  }

  setActiveTeamAndSeason(teamId, season) {
    if (teamId && this.permissionService && !this.permissionService.canAccessTeam(teamId)) {
      console.warn("[DataStore] Intento de seleccionar un equipo no autorizado:", teamId);
      return false;
    }
    if (typeof localStorage !== "undefined") {
      if (teamId) localStorage.setItem("iq_active_team_id", String(teamId));
      if (season) localStorage.setItem("iq_active_season", String(season));
    }
    this._notifyListeners();
    return true;
  }

  // =========================================================================
  // 4. GETTERS Y SELECTORES DE DOMINIO
  // =========================================================================

  getClubs() { return this.clubs || []; }

  getClubById(id) {
    if (!id) return null;
    return (this.clubs || []).find((c) => String(c.id).toLowerCase() === String(id).toLowerCase()) || null;
  }

  getTeams() {
    if (!this.teams || this.teams.length === 0) {
      if (this.permissionService && this.permissionService.getAuthenticatedRole() !== UserRole.SUPERADMIN) {
        return [];
      }
      return [{
        id: this.getActiveTeamId(),
        name: "Equipo Principal",
        category: "Sénior",
        competition: "Liga",
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

  getStaffAssignments({ clubId = null, teamId = null, seasonName = null, role = null } = {}) {
    return (this.staffAssignments || []).filter((a) => {
      if (clubId && String(a.club_id || a.clubId || "") !== String(clubId)) return false;
      if (teamId && String(a.team_id || a.teamId || "") !== String(teamId)) return false;
      if (seasonName && String(a.season_name || a.seasonName || "").trim().toLowerCase() !== String(seasonName).trim().toLowerCase()) return false;
      if (role && String(a.staff_role || a.staffRole || "").toUpperCase() !== String(role).toUpperCase()) return false;
      return true;
    });
  }

  getTeamCoach(teamId = null, seasonName = null) {
    const targetTeamId = teamId || this.getActiveTeamId();
    const targetSeasonName = String(seasonName || this.getActiveSeason() || "").trim().toLowerCase();

    // Fuente real auditada: seasons.coach_name permite entrenador por temporada.
    const season = (this.seasons || []).find(s => {
      const sameTeam = String(s.team_id || s.teamId || "") === String(targetTeamId || "");
      const name = String(s.name || "").trim().toLowerCase();
      return sameTeam && (!targetSeasonName || name === targetSeasonName);
    });

    if (season?.coach_name || season?.coachName) {
      return season.coach_name || season.coachName;
    }

    // Compatibilidad temporal con asignaciones experimentales en caché.
    const assignment = this.getStaffAssignments({
      teamId: targetTeamId,
      seasonName: seasonName || this.getActiveSeason(),
      role: "HEAD_COACH"
    })[0];
    if (assignment) return assignment.staff_name || assignment.staffName || "Por definir";

    const team = this.getTeamById(targetTeamId);
    return team?.coach_name || team?.coachName || team?.coach || "Por definir";
  }

  getClubCoordinator(clubId, seasonName = null) {
    const targetSeason = seasonName || this.getActiveSeason();
    const assignment = this.getStaffAssignments({
      clubId,
      seasonName: targetSeason,
      role: "COORDINATOR"
    }).find(a => !(a.team_id || a.teamId));
    if (assignment) return assignment.staff_name || assignment.staffName || "No asignado";
    const club = this.getClubById(clubId);
    return club?.coordinator_name || club?.coordinatorName || "No asignado";
  }

  setStaffAssignmentLocal(assignment) {
    const normalized = this._normalizeStaffAssignment(assignment);
    const idx = (this.staffAssignments || []).findIndex(a =>
      String(a.id) === String(normalized.id)
      || (
        String(a.team_id || a.teamId || "") === String(normalized.team_id || normalized.teamId || "")
        && String(a.club_id || a.clubId || "") === String(normalized.club_id || normalized.clubId || "")
        && String(a.season_name || a.seasonName || "").toLowerCase() === String(normalized.season_name || normalized.seasonName || "").toLowerCase()
        && String(a.staff_role || a.staffRole || "").toUpperCase() === String(normalized.staff_role || normalized.staffRole || "").toUpperCase()
      )
    );
    if (idx >= 0) this.staffAssignments[idx] = normalized;
    else this.staffAssignments.push(normalized);
    this._persistToStorage();
    this._notifyListeners();
  }

  getPlayers(teamId = null) {
    const all = this.players || [];
    const targetTeamId = String(teamId || this.getActiveTeamId()).toLowerCase();
    const filtered = all.filter((p) => String(p.team_id || p.teamId || "").toLowerCase() === targetTeamId);
    return [...filtered].sort((a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0));
  }

  getPlayerById(id) {
    if (!id) return null;
    return (this.players || []).find((p) => String(p.id) === String(id)) || null;
  }

  getGames(teamId = null) {
    const all = this.games || [];
    const targetTeamId = String(teamId || this.getActiveTeamId()).toLowerCase();
    const filtered = all.filter((g) => String(g.team_id || g.teamId || "").toLowerCase() === targetTeamId);
    return [...filtered].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
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
      .sort((a, b) => Number(a.period_number ?? a.periodNumber ?? 1) - Number(b.period_number ?? b.periodNumber ?? 1));
  }

  getGameEvents(gameId = null) {
    if (!gameId) return this.gameEvents || [];
    return (this.gameEvents || []).filter((e) => String(e.game_id || e.gameId) === String(gameId));
  }

  /**
   * Carga eventos únicamente para los partidos solicitados.
   * Los eventos son el conjunto de datos más granular y no deben viajar en el arranque.
   */
  async loadGameEvents(gameIds = [], forceRefresh = false) {
    const ids = [...new Set(
      (Array.isArray(gameIds) ? gameIds : [gameIds])
        .map(String)
        .filter(Boolean)
    )];

    if (ids.length === 0 || !supabase) return [];

    const idsToFetch = forceRefresh
      ? ids
      : ids.filter(id => !this.loadedGameEventIds.has(id));

    if (idsToFetch.length > 0) {
      const remoteRows = await this._fetchRowsByGameIds("game_events", idsToFetch);

      const replacingIds = new Set(idsToFetch);
      const retained = (this.gameEvents || []).filter(ev =>
        !replacingIds.has(String(ev.game_id || ev.gameId || ""))
      );

      this.gameEvents = [...retained, ...remoteRows];
      idsToFetch.forEach(id => this.loadedGameEventIds.add(String(id)));
      this._persistToStorage();
    }

    const requested = new Set(ids);
    return (this.gameEvents || []).filter(ev =>
      requested.has(String(ev.game_id || ev.gameId || ""))
    );
  }

  // =========================================================================
  // 5. GUARDADO ATÓMICO Y SINCRONIZACIÓN EXACTA CON SUPABASE
  // =========================================================================

  async saveGameAndStats(gameData, statsList = [], periodScores = [], liveEvents = []) {
    const requestedTeamId = gameData.team_id || gameData.teamId || this.getActiveTeamId();
    const requestedSeasonId = gameData.season_id || gameData.seasonId || this.getActiveSeasonId(requestedTeamId);
    const existingGame = gameData.id
      ? this.games.find(g => String(g.id) === String(gameData.id))
      : null;
    const permissionKey = existingGame ? Permission.EDIT_GAME : Permission.CREATE_GAME;
    this._assertPermission(
      permissionKey,
      { teamId: requestedTeamId, seasonId: requestedSeasonId },
      existingGame
        ? "No tienes permiso para modificar este partido."
        : "No tienes permiso para crear partidos en este equipo."
    );

    // Validar UUID
    const isValidUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const gId = (gameData.id && isValidUUID(gameData.id)) ? gameData.id : this._generateUUID();

    const targetTeamId = gameData.team_id || gameData.teamId || this.getActiveTeamId();
    const targetSeasonId = gameData.season_id || gameData.seasonId || this.getActiveSeasonId(targetTeamId);

    const normalizedGame = this._normalizeGame({
      ...gameData,
      id: gId,
      team_id: targetTeamId,
      season_id: targetSeasonId
    });

    // 1. Estado en memoria local
    const gIdx = this.games.findIndex((g) => String(g.id) === String(gId));
    if (gIdx >= 0) this.games[gIdx] = normalizedGame;
    else this.games.unshift(normalizedGame);

    const formattedStats = statsList.map((st) => this._normalizeStat({ ...st, game_id: gId }));
    this.playerGameStats = this.playerGameStats.filter((s) => String(s.game_id || s.gameId) !== String(gId));
    this.playerGameStats.push(...formattedStats);

    const formattedPeriods = periodScores.map((p) => ({
      id: p.id && isValidUUID(p.id) ? p.id : this._generateUUID(),
      game_id: gId,
      period_type: p.period_type || (p.is_overtime ? 'overtime' : 'quarter'),
      period_number: Number(p.period_number ?? p.periodNumber ?? 1),
      team_score: Number(p.team_score ?? p.teamScore ?? 0),
      opponent_score: Number(p.opponent_score ?? p.opponentScore ?? 0),
      is_overtime: Boolean(p.is_overtime ?? p.isOvertime ?? false)
    }));
    this.gamePeriodScores = this.gamePeriodScores.filter((p) => String(p.game_id || p.gameId) !== String(gId));
    this.gamePeriodScores.push(...formattedPeriods);

    const formattedEvents = liveEvents.map((ev, idx) => {
      const pId = ev.player_id || ev.playerId || null;
      const act = ev.action_type || ev.action || ev.event_type || 'fg2_attempted';
      const cX = ev.coord_x !== undefined && ev.coord_x !== null ? parseFloat(Number(ev.coord_x).toFixed(2)) : (ev.coordinates?.x !== undefined ? parseFloat(Number(ev.coordinates.x).toFixed(2)) : null);
      const cY = ev.coord_y !== undefined && ev.coord_y !== null ? parseFloat(Number(ev.coord_y).toFixed(2)) : (ev.coordinates?.y !== undefined ? parseFloat(Number(ev.coordinates.y).toFixed(2)) : null);

      return {
        id: ev.id && isValidUUID(ev.id) ? ev.id : this._generateUUID(),
        game_id: gId,
        player_id: pId && isValidUUID(pId) ? pId : null,
        team_id: targetTeamId,
        period: Number(ev.period || 1),
        game_clock: ev.game_clock || ev.timeRemaining ? String(ev.game_clock || '10:00') : '10:00',
        action_type: act,
        points: Number(ev.points || 0),
        made: Boolean(ev.made ?? ev.coordinates?.made ?? false),
        coord_x: cX,
        coord_y: cY
      };
    });
    this.gameEvents = this.gameEvents.filter((e) => String(e.game_id || e.gameId) !== String(gId));
    this.gameEvents.push(...formattedEvents);

    this._persistToStorage();

    // 2. Persistencia remota en Supabase
    if (supabase) {
      try {
        const dbGamePayload = {
          id: gId,
          team_id: targetTeamId,
          season_id: targetSeasonId,
          date: normalizedGame.date || new Date().toISOString().split("T")[0],
          time: gameData.time || "18:00",
          opponent: normalizedGame.opponent || "Rival",
          competition: gameData.competition || "Liga",
          round: gameData.round || "Jornada 1",
          venue: normalizedGame.venue || "Local",
          venue_name: gameData.venue_name || "",
          periods_count: 4,
          period_minutes: 10,
          status: normalizedGame.status || "Finalizado",
          periods: formattedPeriods,
          team_score: normalizedGame.team_score,
          opponent_score: normalizedGame.opponent_score,
          starter_ids: Array.isArray(gameData.starter_ids) ? gameData.starter_ids : [],
          notes: gameData.notes || "",
          video_url: gameData.video_url || ""
        };

        const { error: gErr } = await supabase.from("games").upsert([dbGamePayload]);
        if (gErr) throw new Error(`[games] ${gErr.message}`);

        if (formattedStats.length > 0) {
          const dbStatsPayload = formattedStats.map(st => ({
            game_id: gId,
            player_id: st.player_id,
            starter: Boolean(st.starter),
            minutes: Number(st.minutes || 0),
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
            blocks: Number(st.blocks || 0),
            blocks_made: Number(st.blocks_made || 0),
            blocks_received: Number(st.blocks_received || 0),
            turnovers: Number(st.turnovers || 0),
            fouls_committed: Number(st.fouls_committed || 0),
            fouls_drawn: Number(st.fouls_drawn || 0),
            plus_minus: Number(st.plus_minus || 0),
            evaluation: Number(st.evaluation || 0),
            points: Number(st.points || 0)
          }));

          const { error: sErr } = await supabase.from("player_game_stats").upsert(dbStatsPayload, { onConflict: "game_id,player_id" });
          if (sErr) throw new Error(`[player_game_stats] ${sErr.message}`);
        }

        if (formattedPeriods.length > 0) {
          await supabase.from("game_period_scores").delete().eq("game_id", gId);
          const { error: pErr } = await supabase.from("game_period_scores").insert(formattedPeriods);
          if (pErr) throw new Error(`[game_period_scores] ${pErr.message}`);
        }

        if (formattedEvents.length > 0) {
          await supabase.from("game_events").delete().eq("game_id", gId);
          const { error: evErr } = await supabase.from("game_events").insert(formattedEvents);
          if (evErr) throw new Error(`[game_events] ${evErr.message}`);
        }
      } catch (err) {
        console.error("[DataStore] Error guardando en Supabase:", err);
        throw err;
      }
    }

    this._notifyListeners();
    return gId;
  }

  async deleteGame(gameId) {
    if (!gameId) return false;
    const existingGame = this.games.find(g => String(g.id) === String(gameId));
    this._assertPermission(
      Permission.DELETE_GAME,
      { teamId: existingGame?.team_id || existingGame?.teamId || this.getActiveTeamId(), seasonId: existingGame?.season_id || existingGame?.seasonId || null },
      "No tienes permiso para borrar este partido."
    );
    this.games = this.games.filter((g) => String(g.id) !== String(gameId));
    this.playerGameStats = this.playerGameStats.filter((s) => String(s.game_id || s.gameId) !== String(gameId));
    this.gamePeriodScores = this.gamePeriodScores.filter((p) => String(p.game_id || p.gameId) !== String(gameId));
    this.gameEvents = this.gameEvents.filter((e) => String(e.game_id || e.gameId) !== String(gameId));

    this._persistToStorage();

    if (supabase) {
      try {
        await Promise.allSettled([
          supabase.from("games").delete().eq("id", gameId),
          supabase.from("player_game_stats").delete().eq("game_id", gameId),
          supabase.from("game_period_scores").delete().eq("game_id", gameId),
          supabase.from("game_events").delete().eq("game_id", gameId)
        ]);
      } catch (err) {
        console.warn("[DataStore] Error en borrado remoto:", err.message);
      }
    }

    this._notifyListeners();
    return true;
  }

  async updatePlayer(playerId, updates, permissionKey = Permission.EDIT_PLAYER_MASTER) {
    const existingPlayer = this.players.find((p) => String(p.id) === String(playerId));
    this._assertPermission(
      permissionKey,
      { playerId, playerTeamId: existingPlayer?.team_id || existingPlayer?.teamId || null },
      "No tienes permiso para modificar los datos de este jugador."
    );
    const idx = this.players.findIndex((p) => String(p.id) === String(playerId));
    if (idx >= 0) {
      this.players[idx] = this._normalizePlayer({ ...this.players[idx], ...updates });
      this._persistToStorage();
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