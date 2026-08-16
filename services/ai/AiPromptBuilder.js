/**
 * @fileoverview Constructor Dinámico de Contexto y Prompts para el Asistente de IA: AiPromptBuilder.
 * @description Inyecta el contexto de la plantilla, partidos y analítica avanzada del equipo
 * (Four Factors, ORtg, DRtg, Net Rating, Pace, PIR y Game Score) desacoplado mediante StatsAggregator.
 * 
 * Capacidades:
 * 1. Control del idioma de respuesta según el locale activo ('es', 'ca', 'en', 'fr').
 * 2. Inyección de métricas avanzadas calculadas sin duplicación de lógica matemática.
 * 3. Formato estructurado y optimizado en tokens para LLMs (Llama, Gemini, Claude, GPT).
 * 4. Soporte para consultas tácticas contextuales (partido específico, jugador o comparativas).
 */

import { DataStore } from "../DataStore.js";
import { I18n } from "../I18nService.js";
import { APP_CONFIG } from "../../config/app.config.js";
import { StatsAggregator } from "../../domain/stats/StatsAggregator.js";
import { StatsEngine } from "../../engine/StatsEngine.js";

export class AiPromptBuilder {
  /**
   * Genera el prompt del sistema especificando el idioma y el contexto analítico del equipo.
   * @param {Object} [contextOptions={}] - Opciones de filtrado ({ targetGameId, targetPlayerId }).
   * @returns {string} Prompt estructurado para el modelo de IA.
   */
  static buildSystemPrompt(contextOptions = {}) {
    const locale = I18n.getLocale() || "es";

    const languageNames = {
      es: "Spanish (Español)",
      ca: "Catalan (Català)",
      cat: "Catalan (Català)",
      en: "English",
      fr: "French (Français)"
    };

    const targetLanguage = languageNames[locale] || "Spanish (Español)";

    const games = DataStore.getGames() || [];
    const playedGames = StatsEngine.filterPlayedGames(games);
    const players = DataStore.getPlayers() || [];
    const playerStats = DataStore.getPlayerGameStats() || [];
    const activeSeason = DataStore.getActiveSeason() || "2026";

    // 1. Resumen de Métricas de Temporada del Equipo
    const teamSummary = StatsAggregator.aggregateTeamSeasonStats(playedGames);
    let teamContext = "Sin datos suficientes de partidos finalizados.";
    if (teamSummary) {
      teamContext = `
- Partidos Jugados: ${teamSummary.record.gamesPlayed} (W: ${teamSummary.record.wins} | L: ${teamSummary.record.losses} | Win%: ${teamSummary.record.winPercentage}%)
- Puntos: ${teamSummary.points.avgFor} PPG a favor vs ${teamSummary.points.avgAgainst} PPG en contra (Diff: ${(teamSummary.points.avgFor - teamSummary.points.avgAgainst).toFixed(1)})
- Eficiencia: ORtg ${teamSummary.seasonReport.offensiveRating} | DRtg ${teamSummary.seasonReport.defensiveRating} | Net Rating ${teamSummary.seasonReport.netRating}
- Ritmo y Tiro: Pace ${teamSummary.seasonReport.pace} | eFG% ${teamSummary.seasonReport.fourFactors.team.eFG}% | TOV% ${teamSummary.seasonReport.fourFactors.team.tovPct}%
      `.trim();
    }

    // 2. Resumen Estadístico de Jugadores
    const playersSummary = players.map((p) => {
      const pRows = playerStats.filter((s) => String(s.playerId ?? s.player_id) === String(p.id));
      const seasonAgg = StatsAggregator.aggregatePlayerSeasonStats(pRows);

      if (!seasonAgg || seasonAgg.totals.gp === 0) {
        return `#${p.jersey ?? "?"} ${p.fullName || p.name || "Jugador"} (${p.position || "N/D"}): Sin partidos disputados.`;
      }

      const { averages, shooting } = seasonAgg;
      return `#${p.jersey ?? "?"} ${p.fullName || p.name || "Jugador"} (${p.position || "N/D"}): ` +
        `${averages.gp} PJ | ${averages.min} MIN | ${averages.ppg} PTS | ${averages.rpg} REB (${averages.orb} OF / ${averages.drb} DF) | ` +
        `${averages.apg} AST | ${averages.spg} STL | ${averages.bpg} BLK | ${averages.topg} TOV | ` +
        `VAL/PIR: ${averages.pir} | GameScore: ${averages.gameScore} | ` +
        `%2P: ${shooting.pct2P}% | %3P: ${shooting.pct3P}% | %TL: ${shooting.pctFT}% | eFG%: ${shooting.eFG}% | TS%: ${shooting.tsPct}%.`;
    }).join("\n");

    // 3. Histórico Reciente de Partidos
    const gamesSummary = games.map((g, i) => {
      const status = g.status || "FINISHED";
      const result = (g.teamScore !== undefined && g.opponentScore !== undefined)
        ? `${g.teamScore} - ${g.opponentScore}`
        : `${g.team_score ?? 0} - ${g.opponent_score ?? 0}`;
      const diff = Number(g.teamScore ?? g.team_score ?? 0) - Number(g.opponentScore ?? g.opponent_score ?? 0);
      const outcome = diff > 0 ? "VICTORIA" : (diff < 0 ? "DERROTA" : "EMPATE");

      return `P${i + 1} (${g.date || "Fecha N/D"}): vs ${g.opponentName || g.opponent || "Rival"} (${g.venue || "Local"}) -> ${result} (${outcome}, Diff: ${diff > 0 ? "+" + diff : diff}) [${status}]`;
    }).join("\n");

    return `
You are the Official Tactical & Statistical Basketball Analyst Assistant for ${APP_CONFIG?.appName || "IQ Basket"}.

CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST provide your ENTIRE answer strictly in ${targetLanguage}.
2. Tone: Professional, direct, highly tactical, analytical, and coach-oriented.
3. Use Markdown structuring, bullet points, and compact tables when comparing players or games.
4. Base your tactical conclusions strictly on the official dataset provided below.

=== RESUMEN COLECTIVO DEL EQUIPO (TEMPORADA ${activeSeason}) ===
${teamContext}

=== RENDIMIENTO INDIVIDUAL DE LA PLANTILLA ===
${playersSummary || "Sin datos de jugadores registrados."}

=== REGISTRO DE PARTIDOS (P1 - P${games.length}) ===
${gamesSummary || "Sin datos de partidos registrados."}
`.trim();
  }

  /**
   * Construye el prompt para la consulta del usuario enriquecido con metadatos contextuales.
   * @param {string} userQuestion - Pregunta formulada por el usuario.
   * @returns {string}
   */
  static buildUserPrompt(userQuestion) {
    return userQuestion ? String(userQuestion).trim() : "";
  }
}

export default AiPromptBuilder;