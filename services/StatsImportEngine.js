/**
 * @fileoverview Motor de Ingesta, Recálculo y Sobreescritura Estadístico (StatsImportEngine.js).
 * Toma datos brutos (CSV, API, Acta) -> Calcula Fórmulas -> Sobreescribe en Supabase.
 */

export class StatsImportEngine {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient || window.supabase;
  }

  /**
   * Recibe registros de partidos/jugadores (brutos o importados), los procesa y los sobreescribe en Supabase.
   * 
   * @param {Array<Object>} rawPlayerStatsRows - Array de objetos con estadísticas de jugadores.
   * @param {string} [teamId] - ID del equipo opcional.
   */
  async processAndOverwriteStats(rawPlayerStatsRows = [], teamId = null) {
    if (!this.supabase) {
      console.error("[StatsImportEngine] Cliente de Supabase no disponible.");
      return { success: false, error: "Sin conexión a Supabase" };
    }

    try {
      console.log(`📥 [ImportEngine] Procesando ${rawPlayerStatsRows.length} registros para sobreescritura...`);

      // 1. RECALCULAR FÓRMULAS OFICIALES FIBA PARA CADA REGISTRO
      const processedRows = rawPlayerStatsRows.map((row) => {
        const fg2m = Number(row.fg2_made || 0);
        const fg2a = Number(row.fg2_attempted || 0);
        const fg3m = Number(row.fg3_made || 0);
        const fg3a = Number(row.fg3_attempted || 0);
        const ftm  = Number(row.ft_made || 0);
        const fta  = Number(row.ft_attempted || 0);

        // Puntos Calculados Reales
        const points = (fg2m * 2) + (fg3m * 3) + ftm;

        // Valoración Oficial FIBA
        const offReb = Number(row.off_reb || row.rebounds_offensive || 0);
        const defReb = Number(row.def_reb || row.rebounds_defensive || 0);
        const ast    = Number(row.assists || 0);
        const stl    = Number(row.steals || 0);
        const blk    = Number(row.blocks || 0);
        const turn   = Number(row.turnovers || 0);
        const fouls  = Number(row.fouls_committed || 0);

        const missedFg = (fg2a - fg2m) + (fg3a - fg3m);
        const missedFt = fta - ftm;
        const evaluation = (points + offReb + defReb + ast + stl + blk) - (missedFg + missedFt + turn + fouls);

        return {
          ...(row.id ? { id: row.id } : {}),
          game_id: row.game_id,
          player_id: row.player_id,
          starter: Boolean(row.starter),
          minutes: Number(row.minutes || 0),
          fg2_made: fg2m,
          fg2_attempted: fg2a,
          fg3_made: fg3m,
          fg3_attempted: fg3a,
          ft_made: ftm,
          ft_attempted: fta,
          off_reb: offReb,
          def_reb: defReb,
          rebounds_offensive: offReb,
          rebounds_defensive: defReb,
          assists: ast,
          steals: stl,
          blocks: blk,
          turnovers: turn,
          fouls_committed: fouls,
          points: points,               // 💡 Sobreescribe con puntos calculados
          evaluation: evaluation        // 💡 Sobreescribe con valoración FIBA
        };
      });

      // 2. SOBREESCRIBIR EN player_game_stats CON UPSERT POR CLAVE ÚNICA (game_id, player_id)
      if (processedRows.length > 0) {
        const { error: pgsErr } = await this.supabase
          .from("player_game_stats")
          .upsert(processedRows, { onConflict: "game_id, player_id" });

        if (pgsErr) throw new Error(`Error en upsert player_game_stats: ${pgsErr.message}`);
      }

      // 3. RECÁLCULO AUTOMÁTICO DE LOS PROMEDIOS (PPG) EN LA TABLA players
      const playerIds = [...new Set(processedRows.map(p => p.player_id).filter(Boolean))];
      await this.syncPlayersAverages(playerIds, teamId);

      console.log("✅ [ImportEngine] Registros sobreescritos y promedios actualizados con éxito.");
      return { success: true, count: processedRows.length };

    } catch (err) {
      console.error("❌ [ImportEngine] Error en procesamiento:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Recalcula el PPG acumulado de la plantilla en la tabla `players`.
   */
  async syncPlayersAverages(playerIds = [], teamId = null) {
    try {
      let query = this.supabase.from("player_game_stats").select("player_id, points");
      if (playerIds.length > 0) query = query.in("player_id", playerIds);

      const { data: allStats } = await query;

      const playerMap = {};
      (allStats || []).forEach(r => {
        if (!r.player_id) return;
        if (!playerMap[r.player_id]) playerMap[r.player_id] = { points: 0, games: 0 };
        playerMap[r.player_id].points += Number(r.points || 0);
        playerMap[r.player_id].games += 1;
      });

      for (const [pId, st] of Object.entries(playerMap)) {
        const avgPpg = st.games > 0 ? Number((st.points / st.games).toFixed(1)) : 0;
        await this.supabase
          .from("players")
          .update({ ppg: avgPpg })
          .eq("id", pId);
      }
    } catch (e) {
      console.warn("[ImportEngine] Warning sincronizando PPG:", e.message);
    }
  }
}