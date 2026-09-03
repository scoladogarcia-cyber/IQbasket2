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
import { Permission } from "../security/permissions.js";
import { BoxScoreCorrectionService } from "../services/games/BoxScoreCorrectionService.js";

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
    this.boxScoreCorrectionService = new BoxScoreCorrectionService(this.supabase);
    this.canEditCurrentGame = false;
    this.currentGameEvents = [];
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  _context(game = {}) {
    return {
      teamId: game.team_id || game.teamId || DataStore.getActiveTeamId?.() || null,
      seasonId: game.season_id || game.seasonId || null,
      teamSeasonId: game.team_season_id || game.teamSeasonId || DataStore.getActiveTeamSeasonId?.() || null
    };
  }

  _frontendCanEdit(game = {}) {
    if (String(game.edit_state || game.editState || "OPEN").toUpperCase() !== "OPEN") {
      return false;
    }

    const seasonContext = DataStore.getActiveSeasonContext?.(
      game.team_id || game.teamId || DataStore.getActiveTeamId?.()
    );
    if (String(seasonContext?.data_status || seasonContext?.dataStatus || "ACTIVE").toUpperCase() === "FROZEN") {
      return false;
    }

    if (typeof this.auth?.canPreview === "function") {
      return Boolean(this.auth.canPreview(Permission.EDIT_GAME, this._context(game)));
    }
    if (typeof this.auth?.can === "function") {
      return Boolean(this.auth.can(Permission.EDIT_GAME, this._context(game)));
    }
    return false;
  }

  async _resolveCanEdit(game = {}) {
    if (!this._frontendCanEdit(game)) return false;
    try {
      return await this.boxScoreCorrectionService.canEdit(game.id);
    } catch (error) {
      console.warn("[GameBoxScoreView] Backend de corrección BoxScore no disponible:", error?.message || error);
      return false;
    }
  }

  _canEdit() {
    return Boolean(this.canEditCurrentGame);
  }

  _readOnlyMessage(game = {}) {
    if (String(game.edit_state || game.editState || "OPEN").toUpperCase() === "LOCKED") {
      return "🔒 Partido cerrado · sólo lectura";
    }

    const seasonContext = DataStore.getActiveSeasonContext?.(
      game.team_id || game.teamId || DataStore.getActiveTeamId?.()
    );
    if (String(seasonContext?.data_status || seasonContext?.dataStatus || "ACTIVE").toUpperCase() === "FROZEN") {
      return "🔒 Temporada cerrada · sólo lectura";
    }

    return this.t("read_only", "Modo solo lectura");
  }

  _playerLabel(playerId) {
    const player = this.players.find(item => String(item.id) === String(playerId));
    if (!player) return String(playerId || "Jugador");
    return [
      player.jersey ?? player.number ?? null,
      player.first_name || player.firstName || "",
      player.last_name || player.lastName || ""
    ].filter(value => value !== null && value !== "").join(" · ").replace(" · ", " #");
  }

  _collectBoxScoreState(container, currentGame) {
    const starterIds = [];
    const stats = [];
    const processed = new Set();

    container.querySelectorAll("tr[data-player-id]").forEach(row => {
      const playerId = row.getAttribute("data-player-id");
      if (!playerId || processed.has(playerId)) return;
      processed.add(playerId);

      const starter = Boolean(row.querySelector(".chk-starter")?.checked);
      if (starter) starterIds.push(playerId);

      const value = field => Number(
        row.querySelector(`.bs-input[data-field="${field}"]`)?.value || 0
      );
      const fg2Made = value("fg2_made");
      const fg3Made = value("fg3_made");
      const ftMade = value("ft_made");

      stats.push({
        game_id: currentGame.id,
        player_id: playerId,
        starter,
        minutes: value("minutes"),
        points: fg2Made * 2 + fg3Made * 3 + ftMade,
        fg2_made: fg2Made,
        fg2_attempted: value("fg2_attempted"),
        fg3_made: fg3Made,
        fg3_attempted: value("fg3_attempted"),
        ft_made: ftMade,
        ft_attempted: value("ft_attempted"),
        off_reb: value("off_reb"),
        def_reb: value("def_reb"),
        assists: value("assists"),
        steals: value("steals"),
        blocks_made: value("blocks"),
        blocks_received: 0,
        turnovers: value("turnovers"),
        fouls_committed: value("fouls_committed"),
        fouls_drawn: value("fouls_drawn"),
        plus_minus: 0,
        evaluation: 0
      });
    });

    return { starterIds, stats };
  }

  _consistencyMarkup(comparison = {}) {
    if (!comparison.hasEvents) {
      return `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.45;">
          <strong>Boxscore como fuente primaria.</strong>
          Este partido no tiene jugadas registradas. Puedes corregir el acta directamente.
        </div>
      `;
    }

    if (!comparison.discrepancies.length) {
      return `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.45;">
          ✓ Las estadísticas editables coinciden con el Play-by-Play cargado.
        </div>
      `;
    }

    const examples = comparison.discrepancies.slice(0, 6).map(item => `
      <li>
        <strong>${this._playerLabel(item.player_id)}</strong> · ${item.label}:
        Boxscore ${item.boxscore_value} / Play-by-Play ${item.play_by_play_value}
      </li>
    `).join("");

    return `
      <div style="background:#fffbeb;border:1px solid #fde68a;color:#78350f;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.45;">
        <strong>⚠️ ${comparison.discrepancies.length} discrepancia${comparison.discrepancies.length === 1 ? "" : "s"} con Play-by-Play.</strong>
        <ul style="margin:7px 0 0;padding-left:18px;">${examples}</ul>
        ${comparison.discrepancies.length > 6 ? `<div style="margin-top:5px;">… y ${comparison.discrepancies.length - 6} más.</div>` : ""}
      </div>
    `;
  }

  _updateConsistencyPanel(container, currentGame) {
    const target = container.querySelector("#boxscore-consistency-status");
    if (!target) return null;
    const state = this._collectBoxScoreState(container, currentGame);
    const comparison = this.boxScoreCorrectionService.compareWithEvents({
      game: currentGame,
      stats: state.stats,
      events: this.currentGameEvents
    });
    target.innerHTML = this._consistencyMarkup(comparison);
    return { ...state, comparison };
  }

  async render(containerId = "dashboard-content-area", targetGameId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.games = DataStore.getGames() || [];
    this.players = DataStore.getSeasonParticipantPlayers?.(DataStore.getActiveTeamId?.())
      || DataStore.getPlayers()
      || [];

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
      const currentGame = this.games.find(game => String(game.id) === String(targetGameId)) || this.games[0];
      this.currentGameEvents = [];
      try {
        this.currentGameEvents = typeof DataStore.loadGameEvents === "function"
          ? await DataStore.loadGameEvents([currentGame.id])
          : (DataStore.getGameEvents?.(currentGame.id) || []);
      } catch (error) {
        console.warn("[GameBoxScoreView] No se pudieron cargar eventos para comparar:", error?.message || error);
        this.currentGameEvents = DataStore.getGameEvents?.(currentGame.id) || [];
      }
      this.canEditCurrentGame = await this._resolveCanEdit(currentGame);
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
          ` : `<span class="boxscore-readonly-badge" style="background: #fef2f2; color: #dc2626; font-size: 12px; font-weight: 800; padding: 8px 12px; min-height:44px; display:inline-flex; align-items:center; border-radius: 8px;">${this._readOnlyMessage(currentGame)}</span>`}
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

        ${canEdit ? `
          <section style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px;display:grid;gap:10px;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
              <div>
                <strong style="display:block;color:#0f172a;font-size:14px;">✏️ Modo corrección de acta</strong>
                <span style="display:block;color:#64748b;font-size:12px;margin-top:3px;">
                  ${this.currentGameEvents.length
                    ? "Hay Play-by-Play: IQBasket compara los cambios antes de guardar y conserva una auditoría."
                    : "Sin Play-by-Play: el Boxscore puede actuar como fuente primaria del acta."}
                </span>
              </div>
              ${this.currentGameEvents.length ? `
                <a href="#/live-entry/${currentGame.id}" style="min-height:44px;display:inline-flex;align-items:center;padding:8px 12px;border:1px solid #cbd5e1;border-radius:9px;text-decoration:none;color:#334155;font-size:12px;font-weight:800;background:#f8fafc;">
                  📝 Corregir Play-by-Play
                </a>
              ` : ""}
            </div>
            <div id="boxscore-consistency-status"></div>
            <label style="display:grid;gap:5px;font-size:12px;font-weight:800;color:#334155;">
              Nota de corrección ${this.currentGameEvents.length ? "(obligatoria)" : "(opcional)"}
              <input id="boxscore-correction-reason" type="text" maxlength="240"
                placeholder="${this.currentGameEvents.length ? "Explica por qué prevalece esta corrección manual" : "Ej. Corrección del acta oficial"}"
                style="width:100%;min-height:44px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:9px 10px;font:inherit;color:#0f172a;background:#fff;" />
            </label>
          </section>
        ` : ""}

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
          width: 44px !important;
          height: 44px !important;
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
          this._updateConsistencyPanel(container, currentGame);
        });
      });
    });

    if (canEdit) {
      this._updateConsistencyPanel(container, currentGame);

      container.querySelector("#btn-save-boxscore")?.addEventListener("click", async event => {
        const button = event.currentTarget;
        const state = this._collectBoxScoreState(container, currentGame);

        if (state.starterIds.length > 5) {
          alert("⚠️ No puede haber más de cinco titulares.");
          return;
        }

        const comparison = this.boxScoreCorrectionService.compareWithEvents({
          game: currentGame,
          stats: state.stats,
          events: this.currentGameEvents
        });

        const reason = String(
          container.querySelector("#boxscore-correction-reason")?.value || ""
        ).trim();

        if (comparison.hasEvents && !reason) {
          alert("⚠️ Indica el motivo de la corrección manual. Hay Play-by-Play asociado a este partido.");
          container.querySelector("#boxscore-correction-reason")?.focus();
          return;
        }

        if (comparison.discrepancies.length > 0) {
          const proceed = confirm(
            `Hay ${comparison.discrepancies.length} discrepancia(s) con el Play-by-Play. ¿Guardar el Boxscore como corrección manual auditada?`
          );
          if (!proceed) return;
        }

        button.disabled = true;
        try {
          await this.boxScoreCorrectionService.saveCorrection({
            gameId: currentGame.id,
            starterIds: state.starterIds,
            stats: state.stats,
            reason: reason || null,
            sourceMode: comparison.hasEvents ? "MANUAL_OVERRIDE" : "PRIMARY_BOXSCORE",
            discrepancies: comparison.discrepancies
          });

          DataStore.isLoaded = false;
          await DataStore.init(DataStore.getActiveTeamId?.() || null, true);
          alert("✅ " + this.t("boxscore_saved_msg", "BoxScore corregido y auditado correctamente."));
          await this.render(containerId, currentGame.id);
        } catch (error) {
          console.error("[GameBoxScoreView] Error guardando corrección:", error);
          alert(`❌ No se pudo guardar la corrección: ${error.message || error}`);
          button.disabled = false;
        }
      });
    }
  }
}

export default GameBoxScoreView;