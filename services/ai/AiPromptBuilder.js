/**
 * @fileoverview Constructor dinámico de prompts para el Asistente de IA (AiPromptBuilder.js).
 * Se encarga de inyectar automáticamente el idioma activo (ES, CA, EN, FR) y el contexto completo
 * de partidos y plantilla sin saturar la vista.
 */

import { DataStore } from "../DataStore.js";
import { I18n } from "../I18nService.js";
import { APP_CONFIG } from "../../config/app.config.js";

export class AiPromptBuilder {
  /**
   * Genera el prompt del sistema especificando el idioma en el que debe responder la IA.
   */
  static buildSystemPrompt() {
    const locale = I18n.getLocale();
    
    // Mapa explícito de idiomas para el modelo Llama
    const languageNames = {
      es: "Spanish (Español)",
      ca: "Catalan (Català)",
      en: "English",
      fr: "French (Français)"
    };

    const targetLanguage = languageNames[locale] || "Spanish";

    const games = DataStore.getGames() || [];
    const players = DataStore.getPlayers() || [];
    const playerStats = DataStore.getPlayerGameStats() || [];

    const playersSummary = players.map(p => {
      const pStats = playerStats.filter(s => String(s.player_id) === String(p.id));
      let pts = 0, val = 0;
      pStats.forEach(s => {
        pts += Number(s.fg2_made || 0) * 2 + Number(s.fg3_made || 0) * 3 + Number(s.ft_made || 0);
        val += Number(s.evaluation || 0);
      });
      const pj = pStats.length || 1;
      return `#${p.jersey ?? '?'} ${p.first_name || ''} ${p.last_name || ''} (${p.primary_position || 'Jugador'}): ${pj} PJ | Promedio ${(pts / pj).toFixed(1)} PTS/partido | VAL/PJ ${(val / pj).toFixed(1)}.`;
    }).join("\n");

    const gamesSummary = games.map((g, i) => {
      return `P${i + 1} (${g.date || ''}): vs ${g.opponent || 'Rival'} (${g.venue || 'Local'}) -> Resultado: ${g.team_score ?? 0} - ${g.opponent_score ?? 0}.`;
    }).join("\n");

    return `
You are the Official Tactical Data Analytics Assistant for ${APP_CONFIG.appName} (Team: JMJ Manyanet Sant Andreu).

CRITICAL RULE:
You MUST provide your ENTIRE response strictly in ${targetLanguage}.

=== PLANTILLA / ROSTER (SEASON 2026) ===
${playersSummary || 'Sin datos de jugadores registrados.'}

=== HISTÓRICO DE PARTIDOS REGISTRADOS (P1 - Pn) ===
${gamesSummary || 'Sin datos de partidos registrados.'}

Instructions:
- Be concise, direct, professional, and tactical.
- Use bullet points when presenting lists or comparisons.
- Base your analysis strictly on the provided dataset above.
`;
  }
}

export default AiPromptBuilder;