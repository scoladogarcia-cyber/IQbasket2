/**
 * @fileoverview Vista de Estadística Avanzada (AdvancedStatsView.js).
 * Muestra las métricas avanzadas y Four Factors (eFG%, TOV%, ORB%, FTR).
 * Permite conmutar la tabla entre el rendimiento colectivo del Equipo y el desglose de Jugadores.
 * Reparado para prevenir errores de tipo 'undefined' al calcular estadísticas.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class AdvancedStatsView {
  constructor(gameController) {
    this.controller = gameController;
    this.viewMode = "team"; // 'team' | 'players'
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    const games = DataStore.getGames() || [];
    const players = DataStore.getPlayers() || [];
    const allStats = DataStore.getPlayerGameStats() || [];

    if (games.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; color: #64748b; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
          ${TranslationStore.t("no_games_recorded", "No hay partidos registrados para analizar estadísticas avanzadas.")}
        </div>`;
      return;
    }

    // 1. CÁLCULO DE FOUR FACTORS GLOBALES DEL EQUIPO
    let totFg2m = 0, totFg2a = 0, totFg3m = 0, totFg3a = 0;
    let totFtm = 0, totFta = 0, totOffReb = 0, totTo = 0;

    (allStats || []).forEach(st => {
      totFg2m += Number(st.fg2_made || 0);
      totFg2a += Number(st.fg2_attempted || 0);
      totFg3m += Number(st.fg3_made || 0);
      totFg3a += Number(st.fg3_attempted || 0);
      totFtm  += Number(st.ft_made || 0);
      totFta  += Number(st.ft_attempted || 0);
      totOffReb += Number(st.off_reb || 0);
      totTo += Number(st.turnovers || 0);
    });

    const totFgm = totFg2m + totFg3m;
    const totFga = totFg2a + totFg3a;

    const efg = totFga > 0 ? (((totFgm + 0.5 * totFg3m) / totFga) * 100).toFixed(1) : "0.0";
    const poss = totFga + 0.44 * totFta + totTo;
    const tovPct = poss > 0 ? ((totTo / poss) * 100).toFixed(1) : "0.0";
    const estimatedOppDefReb = totOffReb * 1.8 || 100;
    const orbPct = (totOffReb + estimatedOppDefReb) > 0 ? ((totOffReb / (totOffReb + estimatedOppDefReb)) * 100).toFixed(1) : "0.0";
    const ftRate = totFga > 0 ? (totFtm / totFga).toFixed(2) : "0.00";

    // 2. CONSTRUCCIÓN DE CONTENIDO (EQUIPO O JUGADORES)
    let desktopTableMarkup = "";
    let mobileCardsMarkup = "";

    if (this.viewMode === "team") {
      const teamRows = games.map(g => {
        const isWin = Number(g.team_score || 0) > Number(g.opponent_score || 0);
        const scoreColor = isWin ? '#16a34a' : '#dc2626';

        const gStats = DataStore.getPlayerGameStats(null, g.id) || [];
        let gFg2m = 0, gFg2a = 0, gFg3m = 0, gFg3a = 0, gFtm = 0, gFta = 0, gOffReb = 0, gTo = 0;
        
        gStats.forEach(s => {
          gFg2m += Number(s.fg2_made || 0); gFg2a += Number(s.fg2_attempted || 0);
          gFg3m += Number(s.fg3_made || 0); gFg3a += Number(s.fg3_attempted || 0);
          gFtm  += Number(s.ft_made || 0);   gFta  += Number(s.ft_attempted || 0);
          gOffReb += Number(s.off_reb || 0); gTo   += Number(s.turnovers || 0);
        });

        const gFga = gFg2a + gFg3a;
        const gFgm = gFg2m + gFg3m;
        const gEfg = gFga > 0 ? (((gFgm + 0.5 * gFg3m) / gFga) * 100).toFixed(1) : "0.0";
        const gPoss = gFga + 0.44 * gFta + gTo;
        const gTov = gPoss > 0 ? ((gTo / gPoss) * 100).toFixed(1) : "0.0";
        const gFtRate = gFga > 0 ? (gFtm / gFga).toFixed(2) : "0.00";

        const venueLower = String(g.venue || '').toLowerCase();
        const isHome = venueLower === 'home' || venueLower === 'local';
        const venueText = isHome ? TranslationStore.t("local", "Local") : TranslationStore.t("visitor", "Visitante");
        const opponentText = g.opponent || TranslationStore.t("opponent", "Rival");
        const formattedDate = g.date ? I18n.formatDate(g.date) : '-';

        return `
          <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
            <td style="padding: 12px; font-weight: 700; color: #0f172a;">
              vs ${opponentText}
              <div style="font-size: 11px; color: #94a3b8; font-weight: 500;">${formattedDate} · ${venueText}</div>
            </td>
            <td style="padding: 12px; text-align: center;">
              <span style="font-weight: 900; color: ${scoreColor}; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                ${g.team_score ?? 0} - ${g.opponent_score ?? 0}
              </span>
            </td>
            <td style="padding: 12px; text-align: center; font-weight: 800; color: #7c3aed;">${gEfg}%</td>
            <td style="padding: 12px; text-align: center; font-weight: 700; color: #dc2626;">${gTov}%</td>
            <td style="padding: 12px; text-align: center; font-weight: 700; color: #2563eb;">${gOffReb}</td>
            <td style="padding: 12px; text-align: center; font-weight: 700; color: #16a34a;">${gFtRate}</td>
          </tr>
        `;
      }).join("");

      desktopTableMarkup = `
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 12px;">${TranslationStore.t("games", "PARTIDO").toUpperCase()}</th>
              <th style="padding: 12px; text-align: center;">${TranslationStore.t("score", "RESULTADO").toUpperCase()}</th>
              <th style="padding: 12px; text-align: center; color: #7c3aed;">eFG%</th>
              <th style="padding: 12px; text-align: center; color: #dc2626;">TOV%</th>
              <th style="padding: 12px; text-align: center; color: #2563eb;">REB OFF</th>
              <th style="padding: 12px; text-align: center; color: #16a34a;">FT RATE</th>
            </tr>
          </thead>
          <tbody>${teamRows}</tbody>
        </table>
      `;

      mobileCardsMarkup = games.map(g => {
        const isWin = Number(g.team_score || 0) > Number(g.opponent_score || 0);
        const gStats = DataStore.getPlayerGameStats(null, g.id) || [];
        let gFg2m = 0, gFg2a = 0, gFg3m = 0, gFg3a = 0, gTo = 0;
        
        gStats.forEach(s => {
          gFg2m += Number(s.fg2_made || 0); gFg2a += Number(s.fg2_attempted || 0);
          gFg3m += Number(s.fg3_made || 0); gFg3a += Number(s.fg3_attempted || 0);
          gTo   += Number(s.turnovers || 0);
        });

        const gFga = gFg2a + gFg3a;
        const gFgm = gFg2m + gFg3m;
        const gEfg = gFga > 0 ? (((gFgm + 0.5 * gFg3m) / gFga) * 100).toFixed(1) : "0.0";

        return `
          <div class="adv-card-mobile card" style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px;">
              <strong>vs ${g.opponent || 'Rival'}</strong>
              <span class="score-pill ${isWin ? 'pill-win' : 'pill-loss'}" style="padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 11px; background: ${isWin ? '#dcfce7' : '#fee2e2'}; color: ${isWin ? '#15803d' : '#b91c1c'};">${g.team_score ?? 0} - ${g.opponent_score ?? 0}</span>
            </div>
            <div style="display: flex; gap: 16px; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
              <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">eFG%</span><strong style="color: #7c3aed; font-size: 14px;">${gEfg}%</strong></div>
              <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">TOV</span><strong style="color: #dc2626; font-size: 14px;">${gTo}</strong></div>
            </div>
          </div>
        `;
      }).join("");

    } else {
      const playerRows = players.map(p => {
        const pStats = DataStore.getPlayerGameStats(p.id) || [];
        let pPts = 0, pFg2m = 0, pFg2a = 0, pFg3m = 0, pFg3a = 0, pAst = 0, pTo = 0, pVal = 0;
        
        pStats.forEach(s => {
          pFg2m += Number(s.fg2_made || 0); pFg2a += Number(s.fg2_attempted || 0);
          pFg3m += Number(s.fg3_made || 0); pFg3a += Number(s.fg3_attempted || 0);
          pAst  += Number(s.assists || 0);   pTo   += Number(s.turnovers || 0);
          
          if (StatsEngine && typeof StatsEngine.calculatePlayerStats === 'function') {
            const computed = StatsEngine.calculatePlayerStats(s);
            pPts += computed.points || 0;
            pVal += computed.evaluation || 0;
          }
        });

        const pFga = pFg2a + pFg3a;
        const pFgm = pFg2m + pFg3m;
        const pEfg = pFga > 0 ? (((pFgm + 0.5 * pFg3m) / pFga) * 100).toFixed(1) : "0.0";
        const astTo = pTo > 0 ? (pAst / pTo).toFixed(1) : pAst.toFixed(1);
        const gamesPlayed = pStats.length || 1;
        const valAvg = (pVal / gamesPlayed).toFixed(1);

        return `
          <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
            <td style="padding: 12px; font-weight: 700; color: #0f172a;">#${p.jersey ?? '-'} ${p.first_name || ''} ${p.last_name || ''}</td>
            <td style="padding: 12px; text-align: center; font-weight: 800;">${pPts}</td>
            <td style="padding: 12px; text-align: center; font-weight: 800; color: #7c3aed;">${pEfg}%</td>
            <td style="padding: 12px; text-align: center; font-weight: 800; color: #a855f7;">${valAvg}</td>
            <td style="padding: 12px; text-align: center; font-weight: 700; color: #166534;">${astTo}</td>
            <td style="padding: 12px; text-align: center; font-weight: 700; color: #dc2626;">${pTo}</td>
          </tr>
        `;
      }).join("");

      desktopTableMarkup = `
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 12px;">${TranslationStore.t("players", "JUGADOR").toUpperCase()}</th>
              <th style="padding: 12px; text-align: center;">${TranslationStore.t("total_points", "PTS TOTALES").toUpperCase()}</th>
              <th style="padding: 12px; text-align: center; color: #7c3aed;">eFG% ACUM.</th>
              <th style="padding: 12px; text-align: center; color: #a855f7;">VAL / PJ</th>
              <th style="padding: 12px; text-align: center; color: #166534;">RATIO AST/TO</th>
              <th style="padding: 12px; text-align: center; color: #dc2626;">${TranslationStore.t("turnovers", "PÉRDIDAS").toUpperCase()}</th>
            </tr>
          </thead>
          <tbody>${playerRows}</tbody>
        </table>
      `;

      mobileCardsMarkup = players.map(p => {
        const pStats = DataStore.getPlayerGameStats(p.id) || [];
        let pPts = 0, pFg2m = 0, pFg2a = 0, pFg3m = 0, pFg3a = 0, pVal = 0;
        
        pStats.forEach(s => {
          pFg2m += Number(s.fg2_made || 0); pFg2a += Number(s.fg2_attempted || 0);
          pFg3m += Number(s.fg3_made || 0); pFg3a += Number(s.fg3_attempted || 0);
          if (StatsEngine && typeof StatsEngine.calculatePlayerStats === 'function') {
            const computed = StatsEngine.calculatePlayerStats(s);
            pPts += computed.points || 0;
            pVal += computed.evaluation || 0;
          }
        });
        const pFga = pFg2a + pFg3a;
        const pFgm = pFg2m + pFg3m;
        const pEfg = pFga > 0 ? (((pFgm + 0.5 * pFg3m) / pFga) * 100).toFixed(1) : "0.0";

        return `
          <div class="adv-card-mobile card" style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px;">
              <strong>#${p.jersey ?? '-'} ${p.first_name || ''} ${p.last_name || ''}</strong>
              <span style="font-size: 11px; color: #64748b; font-weight: 600;">${p.primary_position || 'Jugador'}</span>
            </div>
            <div style="display: flex; gap: 16px; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
              <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">PTS</span><strong style="font-size: 14px;">${pPts}</strong></div>
              <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">eFG%</span><strong style="color: #7c3aed; font-size: 14px;">${pEfg}%</strong></div>
              <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">VAL/PJ</span><strong style="color: #a855f7; font-size: 14px;">${(pVal / (pStats.length || 1)).toFixed(1)}</strong></div>
            </div>
          </div>
        `;
      }).join("");
    }

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        
        <!-- Header y Selector de Modo -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">
              📈 ${TranslationStore.t("advanced_stats", "Estadísticas Avanzadas")} & Four Factors
            </h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
              ${TranslationStore.t("advanced_subtitle", "Factores clave de rendimiento y métricas de eficiencia.")}
            </p>
          </div>

          <!-- TOGGLE EQUIPO / JUGADORES -->
          <div style="background: #e2e8f0; padding: 4px; border-radius: 10px; display: flex; gap: 4px;">
            <button id="btn-mode-team" style="padding: 10px 18px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.viewMode === 'team' ? 'var(--color-secondary, #0f172a)' : 'transparent'}; color: ${this.viewMode === 'team' ? 'white' : '#475569'};">
              🏀 ${TranslationStore.t("team", "Equipo")}
            </button>
            <button id="btn-mode-players" style="padding: 10px 18px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.viewMode === 'players' ? 'var(--color-secondary, #0f172a)' : 'transparent'}; color: ${this.viewMode === 'players' ? 'white' : '#475569'};">
              👤 ${TranslationStore.t("players", "Jugadores")}
            </button>
          </div>
        </div>

        <!-- TARJETAS DE FOUR FACTORS GLOBALES -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 18px; background: white; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">EFECTIVE FG (eFG%)</div>
            <div style="font-size: 26px; font-weight: 900; color: #7c3aed; margin-top: 4px;">${efg}%</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${TranslationStore.t("efg_desc", "Eficiencia en tiros de campo")}</div>
          </div>

          <div class="card" style="padding: 18px; background: white; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">TURNOVER RATIO (TOV%)</div>
            <div style="font-size: 26px; font-weight: 900; color: #dc2626; margin-top: 4px;">${tovPct}%</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${TranslationStore.t("tov_desc", "Pérdidas estimadas por 100 pos.")}</div>
          </div>

          <div class="card" style="padding: 18px; background: white; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">REBOTE OFENSIVO (ORB%)</div>
            <div style="font-size: 26px; font-weight: 900; color: #2563eb; margin-top: 4px;">${orbPct}%</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${TranslationStore.t("orb_desc", "Porcentaje de rechaces ofensivos")}</div>
          </div>

          <div class="card" style="padding: 18px; background: white; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">FREE THROW RATE (FTR)</div>
            <div style="font-size: 26px; font-weight: 900; color: #16a34a; margin-top: 4px;">${ftRate}</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${TranslationStore.t("ftr_desc", "Tiros libres anotados por TC")}</div>
          </div>
        </div>

        <!-- RENDERIZADO DUAL: TABLA DESKTOP / TARJETAS MÓVIL -->
        <div class="desktop-only" style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          ${desktopTableMarkup}
        </div>

        <div class="mobile-only mobile-adv-grid" style="display: flex; flex-direction: column; gap: 12px;">
          ${mobileCardsMarkup}
        </div>

      </div>

      <style>
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
      </style>
    `;

    container.querySelector("#btn-mode-team")?.addEventListener("click", () => {
      this.viewMode = "team";
      this.render(containerId);
    });

    container.querySelector("#btn-mode-players")?.addEventListener("click", () => {
      this.viewMode = "players";
      this.render(containerId);
    });
  }
}

export default AdvancedStatsView;