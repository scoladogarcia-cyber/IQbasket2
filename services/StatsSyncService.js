/**
 * @fileoverview Servicio de Persistencia e Integración con Supabase.
 * Lee y sincroniza datos de games, team_game_stats, player_game_stats y players.
 */

import { StatsEngine } from "../engine/StatsEngine.js";

export class StatsSyncService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  /**
   * Obtiene todos los datos reales mapeando los nombres exactos de columnas de Supabase.
   */
  async fetchTeamDashboardData(teamId) {
    try {
      // 1. Obtener datos del equipo desde 'teams'
      let team = null;
      if (teamId) {
        const { data: teamData } = await this.supabase
          .from("teams")
          .select("*")
          .eq("id", teamId)
          .maybeSingle();
        team = teamData;
      } else {
        const { data: teamsList } = await this.supabase.from("teams").select("*").limit(1);
        team = teamsList && teamsList.length > 0 ? teamsList[0] : null;
      }

      const activeTeamId = teamId || team?.id;

      // 2. Obtener partidos de 'games'
      let gamesQuery = this.supabase.from("games").select("*").order("date", { ascending: true });
      if (activeTeamId) gamesQuery = gamesQuery.eq("team_id", activeTeamId);
      const { data: games } = await gamesQuery;

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
      } else {
        const { data: allTeamStats } = await this.supabase.from("team_game_stats").select("*");
        teamStats = allTeamStats || [];
      }

      // 4. Obtener catálogo de jugadores de 'players'
      let playersQuery = this.supabase.from("players").select("*");
      if (activeTeamId) playersQuery = playersQuery.eq("team_id", activeTeamId);
      const { data: players } = await playersQuery;
      const playersMap = new Map((players || []).map((p) => [p.id, p]));

      // 5. Obtener estadísticas individuales de 'player_game_stats'
      let playerStats = [];
      if (playedGameIds.length > 0) {
        const { data: pStats } = await this.supabase
          .from("player_game_stats")
          .select("*")
          .in("game_id", playedGameIds);
        playerStats = pStats || [];
      } else {
        const { data: allPStats } = await this.supabase.from("player_game_stats").select("*");
        playerStats = allPStats || [];
      }

      return {
        team: team || {},
        teamName: team?.name || "JMJ Manyanet Sant Andreu",
        category: team?.category || "Cadete Masculino",
        season: "2026",
        playedGames: playedGames.length > 0 ? playedGames : (games || []),
        teamStats,
        playerStats,
        playersMap,
        isSuccess: true
      };
    } catch (error) {
      console.error("[StatsSyncService] Error cargando datos:", error);
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
   * 🔄 AUDITORÍA, RECÁLCULO Y VOLCADO DIRECTO EN PLAYER_GAME_STATS, TEAM_GAME_STATS Y PLAYERS
   */
  async runFullAuditAndSync(teamId, memoryRows = null) {
    if (!this.supabase) {
      return { success: false, message: "Sin conexión a Supabase." };
    }

    try {
      console.log("🔄 [StatsSyncService] Auditando y actualizando tablas de Supabase...");

      let rowsToProcess = memoryRows;
      if (!rowsToProcess || !Array.isArray(rowsToProcess) || rowsToProcess.length === 0) {
        const { data: allPlayerStats } = await this.supabase.from("player_game_stats").select("*");
        rowsToProcess = allPlayerStats || [];
      }

      const playerGamesMap = {};
      let updatedStatsCount = 0;

      // 1. RECALCULAR E INYECTAR EN player_game_stats
      for (const row of rowsToProcess) {
        const computed = StatsEngine.calculatePlayerStats(row);

        if (row.id) {
          const { error: updateErr } = await this.supabase
            .from("player_game_stats")
            .update({
              points: computed.points,
              evaluation: computed.evaluation,
              game_score: computed.gameScore,
              offensive_rating: computed.indOrtg,
              true_shooting_pct: computed.tsPct,
              efg_pct: computed.eFG
            })
            .eq("id", row.id);

          if (!updateErr) updatedStatsCount++;
        }

        if (row.player_id) {
          if (!playerGamesMap[row.player_id]) {
            playerGamesMap[row.player_id] = { totalPoints: 0, gamesPlayed: 0 };
          }
          playerGamesMap[row.player_id].totalPoints += (computed.points || 0);
          playerGamesMap[row.player_id].gamesPlayed += 1;
        }
      }

      // 2. RECALCULAR E INYECTAR EN team_game_stats
      const { data: allTeamStats } = await this.supabase.from("team_game_stats").select("*");
      for (const tRow of (allTeamStats || [])) {
        const computedTeam = StatsEngine.calculateTeamStats(tRow);

        await this.supabase
          .from("team_game_stats")
          .update({
            points: computedTeam.points,
            opp_points: computedTeam.opp_points,
            estimated_possessions: computedTeam.estimated_possessions,
            pace: computedTeam.pace,
            ortg: computedTeam.ortg,
            drtg: computedTeam.drtg,
            net_rating: computedTeam.net_rating,
            efg: computedTeam.efg
          })
          .eq("id", tRow.id);
      }

      // 3. REVISAR Y SOBREESCRIBIR PROMEDIOS (ppg) EN LA TABLA players
      let playersQuery = this.supabase.from("players").select("id, ppg, team_id");
      if (teamId) playersQuery = playersQuery.eq("team_id", teamId);
      const { data: playersList } = await playersQuery;

      let updatedPlayersCount = 0;
      for (const p of (playersList || [])) {
        const stats = playerGamesMap[p.id];
        const realPpg = (stats && stats.gamesPlayed > 0)
          ? Number((stats.totalPoints / stats.gamesPlayed).toFixed(1))
          : 0.0;

        const { error: pErr } = await this.supabase
          .from("players")
          .update({ ppg: realPpg })
          .eq("id", p.id);

        if (!pErr) updatedPlayersCount++;
      }

      console.log(`✅ [StatsSyncService] Éxito: ${updatedStatsCount} stats y ${updatedPlayersCount} promedios actualizados.`);

      return {
        success: true,
        statsFixed: updatedStatsCount,
        ppgFixed: updatedPlayersCount
      };

    } catch (err) {
      console.error("❌ [StatsSyncService] Error en resincronización:", err);
      return { success: false, error: err.message || err };
    }
  }
}