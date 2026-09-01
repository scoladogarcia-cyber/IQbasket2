/**
 * @fileoverview Vista de Registro Rápido e Interactivo en Vivo: EasyStatsEntryView.js
 * @description Sistema triple de entrada de estadísticas:
 * 1) Modo Pista (Visual con Shot Chart interactivo y cálculo geométrico de triples).
 * 2) Modo Rápido (Botones táctiles de 44px+ optimizados para banquillo/mesa).
 * 3) Modo Acta Oficial (Tabla matricial editable con cuadre de cuartos Q1-Q4 y recálculo en vivo).
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { Permission } from "../security/PermissionService.js";


export class EasyStatsEntryView {
  /**
   * Crea una instancia de EasyStatsEntryView.
   * @param {Object} [gameController=null] - Controlador de partidos.
   * @param {Object} [authController=null] - Controlador de autenticación.
   * @param {Object} [i18nService=null] - Servicio de internacionalización.
   * @param {string} [gameId=null] - ID del partido activo.
   */
  constructor(gameController = null, authController = null, i18nService = null, gameId = null) {
    this.gameController = gameController;
    this.authController = authController;
    this.i18n = i18nService;
    this.gameId = gameId;
    this.game = null;
    this.players = [];
    this.gameStats = [];
    this.periodScores = [];
    this.activeMode = "acta"; // 'pista' | 'rapido' | 'acta'
    this.selectedPlayerId = null;
    this.selectedPlayerName = null;
    this.actionHistory = [];
    this.pendingShot = null;
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  _canAccess() {
    return Boolean(this.authController?.canPreview?.(Permission.EDIT_GAME));
  }

  async render(containerId = "dashboard-content-area", gameId = null) {
    const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!container) return;
    this.container = container;
    if (gameId) this.gameId = gameId;

    if (!this._canAccess()) {
      this.renderAccessDenied();
      return;
    }

    const allGames = DataStore.getGames() || [];
    this.game = (this.gameId ? allGames.find(g => String(g.id) === String(this.gameId)) : null) || allGames[0] || {};
    this.players = DataStore.getPlayers(this.game.team_id || DataStore.getActiveTeamId()) || [];
    this.gameStats = DataStore.getPlayerGameStats(null, this.game.id) || [];
    this.periodScores = DataStore.getGamePeriodScores(this.game.id) || [];

    this.renderLayout();
    this.bindEvents();
  }

  renderAccessDenied() {
    this.container.innerHTML = `
      <div style="max-width: 520px; margin: 40px auto; padding: 28px; background: #ffffff; border-radius: 12px; border: 1px solid #fee2e2; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); font-family: var(--font-family-base, system-ui);">
        <div style="font-size: 3rem; margin-bottom: 12px;">🔒</div>
        <h2 style="font-size: 1.3rem; font-weight: 800; color: #991b1b; margin: 0 0 8px 0;">
          ${this.t("auth_error_title", "Acceso Restringido")}
        </h2>
        <p style="font-size: 0.95rem; color: #475569; line-height: 1.5; margin: 0 0 16px 0;">
          ${this.t("easy_entry.access_denied_desc", "La entrada y edición de estadísticas está reservada exclusivamente para roles técnicos y analistas.")}
        </p>
        <button id="btn-back-dashboard" style="background: #0f172a; color: #ffffff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 700; cursor: pointer; min-height: 44px;">
          ${this.t("back_to_list", "Volver al Inicio")}
        </button>
      </div>
    `;

    this.container.querySelector("#btn-back-dashboard")?.addEventListener("click", () => {
      window.location.hash = "#/dashboard";
    });
  }

  renderLayout() {
    const isHome = this.game.venue === "Local" || this.game.is_home;
    const opponentName = this.game.opponent || this.game.opponentName || "Rival";
    const teamName = DataStore.getTeamById(this.game.team_id)?.name || "JMJ Manyanet Sant Andreu";
    const homeName = isHome ? teamName : opponentName;
    const awayName = isHome ? opponentName : teamName;
    const homeScore = Number(this.game.team_score ?? this.game.teamScore ?? 0);
    const awayScore = Number(this.game.opponent_score ?? this.game.opponentScore ?? 0);

    const allGames = DataStore.getGames() || [];
    const gameOptionsMarkup = allGames.map(g => `
      <option value="${g.id}" ${String(g.id) === String(this.game.id) ? 'selected' : ''}>
        ${g.date || ''} vs ${g.opponent || g.opponentName || 'Rival'} (${g.team_score ?? g.teamScore ?? 0} - ${g.opponent_score ?? g.opponentScore ?? 0})
      </option>
    `).join("");

    this.container.innerHTML = `
      <div class="easy-entry-wrapper" style="max-width: 1400px; margin: 0 auto; padding: 12px; font-family: var(--font-family-base, system-ui); box-sizing: border-box; display: flex; flex-direction: column; gap: 16px;">
        
        <!-- HEADER PRINCIPAL -->
        <header style="background: #0f172a; color: #ffffff; border-radius: 12px; padding: 14px 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px;">
          <div>
            <span style="font-size: 0.75rem; color: #f97316; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">TOMA DE DATOS & ACTA OFICIAL</span>
            <h1 style="margin: 2px 0 0 0; font-size: 1.25rem; font-weight: 900; color: #ffffff;">${homeName} vs ${awayName}</h1>
          </div>

          <!-- Marcador en Vivo -->
          <div style="display: flex; align-items: center; gap: 16px; background: #1e293b; padding: 6px 20px; border-radius: 8px; border: 1px solid #334155;">
            <span style="font-size: 1.6rem; font-weight: 900; color: #38bdf8;" id="score-home">${homeScore}</span>
            <span style="color: #94a3b8; font-weight: 900; font-size: 1.2rem;">-</span>
            <span style="font-size: 1.6rem; font-weight: 900; color: #f97316;" id="score-away">${awayScore}</span>
          </div>

          <!-- Selector de Partido y Deshacer -->
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <select id="select-change-game" style="background: #1e293b; color: #ffffff; border: 1px solid #475569; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; min-height: 44px;">
              ${gameOptionsMarkup}
            </select>
            <button id="btn-undo" style="background: #dc2626; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 0.85rem; cursor: pointer; min-height: 44px;">
              ↩ ${this.t("easy_entry.undo", "Deshacer")}
            </button>
          </div>
        </header>

        <!-- SELECTOR DE MODOS -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
          <button class="mode-selector-btn ${this.activeMode === 'pista' ? 'active-mode' : ''}" data-mode="pista" style="padding: 12px; font-size: 0.9rem; font-weight: 800; border-radius: 10px; border: 1px solid #cbd5e1; cursor: pointer; min-height: 48px; background: ${this.activeMode === 'pista' ? '#0f172a' : '#ffffff'}; color: ${this.activeMode === 'pista' ? '#ffffff' : '#334155'};">
            🏀 Modo Pista (Visual)
          </button>
          <button class="mode-selector-btn ${this.activeMode === 'rapido' ? 'active-mode' : ''}" data-mode="rapido" style="padding: 12px; font-size: 0.9rem; font-weight: 800; border-radius: 10px; border: 1px solid #cbd5e1; cursor: pointer; min-height: 48px; background: ${this.activeMode === 'rapido' ? '#0f172a' : '#ffffff'}; color: ${this.activeMode === 'rapido' ? '#ffffff' : '#334155'};">
            ⚡ Modo Rápido (Botones)
          </button>
          <button class="mode-selector-btn ${this.activeMode === 'acta' ? 'active-mode' : ''}" data-mode="acta" style="padding: 12px; font-size: 0.9rem; font-weight: 800; border-radius: 10px; border: 1px solid #cbd5e1; cursor: pointer; min-height: 48px; background: ${this.activeMode === 'acta' ? '#0f172a' : '#ffffff'}; color: ${this.activeMode === 'acta' ? '#ffffff' : '#334155'};">
            📋 Acta Oficial (Tabla & Cuadre)
          </button>
        </div>

        <!-- CONTENEDOR ACTIVO -->
        <main id="entry-main-content">
          ${this.activeMode === 'acta' ? this.renderActaMode() : (this.activeMode === 'pista' ? this.renderCourtMode() : this.renderFastMode())}
        </main>

        <!-- FEEDBACK FOOTER -->
        <footer style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; font-size: 0.85rem; color: #334155; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span id="last-action-feed" style="font-weight: 600; color: #0f172a;">${this.t("easy_entry.ready_hint", "Selecciona un jugador o modifica los datos directamente.")}</span>
          <span style="color: #64748b;">Acciones registradas: <strong id="action-count" style="color: #0f172a;">${this.actionHistory.length}</strong></span>
        </footer>
      </div>

      <style>
        .acta-input {
          width: 40px !important;
          height: 34px !important;
          text-align: center !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          background-color: #ffffff !important;
          display: inline-block !important;
          visibility: visible !important;
          box-sizing: border-box !important;
          padding: 0 !important;
          margin: 0 auto !important;
          -webkit-text-fill-color: #0f172a !important;
          line-height: normal !important;
        }
        .acta-input:focus {
          border-color: #f97316 !important;
          outline: 2px solid rgba(249, 115, 22, 0.2) !important;
        }
        .q-score-input {
          width: 44px !important;
          height: 36px !important;
          text-align: center !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          background: #ffffff !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          line-height: normal !important;
        }
      </style>
    `;
  }

  renderPlayerList() {
    return `
      <section style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px;">
        <h2 style="font-size: 0.85rem; margin: 0 0 10px 0; font-weight: 800; color: #0f172a; text-transform: uppercase;">1️⃣ ${this.t("players", "JUGADORES")}</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: 8px;">
          ${this.players.map(p => `
            <button type="button"
                    class="player-card-btn ${this.selectedPlayerId === p.id ? 'active-player' : ''}" 
                    data-player-id="${p.id}"
                    data-player-name="#${p.jersey ?? p.number ?? '-'} ${p.first_name || ''} ${p.last_name || ''}".trim()
                    style="display: flex; flex-direction: column; align-items: center; padding: 10px 4px; border: 2px solid ${this.selectedPlayerId === p.id ? '#f97316' : '#e2e8f0'}; background: ${this.selectedPlayerId === p.id ? '#fff7ed' : '#f8fafc'}; border-radius: 8px; cursor: pointer; min-height: 48px;">
              <span style="font-size: 1.2rem; font-weight: 900; color: #0f172a;">#${p.jersey ?? p.number ?? '-'}</span>
              <span style="font-size: 0.75rem; font-weight: 700; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75px;">${p.first_name || p.name || 'Jugador'}</span>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  renderFastMode() {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
        ${this.renderPlayerList()}
        
        <section style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
          <h2 style="font-size: 0.85rem; margin: 0; font-weight: 800; color: #0f172a; text-transform: uppercase;">2️⃣ ${this.t("easy_entry.add_action", "Registrar Acción")}</h2>
          
          <div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #16a34a; margin-bottom: 4px;">CANASTAS CONVERTIDAS</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <button class="action-btn" data-action="FGM2" data-pts="2" style="background: #22c55e; color: #ffffff; border: none; padding: 14px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer; min-height: 48px;">+2 Canasta</button>
              <button class="action-btn" data-action="FGM3" data-pts="3" style="background: #16a34a; color: #ffffff; border: none; padding: 14px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer; min-height: 48px;">+3 Triple</button>
              <button class="action-btn" data-action="FTM" data-pts="1" style="background: #84cc16; color: #ffffff; border: none; padding: 14px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer; min-height: 48px;">+1 Libre</button>
            </div>
          </div>

          <div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #dc2626; margin-bottom: 4px;">TIROS FALLADOS</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <button class="action-btn" data-action="FGA2_MISS" data-pts="0" style="background: #f87171; color: #ffffff; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">Fallo T2</button>
              <button class="action-btn" data-action="FGA3_MISS" data-pts="0" style="background: #ef4444; color: #ffffff; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">Fallo T3</button>
              <button class="action-btn" data-action="FTA_MISS" data-pts="0" style="background: #fca5a5; color: #7f1d1d; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">Fallo TL</button>
            </div>
          </div>

          <div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #0284c7; margin-bottom: 4px;">REBOTES / FALTAS / PÉRDIDAS</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
              <button class="action-btn" data-action="DREB" style="background: #38bdf8; color: #0f172a; border: none; padding: 10px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; min-height: 44px;">Reb Def</button>
              <button class="action-btn" data-action="OREB" style="background: #7dd3fc; color: #0f172a; border: none; padding: 10px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; min-height: 44px;">Reb Of</button>
              <button class="action-btn" data-action="FOUL" style="background: #fbbf24; color: #78350f; border: none; padding: 10px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; min-height: 44px;">Falta</button>
              <button class="action-btn" data-action="TOV" style="background: #fb923c; color: #7c2d12; border: none; padding: 10px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; min-height: 44px;">Pérdida</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  renderCourtMode() {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start;">
        ${this.renderPlayerList()}
        
        <section style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; align-items: center;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 8px; width: 100%; display: flex; justify-content: space-between;">
            <span>📍 Toca el punto exacto en la pista</span>
            <span id="shot-status-hint" style="color: #f97316; font-weight: 800;">Paso 2: Toca el punto</span>
          </div>

          <div style="position: relative; width: 100%; max-width: 440px; aspect-ratio: 50/47; background: #d97736; border: 3px solid #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); cursor: crosshair;" id="court-canvas-container">
            <svg viewBox="0 0 500 470" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none;">
              <rect x="0" y="0" width="500" height="470" fill="none" stroke="#fff" stroke-width="4"/>
              <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.15)" stroke="#fff" stroke-width="3"/>
              <path d="M 170 190 A 80 80 0 0 0 330 190" fill="none" stroke="#fff" stroke-width="3"/>
              <path d="M 170 190 A 80 80 0 0 1 330 190" stroke-dasharray="8,8" fill="none" stroke="#fff" stroke-width="2"/>
              <line x1="220" y1="40" x2="280" y2="40" stroke="#fff" stroke-width="4"/>
              <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
              <path d="M 215 52 A 35 35 0 0 0 285 52" fill="none" stroke="#fff" stroke-width="2"/>
              <line x1="30" y1="0" x2="30" y2="140" stroke="#fff" stroke-width="3"/>
              <line x1="470" y1="0" x2="470" y2="140" stroke="#fff" stroke-width="3"/>
              <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#fff" stroke-width="3"/>
            </svg>
            <div id="shot-markers-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
          </div>
        </section>

        <section style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
          <h2 style="font-size: 0.85rem; margin: 0; font-weight: 800; color: #0f172a; text-transform: uppercase;">3️⃣ Resultado del Tiro</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button class="shot-outcome-btn" data-made="true" style="background: #22c55e; color: #ffffff; border: none; padding: 14px 8px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer; min-height: 48px;">
              ✔ ${this.t("made", "CONVERTIDO")}
            </button>
            <button class="shot-outcome-btn" data-made="false" style="background: #ef4444; color: #ffffff; border: none; padding: 14px 8px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer; min-height: 48px;">
              ✖ ${this.t("missed", "FALLADO")}
            </button>
          </div>

          <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; margin-top: 10px; text-transform: uppercase;">OTRAS ACCIONES RÁPIDAS</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <button class="action-btn" data-action="FTM" data-pts="1" style="background: #84cc16; color: #ffffff; border: none; padding: 10px; border-radius: 6px; font-weight: 700; cursor: pointer; min-height: 44px;">+1 Libre</button>
            <button class="action-btn" data-action="DREB" style="background: #0284c7; color: #ffffff; border: none; padding: 10px; border-radius: 6px; font-weight: 700; cursor: pointer; min-height: 44px;">Rebote</button>
            <button class="action-btn" data-action="FOUL" style="background: #f59e0b; color: #ffffff; border: none; padding: 10px; border-radius: 6px; font-weight: 700; cursor: pointer; min-height: 44px;">Falta</button>
            <button class="action-btn" data-action="TOV" style="background: #ea580c; color: #ffffff; border: none; padding: 10px; border-radius: 6px; font-weight: 700; cursor: pointer; min-height: 44px;">Pérdida</button>
          </div>
        </section>
      </div>
    `;
  }

  renderActaMode() {
    const getQuarterScore = (pNum, isOpp = false) => {
      const p = this.periodScores.find(ps => Number(ps.period_number) === pNum);
      if (p) return isOpp ? Number(p.opponent_score || 0) : Number(p.team_score || 0);
      if (this.game.periods && Array.isArray(this.game.periods)) {
        const gp = this.game.periods[pNum - 1];
        if (gp) return isOpp ? Number(gp.opponent_score || 0) : Number(gp.team_score || 0);
      }
      return 0;
    };

    const qScores = [1, 2, 3, 4].map(q => ({
      quarter: q,
      team: getQuarterScore(q, false),
      opp: getQuarterScore(q, true)
    }));

    const rowsHtml = this.players.map(p => {
      const st = this.gameStats.find(s => String(s.player_id ?? s.playerId) === String(p.id)) || {};

      const valMin = Number(st.minutes ?? st.minutesPlayed ?? 0);
      const valFg2m = Number(st.fg2_made ?? st.fg2Made ?? 0);
      const valFg2a = Number(st.fg2_attempted ?? st.fg2Attempted ?? 0);
      const valFg3m = Number(st.fg3_made ?? st.fg3Made ?? 0);
      const valFg3a = Number(st.fg3_attempted ?? st.fg3Attempted ?? 0);
      const valFtm = Number(st.ft_made ?? st.ftMade ?? 0);
      const valFta = Number(st.ft_attempted ?? st.ftAttempted ?? 0);
      const valRo = Number(st.off_reb ?? st.offReb ?? 0);
      const valRd = Number(st.def_reb ?? st.defReb ?? 0);
      const valAst = Number(st.assists ?? st.ast ?? 0);
      const valRob = Number(st.steals ?? st.stl ?? 0);
      const valTap = Number(st.blocks ?? st.blocks_made ?? st.blk ?? 0);
      const valPer = Number(st.turnovers ?? st.tov ?? 0);
      const valFc = Number(st.fouls_committed ?? st.fouls ?? 0);
      const valFr = Number(st.fouls_drawn ?? st.fouls_received ?? 0);
      const valPts = st.points !== undefined && st.points !== null ? Number(st.points) : (valFg2m * 2 + valFg3m * 3 + valFtm);

      const computed = BoxScoreCalculator.calculatePlayerBoxScore({
        minutes: valMin, fg2_made: valFg2m, fg2_attempted: valFg2a,
        fg3_made: valFg3m, fg3_attempted: valFg3a, ft_made: valFtm, ft_attempted: valFta,
        off_reb: valRo, def_reb: valRd, assists: valAst, steals: valRob,
        blocks: valTap, turnovers: valPer, fouls_committed: valFc, fouls_drawn: valFr,
        points: valPts
      });

      return `
        <tr data-player-id="${p.id}" style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-weight: 800; color: #0f172a; white-space: nowrap;">
            #${p.jersey ?? p.number ?? '-'} ${p.first_name || ''} ${p.last_name || ''}
          </td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="minutes" value="${valMin}" /></td>
          <td style="padding: 6px; text-align: center; font-weight: 900; color: #1e3a8a; font-size: 14px;" class="cell-pts">${computed.points || 0}</td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fg2_made" value="${valFg2m}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fg2_attempted" value="${valFg2a}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fg3_made" value="${valFg3m}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fg3_attempted" value="${valFg3a}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="ft_made" value="${valFtm}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="ft_attempted" value="${valFta}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="off_reb" value="${valRo}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="def_reb" value="${valRd}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="assists" value="${valAst}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="steals" value="${valRob}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="blocks" value="${valTap}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="turnovers" value="${valPer}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fouls_committed" value="${valFc}" /></td>
          <td style="padding: 6px; text-align: center;"><input type="number" class="acta-input" data-field="fouls_drawn" value="${valFr}" /></td>
          <td style="padding: 6px; text-align: center; font-weight: 900; color: #a855f7; font-size: 14px;" class="cell-val">${computed.pir ?? 0}</td>
        </tr>
      `;
    }).join("");

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        
        <!-- Desglose por Cuartos -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
            <h3 style="margin: 0; font-size: 0.9rem; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              ⏱️ Desglose de Puntos por Cuartos
            </h3>
            <span id="badge-cuadre" style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 800;">
              ✅ Puntos Cuadrados: Jugadores (${this.game.team_score || 0}) = Cuartos (${this.game.team_score || 0})
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) 160px; gap: 12px; align-items: center;">
            ${qScores.map(q => `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                <span style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">Cuarto ${q.quarter} (Q${q.quarter})</span>
                <div style="display: flex; justify-content: center; align-items: center; gap: 6px;">
                  <input type="number" class="q-score-input" data-q="${q.quarter}" data-side="team" value="${q.team}" style="color: #1e3a8a !important; -webkit-text-fill-color: #1e3a8a !important;" />
                  <span style="font-weight: 800; color: #94a3b8;">-</span>
                  <input type="number" class="q-score-input" data-q="${q.quarter}" data-side="opp" value="${q.opp}" style="color: #f97316 !important; -webkit-text-fill-color: #f97316 !important;" />
                </div>
              </div>
            `).join("")}

            <div style="background: #0f172a; border-radius: 8px; padding: 12px; text-align: center; color: #ffffff;">
              <span style="font-size: 9px; font-weight: 800; letter-spacing: 0.05em; display: block; color: #94a3b8;">MARCADOR FINAL</span>
              <strong id="label-marcador-final" style="font-size: 20px; font-weight: 900; color: #38bdf8;">
                ${this.game.team_score || 0} - ${this.game.opponent_score || 0}
              </strong>
            </div>
          </div>
        </div>

        <!-- Tabla Acta Oficial -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="margin: 0; font-size: 0.9rem; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              📋 Planilla de Jugadores
            </h3>
            <button id="btn-save-acta" style="background: #f97316; color: #ffffff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; min-height: 44px;">
              💾 Guardar Acta Oficial
            </button>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; background: #f8fafc;">
                <th style="padding: 10px 12px;">JUGADOR</th>
                <th style="padding: 10px 6px; text-align: center;">MIN</th>
                <th style="padding: 10px 6px; text-align: center; color: #1e3a8a;">PTS</th>
                <th style="padding: 10px 6px; text-align: center;">T2C</th>
                <th style="padding: 10px 6px; text-align: center;">T2I</th>
                <th style="padding: 10px 6px; text-align: center;">T3C</th>
                <th style="padding: 10px 6px; text-align: center;">T3I</th>
                <th style="padding: 10px 6px; text-align: center;">TLC</th>
                <th style="padding: 10px 6px; text-align: center;">TLI</th>
                <th style="padding: 10px 6px; text-align: center;">RO</th>
                <th style="padding: 10px 6px; text-align: center;">RD</th>
                <th style="padding: 10px 6px; text-align: center;">AST</th>
                <th style="padding: 10px 6px; text-align: center;">ROB</th>
                <th style="padding: 10px 6px; text-align: center;">TAP</th>
                <th style="padding: 10px 6px; text-align: center;">PER</th>
                <th style="padding: 10px 6px; text-align: center;">FC</th>
                <th style="padding: 10px 6px; text-align: center;">FR</th>
                <th style="padding: 10px 6px; text-align: center; color: #a855f7;">VAL</th>
              </tr>
            </thead>
            <tbody id="acta-table-body">
              ${rowsHtml}
            </tbody>
          </table>
        </div>

      </div>
    `;
  }

  bindEvents() {
    this.container.querySelectorAll(".mode-selector-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeMode = btn.getAttribute("data-mode");
        this.renderLayout();
        this.bindEvents();
      });
    });

    this.container.querySelector("#select-change-game")?.addEventListener("change", (e) => {
      this.gameId = e.target.value;
      this.render(this.container, this.gameId);
    });

    this.container.querySelector("#btn-undo")?.addEventListener("click", () => {
      this.undoLastAction();
    });

    if (this.activeMode === "acta") {
      this.bindActaEvents();
    } else if (this.activeMode === "pista") {
      this.bindPlayerSelection();
      this.bindCourtModeActions();
    } else if (this.activeMode === "rapido") {
      this.bindPlayerSelection();
      this.bindFastModeActions();
    }
  }

  bindPlayerSelection() {
    const playerBtns = this.container.querySelectorAll(".player-card-btn");
    playerBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        this.selectedPlayerId = btn.getAttribute("data-player-id");
        this.selectedPlayerName = btn.getAttribute("data-player-name");
        
        playerBtns.forEach(b => {
          b.style.border = "2px solid #e2e8f0";
          b.style.background = "#f8fafc";
        });
        btn.style.border = "2px solid #f97316";
        btn.style.background = "#fff7ed";

        this.updateFeed(`Jugador activo: <strong>${this.selectedPlayerName}</strong>`);
      });
    });
  }

  bindFastModeActions() {
    this.container.querySelectorAll(".action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!this.selectedPlayerId) return alert(this.t("search_player", "Selecciona primero un jugador"));
        const action = btn.getAttribute("data-action");
        const pts = parseInt(btn.getAttribute("data-pts") || "0", 10);
        this.saveEvent({ action, points: pts });
      });
    });
  }

  bindCourtModeActions() {
    const courtContainer = this.container.querySelector("#court-canvas-container");
    
    courtContainer?.addEventListener("click", (e) => {
      if (!this.selectedPlayerId) return alert("Primero selecciona el jugador");

      const rect = courtContainer.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const distFromRim = Math.hypot((x - 50) * 1.5, (y - 11) * 1.5);
      const isThreePoint = distFromRim > 42 || y > 55;

      this.pendingShot = {
        x: parseFloat(x.toFixed(1)),
        y: parseFloat(y.toFixed(1)),
        shotType: isThreePoint ? "T3" : "T2"
      };

      const hintEl = this.container.querySelector("#shot-status-hint");
      if (hintEl) {
        hintEl.innerHTML = `<span style="color:#16a34a; font-weight:800;">${this.pendingShot.shotType} marcado. Pulsa CONVERTIDO o FALLADO ➔</span>`;
      }
    });

    this.container.querySelectorAll(".shot-outcome-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!this.selectedPlayerId) return alert("Selecciona un jugador");
        if (!this.pendingShot) return alert("Toca primero en la pista dónde se lanzó el tiro");

        const made = btn.getAttribute("data-made") === "true";
        const isT3 = this.pendingShot.shotType === "T3";
        const points = made ? (isT3 ? 3 : 2) : 0;
        const action = made ? (isT3 ? "FGM3" : "FGM2") : (isT3 ? "FGA3_MISS" : "FGA2_MISS");

        this.saveEvent({
          action,
          points,
          coordinates: { x: this.pendingShot.x, y: this.pendingShot.y },
          made
        });

        this.drawShotMarker(this.pendingShot.x, this.pendingShot.y, made);
        this.pendingShot = null;
        const hintEl = this.container.querySelector("#shot-status-hint");
        if (hintEl) hintEl.textContent = "Paso 2: Toca el punto";
      });
    });

    this.container.querySelectorAll(".action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!this.selectedPlayerId) return alert("Selecciona primero un jugador");
        const action = btn.getAttribute("data-action");
        const pts = parseInt(btn.getAttribute("data-pts") || "0", 10);
        this.saveEvent({ action, points: pts });
      });
    });
  }

  bindActaEvents() {
    this.container.querySelectorAll("#acta-table-body tr").forEach(tr => {
      const getVal = (field) => Number(tr.querySelector(`.acta-input[data-field="${field}"]`)?.value || 0);

      tr.querySelectorAll(".acta-input").forEach(input => {
        input.addEventListener("input", () => {
          const fg2m = getVal("fg2_made");
          const fg2a = getVal("fg2_attempted");
          const fg3m = getVal("fg3_made");
          const fg3a = getVal("fg3_attempted");
          const ftm = getVal("ft_made");
          const fta = getVal("ft_attempted");
          const ro = getVal("off_reb");
          const rd = getVal("def_reb");
          const ast = getVal("assists");
          const stl = getVal("steals");
          const blk = getVal("blocks");
          const tov = getVal("turnovers");
          const fc = getVal("fouls_committed");
          const fd = getVal("fouls_drawn");

          const comp = BoxScoreCalculator.calculatePlayerBoxScore({
            fg2_made: fg2m, fg2_attempted: fg2a,
            fg3_made: fg3m, fg3_attempted: fg3a,
            ft_made: ftm, ft_attempted: fta,
            off_reb: ro, def_reb: rd,
            assists: ast, steals: stl, blocks: blk,
            turnovers: tov, fouls_committed: fc, fouls_drawn: fd
          });

          const cellPts = tr.querySelector(".cell-pts");
          const cellVal = tr.querySelector(".cell-val");

          if (cellPts) cellPts.textContent = comp.points || 0;
          if (cellVal) cellVal.textContent = comp.pir ?? 0;
        });
      });
    });

    this.container.querySelector("#btn-save-acta")?.addEventListener("click", async () => {
      const rows = this.container.querySelectorAll("#acta-table-body tr[data-player-id]");
      const statsList = [];

      for (const item of rows) {
        const playerId = item.getAttribute("data-player-id");
        if (!playerId) continue;

        const getInpVal = (field) => Number(item.querySelector(`.acta-input[data-field="${field}"]`)?.value || 0);
        const mFg2m = getInpVal("fg2_made");
        const mFg3m = getInpVal("fg3_made");
        const mFtm = getInpVal("ft_made");
        const mPts = mFg2m * 2 + mFg3m * 3 + mFtm;

        statsList.push({
          game_id: this.game.id,
          player_id: playerId,
          minutes: getInpVal("minutes"),
          points: mPts,
          fg2_made: mFg2m,
          fg2_attempted: getInpVal("fg2_attempted"),
          fg3_made: mFg3m,
          fg3_attempted: getInpVal("fg3_attempted"),
          ft_made: mFtm,
          ft_attempted: getInpVal("ft_attempted"),
          off_reb: getInpVal("off_reb"),
          def_reb: getInpVal("def_reb"),
          rebounds_offensive: getInpVal("off_reb"),
          rebounds_defensive: getInpVal("def_reb"),
          assists: getInpVal("assists"),
          steals: getInpVal("steals"),
          blocks: getInpVal("blocks"),
          blocks_made: getInpVal("blocks"),
          turnovers: getInpVal("turnovers"),
          fouls_committed: getInpVal("fouls_committed"),
          fouls_drawn: getInpVal("fouls_drawn"),
          fouls_received: getInpVal("fouls_drawn")
        });
      }

      const updatedPeriods = [1, 2, 3, 4].map(q => ({
        period_number: q,
        period_type: "quarter",
        team_score: Number(this.container.querySelector(`.q-score-input[data-q="${q}"][data-side="team"]`)?.value || 0),
        opponent_score: Number(this.container.querySelector(`.q-score-input[data-q="${q}"][data-side="opp"]`)?.value || 0)
      }));

      const totalTeamScore = updatedPeriods.reduce((acc, p) => acc + p.team_score, 0);
      const totalOppScore = updatedPeriods.reduce((acc, p) => acc + p.opponent_score, 0);

      const updatedGame = {
        ...this.game,
        team_score: totalTeamScore,
        opponent_score: totalOppScore
      };

      await DataStore.saveGameAndStats(updatedGame, statsList, updatedPeriods);
      alert("✅ " + this.t("acta_saved_msg", "Acta Oficial guardada correctamente."));
      this.render(this.container, this.game.id);
    });
  }

  drawShotMarker(xPercent, yPercent, made) {
    const layer = this.container.querySelector("#shot-markers-layer");
    if (!layer) return;

    const marker = document.createElement("div");
    marker.style.position = "absolute";
    marker.style.left = `${xPercent}%`;
    marker.style.top = `${yPercent}%`;
    marker.style.transform = "translate(-50%, -50%)";
    marker.style.width = "12px";
    marker.style.height = "12px";
    marker.style.borderRadius = "50%";
    marker.style.background = made ? "#22c55e" : "#ef4444";
    marker.style.border = "2px solid #ffffff";
    marker.style.boxShadow = "0 0 4px rgba(0,0,0,0.5)";
    layer.appendChild(marker);
  }

  saveEvent(eventData) {
    const event = {
      id: Date.now(),
      playerId: this.selectedPlayerId,
      playerName: this.selectedPlayerName,
      ...eventData
    };

    this.actionHistory.push(event);

    if (event.points > 0) {
      const currentScore = Number(this.game.team_score ?? this.game.teamScore ?? 0);
      this.game.team_score = currentScore + event.points;
      const sc = this.container.querySelector("#score-home");
      if (sc) sc.textContent = this.game.team_score;
    }

    this.updateFeed(`✅ ${this.selectedPlayerName} - ${event.action} ${event.points > 0 ? '(+' + event.points + 'p)' : ''}`);
    
    const countEl = this.container.querySelector("#action-count");
    if (countEl) countEl.textContent = this.actionHistory.length;
    
    this.selectedPlayerId = null;
    this.selectedPlayerName = null;
    this.container.querySelectorAll(".player-card-btn").forEach(b => {
      b.style.border = "2px solid #e2e8f0";
      b.style.background = "#f8fafc";
    });
  }

  undoLastAction() {
    if (this.actionHistory.length === 0) return alert(this.t("easy_entry.nothing_to_undo", "No hay ninguna acción previa para deshacer."));
    const last = this.actionHistory.pop();
    if (last.points > 0) {
      this.game.team_score = Math.max(0, (this.game.team_score || 0) - last.points);
      const sc = this.container.querySelector("#score-home");
      if (sc) sc.textContent = this.game.team_score;
    }

    if (last.coordinates) {
      const layer = this.container.querySelector("#shot-markers-layer");
      if (layer && layer.lastChild) layer.removeChild(layer.lastChild);
    }

    this.updateFeed(`↩ Deshecho: ${last.playerName} (${last.action})`);
    const countEl = this.container.querySelector("#action-count");
    if (countEl) countEl.textContent = this.actionHistory.length;
  }

  updateFeed(html) {
    const el = this.container.querySelector("#last-action-feed");
    if (el) el.innerHTML = html;
  }
}

export default EasyStatsEntryView;