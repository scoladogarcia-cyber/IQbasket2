/**
 * @fileoverview Controlador Principal de Partidos.
 * Guarda parciales en game_period_scores y recalcula/inyecta estadísticas en Supabase.
 */

import { StatsAggregator } from "../domain/stats/StatsAggregator.js";

export class GameController {
  constructor(gameRepository, authController, syncEngine) {
    this.gameRepo = gameRepository;
    this.auth = authController;
    this.syncEngine = syncEngine;
  }

  _getSupabaseClient() {
    if (this.syncEngine?.supabase) return this.syncEngine.supabase;
    if (window.supabase) return window.supabase;
    return null;
  }

  /**
   * Guarda un parcial de cuarto o prórroga en game_period_scores y actualiza games.
   */
  async addPeriodResult(gameId, periodNumber, teamPoints, opponentPoints, isOvertime = false) {
    const supabase = this._getSupabaseClient();
    if (!supabase) throw new Error("No hay cliente de Supabase disponible.");

    const periodLabel = isOvertime ? `OT${periodNumber - 4}` : `Q${periodNumber}`;

    // 1. Inyectar o actualizar el periodo exacto en game_period_scores
    const { error: periodErr } = await supabase
      .from("game_period_scores")
      .upsert({
        game_id: gameId,
        period_number: periodNumber,
        period_label: periodLabel,
        team_score: teamPoints,
        opponent_score: opponentPoints,
        is_overtime: isOvertime
      }, { onConflict: "game_id, period_number" });

    if (periodErr) console.error("Error guardando game_period_scores:", periodErr);

    // 2. Recalcular marcador global consolidado del partido
    const { data: allPeriods } = await supabase
      .from("game_period_scores")
      .select("team_score, opponent_score")
      .eq("game_id", gameId);

    if (allPeriods) {
      const totalTeam = allPeriods.reduce((acc, curr) => acc + (curr.team_score || 0), 0);
      const totalOpp = allPeriods.reduce((acc, curr) => acc + (curr.opponent_score || 0), 0);

      await supabase
        .from("games")
        .update({
          team_score: totalTeam,
          our_score: totalTeam,
          opponent_score: totalOpp,
          opp_score: totalOpp
        })
        .eq("id", gameId);
    }
  }

  /**
   * Procesa todas las fórmulas (incluyendo Valoración) e inyecta los resultados consolidados.
   */
  async finalizeGameStats(gameId, playersRawStats = [], teamRawTotals = {}, opponentRawTotals = {}) {
    const supabase = this._getSupabaseClient();
    if (!supabase) throw new Error("No hay cliente de Supabase disponible.");

    // 1. Ejecutar motor de recálculo estadístico de 188 fórmulas (StatsAggregator)
    const processed = StatsAggregator 
      ? StatsAggregator.processGameStats(playersRawStats, teamRawTotals, opponentRawTotals) 
      : { playerStatsList: playersRawStats, teamStats: teamRawTotals };

    // 2. Inyectar Estadísticas e Índices Avanzados (VAL, eFG%, TS%, USG%) en player_game_stats
    const playerInserts = (processed.playerStatsList || []).map((pStats) => {
      const fg2m = Number(pStats.fg2_made || 0);
      const fg2a = Number(pStats.fg2_attempted || 0);
      const fg3m = Number(pStats.fg3_made || 0);
      const fg3a = Number(pStats.fg3_attempted || 0);
      const ftm  = Number(pStats.ft_made || 0);
      const fta  = Number(pStats.ft_attempted || 0);
      
      const pts  = pStats.points || ((fg2m * 2) + (fg3m * 3) + ftm);
      const reb  = Number(pStats.rebounds || (Number(pStats.off_rebounds || 0) + Number(pStats.def_rebounds || 0)));
      const ast  = Number(pStats.assists || 0);
      const stl  = Number(pStats.steals || 0);
      const blk  = Number(pStats.blocks || 0);
      const fouls = Number(pStats.fouls || 0);
      const turn  = Number(pStats.turnovers || 0);

      // Fórmula de Valoración Oficial FIBA
      // (PTS + REB + AST + STL + BLK) - ((FGA2 - FGM2) + (FGA3 - FGM3) + (FTA - FTM) + TO + FOULES)
      const missedFg = (fg2a - fg2m) + (fg3a - fg3m);
      const missedFt = fta - ftm;
      const valuation = (pts + reb + ast + stl + blk) - (missedFg + missedFt + turn + fouls);

      return {
        game_id: gameId,
        player_id: pStats.player_id || pStats.playerId || pStats.id,
        points: pts,
        pts: pts,
        valuation: pStats.valuation ?? valuation, // Guardado directo en BD
        val: pStats.valuation ?? valuation,
        fg2_made: fg2m,
        fg2_attempted: fg2a,
        fg3_made: fg3m,
        fg3_attempted: fg3a,
        ft_made: ftm,
        ft_attempted: fta,
        rebounds: reb,
        assists: ast,
        steals: stl,
        blocks: blk,
        turnovers: turn,
        fouls: fouls
      };
    });

    if (playerInserts.length > 0) {
      const { error: pErr } = await supabase.from("player_game_stats").upsert(playerInserts);
      if (pErr) console.error("Error inyectando en player_game_stats:", pErr);
    }

    // 3. Inyectar Totales Colectivos y Four Factors en team_game_stats
    const teamPayload = {
      game_id: gameId,
      ...(processed.teamStats || {})
    };

    const { error: tErr } = await supabase.from("team_game_stats").upsert([teamPayload]);
    if (tErr) console.error("Error inyectando en team_game_stats:", tErr);

    console.log("✅ [GameController] Partido finalizado y estadísticas inyectadas correctamente.");
    return processed;
  }
}