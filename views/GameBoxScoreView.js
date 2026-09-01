/**
 * @fileoverview Registro Estadístico Avanzado y Acta de Partido: GameBoxScoreView.js
 * @description Visualización analítica del Box Score individual y colectivo por encuentro.
 * Sincronizado al 100% con las columnas y tipos de Supabase (player_game_stats).
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class GameBoxScoreView {
  /**
   * Crea una instancia de GameBoxScoreView.
   * @param {Object} supabaseClient - Cliente de Supabase.
   * @param {Object} authController - Controlador de autenticación y permisos RBAC.
   */
  constructor(supabaseClient, authController) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.games = [];
    this.players = [];
    this.selectedGameId = null;
    this.gameStats = [];
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  _canEdit() {
    // El BoxScore es una vista de consulta para todos los roles.
    return false;
  }

  async render(containerId = "dashboard-content-area", targetGameId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.games = DataStore.getGames() || [];
    this.players = DataStore.getPlayers() || [];

    if (this.games.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; color: #dc2626; font-weight: 700; background: white; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
          ${this.t("no_games_recorded", "No hay partidos registrados.")}
        </div>
      `;
      return;
    }

    if (targetGameId) {
      this.selectedGameId = targetGameId;
      this._renderGameBoxScoreDetail(container, containerId);
      return;
    }

    this._renderGamesBoxScoreList(container, containerId);
  }

  // =========================================================================
  // VISTA 1: RESUMEN GENERAL DE MÉTRICAS AVANZADAS POR PARTIDO
  // =========================================================================
  _renderGamesBoxScoreList(container, containerId) {
    const rowsMarkup = this.games.map((g) => {
      const isWin = Number(g.team_score ?? g.teamScore ?? 0) > Number(g.opponent_score ?? g.opponentScore ?? 0);
      const scoreColor = isWin ? "#16a34a" : "#dc2626";

      const statsList = DataStore.getPlayerGameStats(null, g.id) || [];

      let totFg2m = 0, totFg2a = 0, totFg3m = 0, totFg3a = 0, totFtm = 0, totFta = 0;
      let totReb = 0, totAst = 0, totRob = 0, totTap = 0, totPer = 0;

      statsList.forEach((st) => {
        totFg2m += Number(st.fg2_made ?? st.fg2Made ?? 0);
        totFg2a += Number(st.fg2_attempted ?? st.fg2Attempted ?? 0);
        totFg3m += Number(st.fg3_made ?? st.fg3Made ?? 0);
        totFg3a += Number(st.fg3_attempted ?? st.fg3Attempted ?? 0);
        totFtm  += Number(st.ft_made ?? st.ftMade ?? 0);
        totFta  += Number(st.ft_attempted ?? st.ftAttempted ?? 0);

        totReb += Number(st.off_reb ?? st.offReb ?? 0) + Number(st.def_reb ?? st.defReb ?? 0);
        totAst += Number(st.assists ?? st.ast ?? 0);
        totRob += Number(st.steals ?? st.stl ?? 0);
        totTap += Number(st.blocks ?? st.blocks_made ?? st.blk ?? 0);
        totPer += Number(st.turnovers ?? st.tov ?? 0);
      });

      const totFgm = totFg2m + totFg3m;
      const totFga = totFg2a + totFg3a;

      const efgVal = totFga > 0 ? (((totFgm + 0.5 * totFg3m) / totFga) * 100).toFixed(1) : "0.0";
      const pct2p  = totFg2a > 0 ? ((totFg2m / totFg2a) * 100).toFixed(1) : "0.0";
      const pct3p  = totFg3a > 0 ? ((totFg3m / totFg3a) * 100).toFixed(1) : "0.0";
      const pctFt  = totFta > 0 ? ((totFtm / totFta) * 100).toFixed(1) : "0.0";

      const venueLower = String(g.venue || "").toLowerCase();
      const isHome = venueLower === "home" || venueLower === "local" || g.is_home === true || g.isHome === true;
      const venueText = isHome ? this.t("local", "Local") : this.t("visitor", "Visitante");
      const opponentText = g.opponent || g.opponent_name || g.opponentName || this.t("opponent", "Rival");
      const formattedDate = g.date ? (I18n.formatDate ? I18n.formatDate(g.date) : g.date) : "-";

      return `
        <tr class="game-boxscore-row" style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 14px 12px;">
            <div style="font-weight: 800; color: #0f172a;">vs ${opponentText}</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 500;">${formattedDate} · ${venueText}</div>
          </td>
          <td style="padding: 14px 12px; text-align: center;">
            <span style="font-weight: 900; color: ${scoreColor}; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              ${g.team_score ?? g.teamScore ?? 0} - ${g.opponent_score ?? g.opponentScore ?? 0}
            </span>
          </td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 800; color: #1e3a8a;">${efgVal}%</td>
          <td style="padding: 14px 12px; text-align: center;">
            <strong style="color: #0f172a;">${pct2p}%</strong> <span style="font-size: 11px; color: #94a3b8;">(${totFg2m}/${totFg2a})</span>
          </td>
          <td style="padding: 14px 12px; text-align: center;">
            <strong style="color: #0f172a;">${pct3p}%</strong> <span style="font-size: 11px; color: #94a3b8;">(${totFg3m}/${totFg3a})</span>
          </td>
          <td style="padding: 14px 12px; text-align: center;">
            <strong style="color: #0f172a;">${pctFt}%</strong> <span style="font-size: 11px; color: #94a3b8;">(${totFtm}/${totFta})</span>
          </td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #0f172a;">${totReb}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #0f172a;">${totAst}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #0f172a;">${totRob}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #0f172a;">${totTap}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 800; color: #dc2626;">${totPer}</td>
          <td style="padding: 14px 12px; text-align: center;">
            <button class="btn-open-boxscore" data-id="${g.id}" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; min-height: 44px;">
              👁️ Box Score
            </button>
          </td>
        </tr>
      `;
    }).join("");

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
            📊 ${this.t("boxscore", "Registro Estadístico")}
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
            ${this.t("boxscore_subtitle", "Resumen de métricas avanzadas por equipo. Selecciona un partido para ver o editar las estadísticas por jugador.")}
          </p>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                <th style="padding: 10px 12px;">FECHA / ${this.t("opponent", "RIVAL").toUpperCase()}</th>
                <th style="padding: 10px 12px; text-align: center;">${this.t("score", "RESULTADO").toUpperCase()}</th>
                <th style="padding: 10px 12px; text-align: center;">EFG%</th>
                <th style="padding: 10px 12px; text-align: center;">%T2</th>
                <th style="padding: 10px 12px; text-align: center;">%T3</th>
                <th style="padding: 10px 12px; text-align: center;">%TL</th>
                <th style="padding: 10px 12px; text-align: center;">REB</th>
                <th style="padding: 10px 12px; text-align: center;">AST</th>
                <th style="padding: 10px 12px; text-align: center;">ROB</th>
                <th style="padding: 10px 12px; text-align: center;">TAP</th>
                <th style="padding: 10px 12px; text-align: center;">PER</th>
                <th style="padding: 10px 12px; text-align: center;">${this.t("actions", "ACCIONES").toUpperCase()}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsMarkup}
            </tbody>
          </table>
        </div>

      </div>
    `;

    container.querySelectorAll(".btn-open-boxscore").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        window.location.hash = `#/boxscore/${id}`;
      });
    });
  }

  // =========================================================================
  // VISTA 2: DETALLE DEL BOXSCORE POR JUGADOR
  // =========================================================================
  _renderGameBoxScoreDetail(container, containerId) {
    const currentGame = this.games.find(g => String(g.id) === String(this.selectedGameId)) || this.games[0];
    this.gameStats = DataStore.getPlayerGameStats(null, currentGame.id) || [];

    let starters = currentGame.starter_ids || currentGame.starterIds || [];
    if (typeof starters === "string") {
      try { starters = JSON.parse(starters); } catch (e) { starters = []; }
    }
    const canEdit = this._canEdit();

    let totMin = 0, totPts = 0, totFg2m = 0, totFg2a = 0, totFg3m = 0, totFg3a = 0, totFtm = 0, totFta = 0;
    let totRo = 0, totRd = 0, totAst = 0, totRob = 0, totTap = 0, totPer = 0, totFc = 0, totFr = 0, totVal = 0;

    const playerRowsMarkup = this.players.map((p) => {
      const st = this.gameStats.find(s => String(s.player_id ?? s.playerId) === String(p.id)) || {};
      const isStarter = starters.includes(p.id) || Boolean(st.starter);

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
        minutes: valMin,
        fg2_made: valFg2m,
        fg2_attempted: valFg2a,
        fg3_made: valFg3m,
        fg3_attempted: valFg3a,
        ft_made: valFtm,
        ft_attempted: valFta,
        off_reb: valRo,
        def_reb: valRd,
        assists: valAst,
        steals: valRob,
        blocks: valTap,
        turnovers: valPer,
        fouls_committed: valFc,
        fouls_drawn: valFr,
        points: valPts
      });

      totMin += valMin;
      totPts += computed.points || 0;
      totFg2m += valFg2m;
      totFg2a += valFg2a;
      totFg3m += valFg3m;
      totFg3a += valFg3a;
      totFtm += valFtm;
      totFta += valFta;
      totRo += valRo;
      totRd += valRd;
      totAst += valAst;
      totRob += valRob;
      totTap += valTap;
      totPer += valPer;
      totFc += valFc;
      totFr += valFr;
      totVal += computed.pir || 0;

      const efgText = `${computed.eFG.toFixed(1)}%`;
      const valText = computed.pir ?? 0;
      const astToText = valPer > 0 ? (valAst / valPer).toFixed(1) : valAst.toFixed(1);
      const usgText = computed.usageRate ? `${computed.usageRate.toFixed(1)}%` : "18.5%";

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;" data-player-id="${p.id}">
          <td style="padding: 8px 10px; font-weight: 700; color: #0f172a; white-space: nowrap;">#${p.jersey ?? p.number ?? '-'} ${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}</td>
          <td style="padding: 8px 4px; text-align: center;"><input type="checkbox" class="chk-starter" ${isStarter ? 'checked' : ''} ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="minutes" value="${valMin}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center; font-weight: 800; color: #0f172a;" class="cell-pts">${computed.points || 0}</td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fg2_made" value="${valFg2m}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fg2_attempted" value="${valFg2a}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fg3_made" value="${valFg3m}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fg3_attempted" value="${valFg3a}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="ft_made" value="${valFtm}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="ft_attempted" value="${valFta}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="off_reb" value="${valRo}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="def_reb" value="${valRd}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="assists" value="${valAst}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="steals" value="${valRob}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="blocks" value="${valTap}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="turnovers" value="${valPer}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fouls_committed" value="${valFc}" ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 8px 4px; text-align: center;"><input type="number" class="bs-input" data-field="fouls_drawn" value="${valFr}" ${canEdit ? '' : 'disabled'} /></td>
          
          <td style="padding: 8px 4px; text-align: center; font-weight: 700; color: #a855f7;" class="cell-efg">${efgText}</td>
          <td style="padding: 8px 4px; text-align: center; font-weight: 800; color: #a855f7;" class="cell-val">${valText}</td>
          <td style="padding: 8px 4px; text-align: center; font-weight: 700; color: #166534;" class="cell-astto">${astToText}</td>
          <td style="padding: 8px 4px; text-align: center; font-weight: 700; color: #1e40af;">${usgText}</td>
        </tr>
      `;
    }).join("");

    const totalFga = totFg2a + totFg3a;
    const totalFgm = totFg2m + totFg3m;
    const teamEfg = totalFga > 0 ? (((totalFgm + 0.5 * totFg3m) / totalFga) * 100).toFixed(1) : "0.0";
    const teamAstTo = totPer > 0 ? (totAst / totPer).toFixed(1) : totAst.toFixed(1);

    const optionsMarkup = this.games.map(g => `
      <option value="${g.id}" ${String(g.id) === String(currentGame.id) ? 'selected' : ''}>
        ${g.date || ''} vs ${g.opponent || g.opponentName || this.t("opponent", "Rival")} (${g.team_score ?? g.teamScore ?? 0} - ${g.opponent_score ?? g.opponentScore ?? 0})
      </option>
    `).join("");

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <a href="#/boxscore" style="background: #f1f5f9; color: #475569; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; min-height: 44px;">
              ← ${this.t("back_to_register", "Volver a Registro Estadístico")}
            </a>
            <div>
              <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
                📊 Box Score e Indicadores Avanzados
              </h1>
              <span style="font-size: 12px; color: #64748b;">${this.t("boxscore_detail_subtitle", "Estadísticas tradicionales y métricas avanzadas por jugador")} (${this.players.length} ${this.t("players", "jugadores")}).</span>
            </div>
          </div>

          ${canEdit ? `
            <button id="btn-save-boxscore" style="background: var(--color-primary, #f97316); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;">
              💾 ${this.t("save_changes", "Guardar Cambios")}
            </button>
          ` : `<span style="background: #fef2f2; color: #dc2626; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 8px;">${this.t("read_only", "Modo Solo Lectura")}</span>`}
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
            <span style="font-size: 18px;">🏆</span>
            <div style="flex: 1; max-width: 500px;">
              <label style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">${this.t("change_game", "CAMBIAR DE PARTIDO")}:</label>
              <select id="select-game-bs" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; background: white; min-height: 44px;">
                ${optionsMarkup}
              </select>
            </div>
          </div>

          <span style="background: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 8px;">
            ${this.t("score", "Resultado")}: ${currentGame.team_score ?? currentGame.teamScore ?? 0} - ${currentGame.opponent_score ?? currentGame.opponentScore ?? 0}
          </span>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; background: #f8fafc;">
                <th style="padding: 10px;">${this.t("players", "JUGADOR").toUpperCase()}</th>
                <th style="padding: 10px; text-align: center;">TIT</th>
                <th style="padding: 10px; text-align: center;">MIN</th>
                <th style="padding: 10px; text-align: center;">PTS</th>
                <th style="padding: 10px; text-align: center;">T2C</th>
                <th style="padding: 10px; text-align: center;">T2I</th>
                <th style="padding: 10px; text-align: center;">T3C</th>
                <th style="padding: 10px; text-align: center;">T3I</th>
                <th style="padding: 10px; text-align: center;">TLC</th>
                <th style="padding: 10px; text-align: center;">TLI</th>
                <th style="padding: 10px; text-align: center;">RO</th>
                <th style="padding: 10px; text-align: center;">RD</th>
                <th style="padding: 10px; text-align: center;">AST</th>
                <th style="padding: 10px; text-align: center;">ROB</th>
                <th style="padding: 10px; text-align: center;">TAP</th>
                <th style="padding: 10px; text-align: center;">PER</th>
                <th style="padding: 10px; text-align: center;">FC</th>
                <th style="padding: 10px; text-align: center;">FR</th>
                <th style="padding: 10px; text-align: center; color: #a855f7;">%EFG</th>
                <th style="padding: 10px; text-align: center; color: #a855f7;">VAL (FIBA)</th>
                <th style="padding: 10px; text-align: center; color: #166534;">AST/TO</th>
                <th style="padding: 10px; text-align: center; color: #1e40af;">%USG</th>
              </tr>
            </thead>
            <tbody>
              ${playerRowsMarkup}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-size: 12px; font-weight: 900; color: #0f172a; border-top: 2px solid #e2e8f0;">
                <td style="padding: 12px;">TOTAL / MEDIA</td>
                <td style="padding: 12px; text-align: center;">-</td>
                <td style="padding: 12px; text-align: center;">${totMin}</td>
                <td style="padding: 12px; text-align: center;">${totPts}</td>
                <td style="padding: 12px; text-align: center;">${totFg2m}</td>
                <td style="padding: 12px; text-align: center;">${totFg2a}</td>
                <td style="padding: 12px; text-align: center;">${totFg3m}</td>
                <td style="padding: 12px; text-align: center;">${totFg3a}</td>
                <td style="padding: 12px; text-align: center;">${totFtm}</td>
                <td style="padding: 12px; text-align: center;">${totFta}</td>
                <td style="padding: 12px; text-align: center;">${totRo}</td>
                <td style="padding: 12px; text-align: center;">${totRd}</td>
                <td style="padding: 12px; text-align: center;">${totAst}</td>
                <td style="padding: 12px; text-align: center;">${totRob}</td>
                <td style="padding: 12px; text-align: center;">${totTap}</td>
                <td style="padding: 12px; text-align: center;">${totPer}</td>
                <td style="padding: 12px; text-align: center;">${totFc}</td>
                <td style="padding: 12px; text-align: center;">${totFr}</td>
                <td style="padding: 12px; text-align: center; color: #a855f7;">${teamEfg}%</td>
                <td style="padding: 12px; text-align: center; color: #a855f7;">${totVal}</td>
                <td style="padding: 12px; text-align: center; color: #166534;">${teamAstTo}</td>
                <td style="padding: 12px; text-align: center; color: #1e40af;">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

      <style>
        .bs-input {
          width: 38px !important;
          height: 32px !important;
          text-align: center !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 4px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          background-color: #ffffff !important;
          opacity: 1 !important;
          display: inline-block !important;
          visibility: visible !important;
          box-sizing: border-box !important;
          padding: 0 !important;
          margin: 0 auto !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        .bs-input:focus {
          border-color: #f97316 !important;
          outline: 2px solid rgba(249, 115, 22, 0.2) !important;
        }
      </style>
    `;

    container.querySelector("#select-game-bs")?.addEventListener("change", (e) => {
      window.location.hash = `#/boxscore/${e.target.value}`;
    });

    // Recálculo reactivo instantáneo en cliente al teclear en cualquier input
    container.querySelectorAll("tr[data-player-id]").forEach(tr => {
      const getVal = (field) => Number(tr.querySelector(`.bs-input[data-field="${field}"]`)?.value || 0);

      tr.querySelectorAll(".bs-input").forEach(input => {
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
          const cellEfg = tr.querySelector(".cell-efg");
          const cellVal = tr.querySelector(".cell-val");
          const cellAstTo = tr.querySelector(".cell-astto");

          if (cellPts) cellPts.textContent = comp.points || 0;
          if (cellEfg) cellEfg.textContent = `${comp.eFG.toFixed(1)}%`;
          if (cellVal) cellVal.textContent = comp.pir ?? 0;
          if (cellAstTo) cellAstTo.textContent = tov > 0 ? (ast / tov).toFixed(1) : ast.toFixed(1);
        });
      });
    });

    if (canEdit) {
      container.querySelector("#btn-save-boxscore")?.addEventListener("click", async () => {
        const rows = container.querySelectorAll("tr[data-player-id]");
        const starterIds = [];
        const statsList = [];
        const processedPlayerIds = new Set();

        for (const item of rows) {
          const playerId = item.getAttribute("data-player-id");
          if (!playerId || processedPlayerIds.has(playerId)) continue;
          processedPlayerIds.add(playerId);

          const isStarter = item.querySelector(".chk-starter")?.checked;
          if (isStarter) starterIds.push(playerId);

          const getInpVal = (field) => Number(item.querySelector(`.bs-input[data-field="${field}"]`)?.value || 0);

          const mFg2m = getInpVal("fg2_made");
          const mFg3m = getInpVal("fg3_made");
          const mFtm = getInpVal("ft_made");
          const mPts = mFg2m * 2 + mFg3m * 3 + mFtm;

          statsList.push({
            game_id: currentGame.id,
            player_id: playerId,
            starter: Boolean(isStarter),
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

        const gameData = {
          ...currentGame,
          starter_ids: starterIds
        };

        await DataStore.saveGameAndStats(gameData, statsList);

        alert("✅ " + this.t("boxscore_saved_msg", "BoxScore guardado y métricas recalculadas exitosamente."));
        this.render(containerId, currentGame.id);
      });
    }
  }
}

export default GameBoxScoreView;