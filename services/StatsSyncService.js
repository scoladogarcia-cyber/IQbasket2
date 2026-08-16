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
import { StatsAggregator } from "../domain/stats/StatsAggregator.js";

export class StatsSyncService {
  /**
   * Crea una instancia de StatsSyncService.
   * @param {Object} supabaseClient - Cliente Supabase JS configurado.
   */
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient || (typeof window !== "undefined" ? window.supabase : null);
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
          .select("*")
          .eq("id", teamId)
          .maybeSingle();

        if (tErr) throw tErr;
        team = teamData;
      } else {
        const { data: teamsList, error: tListErr } = await this.supabase.from("teams").select("*").limit(1);
        if (tListErr) throw tListErr;
        team = teamsList && teamsList.length > 0 ? teamsList[0] : null;
      }

      const activeTeamId = teamId || team?.id;

      // 2. Obtener partidos de 'games'
      let gamesQuery = this.supabase.from("games").select("*").order("date", { ascending: true });
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
      let playersQuery = this.supabase.from("players").select("*");
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
  async runFullAuditAndSync(teamId = null, memoryRows = null) {
    if (!this.supabase) {
      return { success: false, statsFixed: 0, ppgFixed: 0, error: "Sin conexión a Supabase." };
    }

    try {
      console.log("🔄 [StatsSyncService] Iniciando auditoría y recálculo integral...");

      // 1. Obtener filas de player_game_stats
      let rowsToProcess = memoryRows;
      if (!rowsToProcess || !Array.isArray(rowsToProcess) || rowsToProcess.length === 0) {
        let pgsQuery = this.supabase.from("player_game_stats").select("*");
        const { data: allPlayerStats, error: pgsErr } = await pgsQuery;
        if (pgsErr) throw pgsErr;
        rowsToProcess = allPlayerStats || [];
      }

      const playerRowsMap = {};
      const updatedPlayerStatsBatch = [];

      // 2. Recalcular cada registro individual mediante BoxScoreCalculator oficial
      for (const row of rowsToProcess) {
        const computed = BoxScoreCalculator.calculatePlayerBoxScore(row);

        if (row.id) {
          updatedPlayerStatsBatch.push({
            id: row.id,
            game_id: row.game_id,
            player_id: row.player_id,
            points: computed.points,
            pts: computed.points,
            evaluation: computed.pir,
            val: computed.pir,
            pir: computed.pir,
            efficiency: computed.efficiency,
            game_score: computed.gameScore,
            offensive_rating: computed.indOrtg,
            true_shooting_pct: computed.tsPct,
            efg_pct: computed.eFG
          });
        }

        if (row.player_id) {
          if (!playerRowsMap[row.player_id]) {
            playerRowsMap[row.player_id] = [];
          }
          playerRowsMap[row.player_id].push({
            ...row,
            points: computed.points,
            evaluation: computed.pir,
            pir: computed.pir
          });
        }
      }

      // Inyección en bloque en player_game_stats
      if (updatedPlayerStatsBatch.length > 0) {
        const { error: batchErr } = await this.supabase
          .from("player_game_stats")
          .upsert(updatedPlayerStatsBatch, { onConflict: "id" });

        if (batchErr) throw batchErr;
      }

      // 3. Recalcular métricas colectivas en `team_game_stats`
      const { data: allTeamStats, error: tgFetchErr } = await this.supabase.from("team_game_stats").select("*");
      if (!tgFetchErr && Array.isArray(allTeamStats) && allTeamStats.length > 0) {
        const updatedTeamStatsBatch = allTeamStats.map((tRow) => {
          const computedTeam = AdvancedTeamStatsCalculator.calculateAdvancedTeamMetrics(tRow, {
            points: tRow.opp_points || 0,
            fga: tRow.opp_fg_attempted || 0,
            fta: tRow.opp_ft_attempted || 0,
            orb: tRow.opp_off_reb || 0,
            tov: tRow.opp_turnovers || 0
          });

          return {
            id: tRow.id,
            game_id: tRow.game_id,
            points: Number(tRow.points || 0),
            opp_points: Number(tRow.opp_points || 0),
            estimated_possessions: computedTeam.possessions,
            pace: computedTeam.pace,
            ortg: computedTeam.offensiveRating,
            drtg: computedTeam.defensiveRating,
            net_rating: computedTeam.netRating,
            efg: computedTeam.fourFactors?.team?.eFG || 0,
            tov_pct: computedTeam.fourFactors?.team?.tovPct || 0,
            orb_pct: computedTeam.fourFactors?.team?.orbPct || 0,
            ft_rate: computedTeam.fourFactors?.team?.ftRate || 0
          };
        });

        await this.supabase
          .from("team_game_stats")
          .upsert(updatedTeamStatsBatch, { onConflict: "id" });
      }

      // 4. Actualizar medias de temporada en la tabla `players` (PPG, RPG, APG, PIR, GP)
      let playersQuery = this.supabase.from("players").select("id, team_id");
      if (teamId) playersQuery = playersQuery.eq("team_id", teamId);
      const { data: playersList, error: pListErr } = await playersQuery;
      if (pListErr) throw pListErr;

      let updatedPlayersCount = 0;
      const playerUpdates = (playersList || []).map(async (p) => {
        const pRows = playerRowsMap[p.id] || [];
        const seasonAgg = StatsAggregator.aggregatePlayerSeasonStats(pRows);

        const ppg = seasonAgg ? seasonAgg.averages.ppg : 0.0;
        const rpg = seasonAgg ? seasonAgg.averages.rpg : 0.0;
        const apg = seasonAgg ? seasonAgg.averages.apg : 0.0;
        const val = seasonAgg ? seasonAgg.averages.pir : 0.0;
        const gp = seasonAgg ? seasonAgg.totals.gp : 0;

        const { error: updateErr } = await this.supabase
          .from("players")
          .update({
            ppg,
            rpg,
            apg,
            val,
            games_played: gp,
            updated_at: new Date().toISOString()
          })
          .eq("id", p.id);

        if (!updateErr) updatedPlayersCount++;
      });

      await Promise.all(playerUpdates);

      console.log(`✅ [StatsSyncService] Auditoría finalizada: ${updatedPlayerStatsBatch.length} stats y ${updatedPlayersCount} fichas sincronizadas.`);

      return {
        success: true,
        statsFixed: updatedPlayerStatsBatch.length,
        ppgFixed: updatedPlayersCount
      };
    } catch (err) {
      console.error("❌ [StatsSyncService] Error en runFullAuditAndSync:", err);
      return { success: false, statsFixed: 0, ppgFixed: 0, error: err.message || err };
    }
  }
}

export default StatsSyncService;