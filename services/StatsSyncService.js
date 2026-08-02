/**
 * @fileoverview Servicio de Persistencia e Integración con Supabase.
 * Encargado de leer/escribir en las tablas games, team_game_stats y player_game_stats,
 * además de ejecutar auditorías y resincronizaciones automáticas de estadísticas.
 */

import { StatsEngine } from "../engine/StatsEngine.js";

export class StatsSyncService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  /**
   * Obtiene todos los datos crudos del equipo y sus partidos
   */
  async fetchTeamDashboardData(teamId) {
    try {
      // 1. Obtener datos del equipo
      const { data: team } = await this.supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .maybeSingle();

      // 2. Obtener partidos
      const { data: games } = await this.supabase
        .from("games")
        .select("*")
        .eq("team_id", teamId)
        .order("date", { ascending: true });

      const playedGames = StatsEngine.filterPlayedGames(games || []);
      const playedGameIds = playedGames.map((g) => g.id);

      // 3. Obtener team_game_stats
      let teamStats = [];
      if (playedGameIds.length > 0) {
        const { data: statsData } = await this.supabase
          .from("team_game_stats")
          .select("*")
          .in("game_id", playedGameIds);
        teamStats = statsData || [];
      }

      // 4. Obtener catálogo de jugadores
      const { data: players } = await this.supabase
        .from("players")
        .select("*")
        .eq("team_id", teamId);

      const playersMap = new Map((players || []).map((p) => [p.id, p]));

      // 5. Obtener estadísticas individuales
      let playerStats = [];
      if (playedGameIds.length > 0) {
        const { data: pStats } = await this.supabase
          .from("player_game_stats")
          .select("*")
          .in("game_id", playedGameIds);
        playerStats = pStats || [];
      }

      return {
        teamName: team?.name || "JMJ Manyanet Sant Andreu",
        category: team?.category || "Cadete Masculino",
        season: "2026",
        playedGames,
        teamStats,
        playerStats,
        playersMap,
        isSuccess: true
      };
    } catch (error) {
      console.error("[StatsSyncService] Error al cargar datos:", error);
      return { isSuccess: false, error: error.message };
    }
  }

  /**
   * Sincroniza y guarda los totales calculados en la tabla team_game_stats
   */
  async persistGameTotals(gameId, totals) {
    if (!this.supabase || !gameId) return;

    try {
      await this.supabase
        .from("team_game_stats")
        .upsert({ game_id: gameId, ...totals }, { onConflict: "game_id" });
    } catch (err) {
      console.error(`[StatsSyncService] Error guardando totales del partido ${gameId}:`, err);
    }
  }

  /**
   * 🔄 AUDITORÍA Y RESINCRONIZACIÓN AUTOMÁTICA
   * Lee la base de datos de Supabase, detecta inconsistencias (puntos, valoración FIBA 'evaluation', PPG)
   * y los recalcula e inyecta de golpe.
   */
  async runFullAuditAndSync(teamId) {
    if (!this.supabase) {
      console.error("[StatsSyncService] Sin conexión a Supabase.");
      return { success: false, message: "No hay conexión con Supabase." };
    }

    try {
      console.log("🔄 [StatsSyncService] Iniciando auditoría completa de datos...");

      // -------------------------------------------------------------
      // 1. REVISAR Y CORREGIR player_game_stats (Puntos y Valoración)
      // -------------------------------------------------------------
      const { data: allPlayerStats, error: pgsErr } = await this.supabase
        .from("player_game_stats")
        .select("*");

      if (pgsErr) throw pgsErr;

      const playerStatsToUpdate = [];
      const playerGamesMap = {}; // Para calcular el PPG acumulado por jugador

      (allPlayerStats || []).forEach((row) => {
        const fg2m = Number(row.fg2_made || 0);
        const fg2a = Number(row.fg2_attempted || 0);
        const fg3m = Number(row.fg3_made || 0);
        const fg3a = Number(row.fg3_attempted || 0);
        const ftm  = Number(row.ft_made || 0);
        const fta  = Number(row.ft_attempted || 0);

        // Recálculo real de puntos
        const calculatedPoints = (fg2m * 2) + (fg3m * 3) + ftm;
        const pts = (row.points !== null && row.points !== undefined && Number(row.points) > 0)
          ? Number(row.points)
          : calculatedPoints;

        // Recálculo real de valoración FIBA (guardada en 'evaluation')
        const offReb = Number(row.off_reb || row.rebounds_offensive || 0);
        const defReb = Number(row.def_reb || row.rebounds_defensive || 0);
        const ast    = Number(row.assists || 0);
        const stl    = Number(row.steals || 0);
        const blk    = Number(row.blocks || 0);
        const turn   = Number(row.turnovers || 0);
        const fouls  = Number(row.fouls_committed || 0);

        const missedFg = (fg2a - fg2m) + (fg3a - fg3m);
        const missedFt = fta - ftm;
        const calculatedEval = (pts + offReb + defReb + ast + stl + blk) - (missedFg + missedFt + turn + fouls);

        // Detectar si los puntos o la valoración FIBA no estaban calculados o eran incorrectos
        const needsUpdate = 
          row.points !== pts || 
          row.evaluation === null || 
          row.evaluation === undefined ||
          Number(row.evaluation) !== calculatedEval;

        if (needsUpdate) {
          playerStatsToUpdate.push({
            id: row.id,
            game_id: row.game_id,
            player_id: row.player_id,
            points: pts,
            evaluation: calculatedEval
          });
        }

        // Guardar para el acumulado de PPG por jugador
        if (row.player_id) {
          if (!playerGamesMap[row.player_id]) {
            playerGamesMap[row.player_id] = { totalPoints: 0, gamesPlayed: 0 };
          }
          playerGamesMap[row.player_id].totalPoints += pts;
          playerGamesMap[row.player_id].gamesPlayed += 1;
        }
      });

      // Inyectar correcciones en player_game_stats
      if (playerStatsToUpdate.length > 0) {
        console.log(`🛠️ [StatsSyncService] Corrigiendo ${playerStatsToUpdate.length} filas en 'player_game_stats'...`);
        const { error: upsertErr } = await this.supabase
          .from("player_game_stats")
          .upsert(playerStatsToUpdate);

        if (upsertErr) console.warn("[StatsSyncService] Warning en upsert player_game_stats:", upsertErr);
      }

      // -------------------------------------------------------------
      // 2. REVISAR Y CORREGIR PROMEDIOS (ppg) EN LA TABLA players
      // -------------------------------------------------------------
      let playersQuery = this.supabase.from("players").select("id, ppg, team_id");
      if (teamId) playersQuery = playersQuery.eq("team_id", teamId);
      const { data: playersList } = await playersQuery;

      const playersToUpdate = [];
      (playersList || []).forEach((p) => {
        const stats = playerGamesMap[p.id];
        const realPpg = (stats && stats.gamesPlayed > 0)
          ? Number((stats.totalPoints / stats.gamesPlayed).toFixed(1))
          : 0.0;

        if (p.ppg !== realPpg) {
          playersToUpdate.push({
            id: p.id,
            team_id: p.team_id,
            ppg: realPpg
          });
        }
      });

      if (playersToUpdate.length > 0) {
        console.log(`🛠️ [StatsSyncService] Actualizando PPG real de ${playersToUpdate.length} jugadores...`);
        for (const pUp of playersToUpdate) {
          await this.supabase.from("players").update({ ppg: pUp.ppg }).eq("id", pUp.id);
        }
      }

      // -------------------------------------------------------------
      // 3. REVISAR game_period_scores DESDE LA TABLA games
      // -------------------------------------------------------------
      let gamesQuery = this.supabase.from("games").select("*");
      if (teamId) gamesQuery = gamesQuery.eq("team_id", teamId);
      const { data: gamesList } = await gamesQuery;

      const { data: existingPeriods } = await this.supabase.from("game_period_scores").select("game_id");
      const existingGameIdsWithPeriods = new Set((existingPeriods || []).map((p) => p.game_id));

      const missingPeriodInserts = [];
      (gamesList || []).forEach((g) => {
        if (!existingGameIdsWithPeriods.has(g.id)) {
          missingPeriodInserts.push({
            game_id: g.id,
            period_type: "REGULAR",
            period_number: 1,
            team_score: g.our_score ?? g.team_score ?? 0,
            opponent_score: g.opp_score ?? g.opponent_score ?? 0,
            is_overtime: false
          });
        }
      });

      if (missingPeriodInserts.length > 0) {
        console.log(`🛠️ [StatsSyncService] Inyectando ${missingPeriodInserts.length} periodos faltantes en 'game_period_scores'...`);
        await this.supabase.from("game_period_scores").insert(missingPeriodInserts);
      }

      console.log("✅ [StatsSyncService] Auditoría y resincronización completadas con éxito.");
      return {
        success: true,
        statsFixed: playerStatsToUpdate.length,
        ppgFixed: playersToUpdate.length,
        periodsFixed: missingPeriodInserts.length
      };

    } catch (err) {
      console.error("❌ [StatsSyncService] Error durante la auditoría:", err);
      return { success: false, error: err.message };
    }
  }
}