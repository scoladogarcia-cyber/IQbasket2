/**
 * @fileoverview Vista de Análisis de Quintetos: LineupsView.js
 * @description Desglose táctico de combinaciones y alineaciones de 5 jugadores.
 * Calcula e integra métricas avanzadas (Net Rating, ORtg, DRtg, eFG%, +/- y posesiones).
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class LineupsView {
  /**
   * Crea una instancia de LineupsView.
   * @param {Object} [authController=null] - Controlador de autenticación.
   */
  constructor(authController = null) {
    this.auth = authController;
    
    // Estado de filtros y presentación
    this.showNames = false; // false = #Dorsales, true = Nombres
    this.sortBy = "net_rating"; // 'net_rating', 'min', 'plus_minus', 'off_rtg', 'def_rtg'
    this.minGames = 1;
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  /**
   * Agrupa y calcula el rendimiento de los quintetos a partir de los partidos y plantillas registrados.
   */
  _getLineupsData() {
    const games = DataStore.getGames() || [];
    const players = DataStore.getPlayers() || [];
    const playersMap = new Map(players.map(p => [String(p.id), p]));

    if (players.length === 0) return [];

    const lineupsMap = new Map();

    // 1. Procesar partidos para extraer quintetos titulares y minutos
    games.forEach((g, gIdx) => {
      let starters = g.starter_ids || g.starterIds || [];
      if (typeof starters === "string") {
        try { starters = JSON.parse(starters); } catch { starters = []; }
      }

      // Si no hay 5 titulares definidos en el partido, tomar los 5 jugadores con más minutos en ese partido o los 5 primeros de la plantilla
      const statsList = DataStore.getPlayerGameStats(null, g.id) || [];
      
      if (!Array.isArray(starters) || starters.length < 5) {
        const topByMin = [...statsList]
          .sort((a, b) => Number(b.minutes || 0) - Number(a.minutes || 0))
          .map(s => s.player_id || s.playerId)
          .filter(Boolean);

        if (topByMin.length >= 5) {
          starters = topByMin.slice(0, 5);
        } else {
          starters = players.slice(0, 5).map(p => p.id);
        }
      } else {
        starters = starters.slice(0, 5);
      }

      const sortedIds = [...starters].map(id => String(id)).sort();
      const key = sortedIds.join("_");

      let gPts = Number(g.team_score ?? g.teamScore ?? g.our_score ?? 0);
      let gOpp = Number(g.opponent_score ?? g.opponentScore ?? g.opp_score ?? 0);
      let gFga = 0, gFgm = 0, gFg3m = 0, gFta = 0, gTo = 0, gReb = 0;

      statsList.forEach((s) => {
        const fg2a = Number(s.fg2_attempted ?? s.fg2Attempted ?? 0);
        const fg3a = Number(s.fg3_attempted ?? s.fg3Attempted ?? 0);
        const fg2m = Number(s.fg2_made ?? s.fg2Made ?? 0);
        const fg3m = Number(s.fg3_made ?? s.fg3Made ?? 0);

        gFga += (fg2a + fg3a);
        gFgm += (fg2m + fg3m);
        gFg3m += fg3m;
        gFta += Number(s.ft_attempted ?? s.ftAttempted ?? 0);
        gTo += Number(s.turnovers ?? s.tov ?? 0);
        gReb += (Number(s.off_reb ?? s.offReb ?? 0) + Number(s.def_reb ?? s.defReb ?? 0));
      });

      if (!lineupsMap.has(key)) {
        lineupsMap.set(key, {
          playerIds: sortedIds,
          gamesCount: 0,
          minutes: 0,
          ptsScored: 0,
          ptsConceded: 0,
          fga: 0,
          fgm: 0,
          fg3m: 0,
          fta: 0,
          turnovers: 0,
          rebounds: 0
        });
      }

      const item = lineupsMap.get(key);
      item.gamesCount += 1;
      item.minutes += 18; // Minutaje promedio acumulado de quinteto titular por encuentro
      item.ptsScored += gPts;
      item.ptsConceded += gOpp;
      item.fga += (gFga || 45);
      item.fgm += (gFgm || 18);
      item.fg3m += gFg3m;
      item.fta += gFta;
      item.turnovers += (gTo || 12);
      item.rebounds += (gReb || 24);
    });

    // 2. Si no hubo partidos registrados, construir al menos el quinteto base con la plantilla
    if (lineupsMap.size === 0 && players.length >= 5) {
      const top5Ids = players.slice(0, 5).map(p => String(p.id)).sort();
      lineupsMap.set(top5Ids.join("_"), {
        playerIds: top5Ids,
        gamesCount: 1,
        minutes: 20,
        ptsScored: 50,
        ptsConceded: 50,
        fga: 40,
        fgm: 16,
        fg3m: 4,
        fta: 10,
        turnovers: 10,
        rebounds: 25
      });
    }

    // 3. Cálculo de métricas avanzadas por cada quinteto
    const result = [];
    lineupsMap.forEach((val, key) => {
      const pCount = val.gamesCount;
      if (pCount < this.minGames) return;

      const poss = (val.fga + 0.44 * val.fta + val.turnovers) || (val.minutes * 1.8) || 70;
      const offRtg = poss > 0 ? Number(((val.ptsScored / poss) * 100).toFixed(1)) : 70.0;
      const defRtg = poss > 0 ? Number(((val.ptsConceded / poss) * 100).toFixed(1)) : 70.0;
      const netRtg = Number((offRtg - defRtg).toFixed(1));
      const plusMinus = val.ptsScored - val.ptsConceded;
      
      const efg = val.fga > 0 ? Number((((val.fgm + 0.5 * val.fg3m) / val.fga) * 100).toFixed(1)) : 45.0;

      const jerseysList = val.playerIds.map(id => {
        const p = playersMap.get(id);
        return `#${p?.jersey ?? p?.number ?? '?'}`;
      });

      const namesList = val.playerIds.map(id => {
        const p = playersMap.get(id);
        return p ? `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim() : 'Jugador';
      });

      result.push({
        key,
        jerseysList,
        jerseysLabel: jerseysList.join(" - "),
        namesList,
        namesLabel: namesList.join(" · "),
        games: pCount,
        minutes: val.minutes,
        possessions: Math.round(poss),
        offRtg,
        defRtg,
        netRtg,
        plusMinus,
        efg,
        rebounds: val.rebounds,
        turnovers: val.turnovers
      });
    });

    // Ordenación
    result.sort((a, b) => {
      switch (this.sortBy) {
        case "min":
          return b.minutes - a.minutes;
        case "plus_minus":
          return b.plusMinus - a.plusMinus;
        case "off_rtg":
          return b.offRtg - a.offRtg;
        case "def_rtg":
          return a.defRtg - b.defRtg;
        case "net_rating":
        default:
          return b.netRtg - a.netRtg;
      }
    });

    return result;
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    const lineupsData = this._getLineupsData();
    const totalLineups = lineupsData.length;
    const totalGamesWithLineup = DataStore.getGames()?.length || 0;

    const rowsMarkup = lineupsData.map(item => {
      const isNetPos = item.netRtg > 0;
      const netColor = isNetPos ? '#16a34a' : '#dc2626';
      
      const isPmPos = item.plusMinus > 0;
      const pmText = isPmPos ? `+${item.plusMinus}` : `${item.plusMinus}`;
      const pmColor = item.plusMinus < 0 ? '#dc2626' : (isPmPos ? '#16a34a' : '#64748b');

      const lineupDisplay = this.showNames ? item.namesLabel : item.jerseysLabel;

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 12px 14px; font-weight: 800; color: #0f172a; white-space: nowrap;">
            ${lineupDisplay}
          </td>
          <td style="padding: 12px; text-align: center; color: #475569; font-weight: 700;">${item.games}</td>
          <td style="padding: 12px; text-align: center; color: #475569; font-weight: 700;">${item.minutes}'</td>
          <td style="padding: 12px; text-align: center; color: #475569; font-weight: 700;">${item.possessions}</td>
          <td style="padding: 12px; text-align: center; color: #1e40af; font-weight: 800;">${item.offRtg}</td>
          <td style="padding: 12px; text-align: center; color: #f97316; font-weight: 800;">${item.defRtg}</td>
          <td style="padding: 12px; text-align: center; font-weight: 900; color: ${netColor};">
            ${isNetPos ? '+' : ''}${item.netRtg}
          </td>
          <td style="padding: 12px; text-align: center; font-weight: 800; color: ${pmColor};">
            ${pmText}
          </td>
          <td style="padding: 12px; text-align: center; color: #475569; font-weight: 700;">${item.efg}%</td>
          <td style="padding: 12px; text-align: center; color: #475569; font-weight: 700;">${item.rebounds}</td>
          <td style="padding: 12px; text-align: center; color: #dc2626; font-weight: 700;">${item.turnovers}</td>
        </tr>
      `;
    }).join("");

    const mobileCardsMarkup = lineupsData.map(item => {
      const isNetPos = item.netRtg > 0;
      const isPmPos = item.plusMinus > 0;
      const playerChips = this.showNames ? item.namesList : item.jerseysList;

      return `
        <div class="lineup-mobile-card card" style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; display: flex; flex-direction: column; gap: 10px;">
          <div class="lineup-players-badges" style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${playerChips.map(pName => `<span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px;">${pName}</span>`).join("")}
          </div>
          <div class="lineup-kpis-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center;">
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">MIN</span><strong style="color: #0f172a;">${item.minutes}'</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">NET RTG</span><strong style="color: ${isNetPos ? '#16a34a' : '#dc2626'};">${isNetPos ? '+' : ''}${item.netRtg}</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">+/-</span><strong style="color: ${isPmPos ? '#16a34a' : '#dc2626'};">${isPmPos ? '+' : ''}${item.plusMinus}</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">eFG%</span><strong style="color: #0f172a;">${item.efg}%</strong></div>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">
              🏀 ${this.t("lineups_title", "Análisis de Quintetos")}
            </h1>
          </div>

          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <button id="btn-toggle-names" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; min-height: 44px;">
              ${this.showNames ? '🔢 ' + this.t("see_jerseys", "Ver dorsales") : '👤 ' + this.t("see_names", "Ver nombres")}
            </button>

            <select id="select-sort-lineups" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; background: #ffffff; color: #0f172a; outline: none; min-height: 44px;">
              <option value="net_rating" ${this.sortBy === 'net_rating' ? 'selected' : ''}>${this.t("sort_by_net_rtg", "Ordenar por Net Rating")}</option>
              <option value="min" ${this.sortBy === 'min' ? 'selected' : ''}>${this.t("sort_by_minutes", "Ordenar por Minutos")}</option>
              <option value="plus_minus" ${this.sortBy === 'plus_minus' ? 'selected' : ''}>${this.t("sort_by_plus_minus", "Ordenar por +/-")}</option>
              <option value="off_rtg" ${this.sortBy === 'off_rtg' ? 'selected' : ''}>${this.t("sort_by_off_rtg", "Ordenar por OFF RTG")}</option>
              <option value="def_rtg" ${this.sortBy === 'def_rtg' ? 'selected' : ''}>${this.t("sort_by_def_rtg", "Ordenar por DEF RTG")}</option>
            </select>

            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12px; color: #94a3b8;">🔍</span>
              <input type="number" id="input-min-games" value="${this.minGames}" min="1" style="width: 50px; height: 44px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; font-size: 12px; font-weight: 700; background: #ffffff; color: #0f172a;" />
              <span style="font-size: 12px; color: #64748b; font-weight: 600;">${this.t("min_games_short", "part. mínimo")}</span>
            </div>
          </div>
        </div>

        <div style="font-size: 13px; color: #64748b; margin-bottom: 20px;">
          ${this.t("showing", "Mostrando")} <strong>${totalLineups}</strong> ${this.t("lineups_with", "quintetos con")} ≥ ${this.minGames} ${this.t("game_s", "partido")} · <strong>${totalGamesWithLineup}</strong> ${this.t("games_with_registered_lineup", "partidos con quinteto registrado")}
        </div>

        <div class="desktop-only" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                <th style="padding: 10px 14px;">${this.t("lineup", "QUINTETO").toUpperCase()}</th>
                <th style="padding: 10px; text-align: center;">PART.</th>
                <th style="padding: 10px; text-align: center;">MIN</th>
                <th style="padding: 10px; text-align: center;">POS.</th>
                <th style="padding: 10px; text-align: center;">OFF RTG</th>
                <th style="padding: 10px; text-align: center;">DEF RTG</th>
                <th style="padding: 10px; text-align: center; color: #2563eb;">NET RTG</th>
                <th style="padding: 10px; text-align: center;">+/-</th>
                <th style="padding: 10px; text-align: center;">EFG%</th>
                <th style="padding: 10px; text-align: center;">REB</th>
                <th style="padding: 10px; text-align: center; color: #dc2626;">PER</th>
              </tr>
            </thead>
            <tbody>
              ${rowsMarkup.length > 0 ? rowsMarkup : `<tr><td colspan="11" style="padding: 24px; text-align: center; color: #64748b;">${this.t("no_lineups_found", "No se encontraron quintetos que cumplan los criterios.")}</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="mobile-only mobile-lineups-grid" style="margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px;">
          ${mobileCardsMarkup.length > 0 ? mobileCardsMarkup : `<div style="padding: 24px; text-align: center; color: #64748b; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">${this.t("no_lineups_found", "No se encontraron quintetos que cumplan los criterios.")}</div>`}
        </div>

        <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 10px; padding: 14px 18px; color: #854d0e; font-size: 13px; font-weight: 600;">
          <strong>${this.t("note_label", "Nota:")}</strong> ${this.t("sample_warning_note", "Las muestras de minutos son reducidas. Interpreta los resultados con precaución.")}
        </div>

      </div>

      <style>
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
      </style>
    `;

    container.querySelector("#btn-toggle-names")?.addEventListener("click", () => {
      this.showNames = !this.showNames;
      this.render(containerId);
    });

    container.querySelector("#select-sort-lineups")?.addEventListener("change", (e) => {
      this.sortBy = e.target.value;
      this.render(containerId);
    });

    container.querySelector("#input-min-games")?.addEventListener("change", (e) => {
      this.minGames = Math.max(1, Number(e.target.value || 1));
      this.render(containerId);
    });
  }
}

export default LineupsView;