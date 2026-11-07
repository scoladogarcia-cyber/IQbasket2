/**
 * @fileoverview Servicio de Persistencia, Sincronización y Auditoría: StatsSyncService.
 * @description Orquesta la sincronización y actualización periódica o bajo demanda entre Supabase
 * y el estado local para las tablas `games`, `team_game_stats`, `player_game_stats` y `players`.
 * 
 * Reglas de diseño:
 * 1. Desacoplamiento matemático total: delega el 100% de las fórmulas en `BoxScoreCalculator`, `StatsAggregator` y `StatsEngine`.
 * 2. Mapeo transparente con las columnas de Supabase (puntos, ratings, four factors, valoración PIR, Game Score, TS%, eFG%).
 * 3. Ejecución por lotes optimizada (Batch updates/upserts) para minimizar peticiones HTTP.
 * 4. Aislamiento por equipo y temporada activa.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { AdvancedTeamStatsCalculator } from "../domain/stats/AdvancedTeamStatsCalculator.js";
import { Permission } from "../security/PermissionService.js";
import { StatsAggregator } from "../domain/stats/StatsAggregator.js";

export class StatsSyncService {
  /**
   * Crea una instancia de StatsSyncService.
   * @param {Object} supabaseClient - Cliente Supabase JS configurado.
   */
  constructor(supabaseClient, authController = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient || (typeof window !== "undefined" ? window.supabase : null);
    this.auth = authController;
  }

  _assertCanSync(teamId = null) {
    if (this.auth && !this.auth.can?.(Permission.SYNC_DATA, { teamId })) {
      throw new Error("Permisos insuficientes para sincronizar o auditar datos.");
    }
  }

  // =========================================================================
  // 1. CARGA CONSOLIDADA PARA DASHBOARD COLECTIVO / EQUIPO
  // =========================================================================

  /**
   * Obtiene todos los datos reales mapeando los nombres exactos de columnas de Supabase.
   * @param {string} [teamId=null] - UUID del equipo a consultar.
   * @returns {Promise<Object>} Conjunto de datos consolidados para el Dashboard.
   */
  async fetchTeamDashboardData(teamId = null) {
    if (!this.supabase) {
      return { isSuccess: false, error: "Sin cliente de Supabase disponible" };
    }

    try {
      // 1. Obtener datos del equipo desde 'teams'
      let team = null;
      if (teamId) {
        const { data: teamData, error: tErr } = await this.supabase
          .from("teams")
          .select("id,club_id,name,category,competition,color,logo_url,periods_count,period_minutes,coach_name,created_at")
          .eq("id", teamId)
          .maybeSingle();

        if (tErr) throw tErr;
        team = teamData;
      } else {
        const { data: teamsList, error: tListErr } = await this.supabase
          .from("teams")
          .select("id,club_id,name,category,competition,color,logo_url,periods_count,period_minutes,coach_name,created_at")
          .limit(1);
        if (tListErr) throw tListErr;
        team = teamsList && teamsList.length > 0 ? teamsList[0] : null;
      }

      const activeTeamId = teamId || team?.id;

      // 2. Obtener partidos de 'games'
      let gamesQuery = this.supabase
        .from("games")
        .select("id,team_id,season_id,date,time,opponent,competition,round,venue,venue_name,status,team_score,opponent_score,created_at")
        .order("date", { ascending: true });
      if (activeTeamId) gamesQuery = gamesQuery.eq("team_id", activeTeamId);
      const { data: games, error: gErr } = await gamesQuery;
      if (gErr) throw gErr;

      const playedGames = StatsEngine.filterPlayedGames(games || []);
      const playedGameIds = playedGames.map((g) => g.id);

      // 3. Obtener team_game_stats
      let teamStats = [];
      if (playedGameIds.length > 0) {
        const { data: statsData, error: tgErr } = await this.supabase
          .from("team_game_stats")
          .select("*")
          .in("game_id", playedGameIds);

        if (tgErr) console.warn("[StatsSyncService] Aviso cargando team_game_stats:", tgErr.message);
        teamStats = statsData || [];
      }

      // 4. Obtener plantilla de 'players'
      let playersQuery = this.supabase
        .from("players")
        .select("id,team_id,first_name,last_name,jersey,primary_position,secondary_positions,birth_date,height_cm,weight_kg,dominant_hand,status,photo_url,season_id,ppg");
      if (activeTeamId) playersQuery = playersQuery.eq("team_id", activeTeamId);
      const { data: players, error: pErr } = await playersQuery;
      if (pErr) throw pErr;
      const playersMap = new Map((players || []).map((p) => [p.id, p]));

      // 5. Obtener estadísticas individuales de 'player_game_stats'
      let playerStats = [];
      if (playedGameIds.length > 0) {
        const { data: pStats, error: pgsErr } = await this.supabase
          .from("player_game_stats")
          .select("*")
          .in("game_id", playedGameIds);

        if (pgsErr) console.warn("[StatsSyncService] Aviso cargando player_game_stats:", pgsErr.message);
        playerStats = pStats || [];
      }

      return {
        team: team || {},
        teamName: team?.name || "Equipo",
        category: team?.category || "General",
        season: team?.season_id || "2026",
        playedGames: playedGames.length > 0 ? playedGames : (games || []),
        teamStats,
        playerStats,
        playersMap,
        isSuccess: true
      };
    } catch (error) {
      console.error("[StatsSyncService] Error cargando datos de dashboard:", error);
      return { isSuccess: false, error: error.message };
    }
  }

  // =========================================================================
  // 2. PERSISTENCIA DE TOTALES COLECTIVOS POR PARTIDO
  // =========================================================================

  /**
   * Sincroniza y guarda los totales calculados en la tabla `team_game_stats`.
   * @param {string} gameId - UUID del partido.
   * @param {Object} totals - Métricas colectivas a persistir.
   */
  async persistGameTotals(gameId, totals = {}) {
    if (!this.supabase || !gameId) return;
    if (this.auth) this._assertCanSync(null);

    try {
      await this.supabase
        .from("team_game_stats")
        .upsert({ game_id: gameId, ...totals }, { onConflict: "game_id" });
    } catch (err) {
      console.error(`[StatsSyncService] Error guardando totales de equipo para el partido ${gameId}:`, err);
    }
  }

  // =========================================================================
  // 3. AUDITORÍA INTEGRAL, RECÁLCULO Y SINCRONIZACIÓN MULTI-TABLA
  // =========================================================================

  /**
   * Ejecuta una auditoría completa sobre todas las estadísticas de partidos y recalcula
   * índices avanzados (PIR, Game Score, TS%, eFG%, ORtg, DRtg, Net Rating, Pace) y medias en `players`.
   * 
   * @param {string|null} [teamId=null] - UUID del equipo.
   * @param {Array<Object>|null} [memoryRows=null] - Filas opcionales en memoria.
   * @returns {Promise<{ success: boolean, statsFixed: number, ppgFixed: number, error?: string }>}
   */
  /**
   * V81: read-only audit. Never rewrites historical PIR, team totals or PPG.
   * Historical rows require evidence-backed reconciliation before any write.
   * The existing UI method name is retained for route compatibility.
   */
  async runFullAuditAndSync(teamId = null, memoryRows = null) {
    this._assertCanSync(teamId);
    if (!teamId || !this.supabase) {
      return {success:false,error:"Se necesita un equipo autorizado para auditar."};
    }
    try {
      const {data:games,error:gameError}=await this.supabase.from("games")
        .select("id,team_id,team_season_id").eq("team_id",teamId);
      if(gameError)throw gameError;
      const allowedIds=new Set((games||[]).map(game=>String(game.id)));
      const rows=[];
      if(Array.isArray(memoryRows)) {
        for(const row of memoryRows) {
          const gameId=String(row.game_id??row.gameId??"");
          if(!allowedIds.has(gameId))throw new Error("Filas fuera del equipo autorizado: auditoría cancelada.");
          rows.push(row);
        }
      } else {
        const ids=[...allowedIds];
        // Batch by game_id and page each query to avoid Supabase's default limit.
        for(let i=0;i<ids.length;i+=30) {
          const batch=ids.slice(i,i+30);
          for(let offset=0; ;offset+=1000) {
            const {data,error}=await this.supabase.from("player_game_stats")
              .select("*").in("game_id",batch).range(offset,offset+999);
            if(error)throw error;
            rows.push(...(data||[]));
            if((data||[]).length<1000)break;
          }
        }
      }
      const seen=new Set();
      let discrepancies=0,pointsDiscrepancies=0;
      const flaggedGames=new Set();
      for(const row of rows) {
        const gameId=String(row.game_id??row.gameId??"");
        const playerId=String(row.player_id??row.playerId??"");
        if(!allowedIds.has(gameId)||!playerId)throw new Error("Identidad estadística no verificable.");
        const key=JSON.stringify([gameId,playerId]);
        if(seen.has(key))throw new Error("Duplicado jugador-partido; revisión manual necesaria.");
        seen.add(key);
        const result=BoxScoreCalculator.calculatePlayerBoxScore(row);
        if(row.evaluation!==undefined&&row.evaluation!==null&&Number(row.evaluation)!==result.pir) {
          discrepancies++;flaggedGames.add(gameId);
        }
        const derivedPoints=BoxScoreCalculator.calculatePoints(result.fg2Made,result.fg3Made,result.ftMade);
        if(row.points!==null&&row.points!==undefined&&Number(row.points)!==derivedPoints) {
          pointsDiscrepancies++;flaggedGames.add(gameId);
        }
      }
      return {
        success:true,dryRun:true,compared:rows.length,discrepancies,
        pointsDiscrepancies,flaggedGames:flaggedGames.size,
        statsFixed:0,ppgFixed:0
      };
    }catch(err){
      return {success:false,dryRun:true,compared:0,statsFixed:0,ppgFixed:0,error:err?.message||String(err)};
    }
  }

}

export default StatsSyncService;