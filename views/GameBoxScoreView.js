/**
 * @fileoverview Registro Estadístico Avanzado / BoxScore (GameBoxScoreView.js).
 * Sincronizado con DataStore (0ms), control de permisos por rol y traducción dinámica con TranslationStore e I18nService.
 * Flujo en 2 Vistas con renderizado dual Responsive (TableView Desktop / CardView Smartphone):
 * 1) Listado general de partidos con métricas avanzadas del equipo.
 * 2) Ficha detallada por jugador con casillas editables y recálculo en tiempo real.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class GameBoxScoreView {
  constructor(supabaseClient, authController) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.games = [];
    this.players = [];
    this.selectedGameId = null;
    this.gameStats = [];
  }

  // Verificar Permiso de Edición
  _canEdit() {
    if (!this.auth || typeof this.auth.hasRole !== "function") return true;
    return (
      this.auth.hasRole("SUPERADMIN") ||
      this.auth.hasRole("ADMIN") ||
      this.auth.hasRole("ENTRENADOR") ||
      this.auth.hasRole("ANALISTA")
    );
  }

  async render(containerId = "dashboard-content-area", targetGameId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 🚀 LECTURA INSTANTÁNEA DESDE MEMORIA LOCAL (DATASTORE)
    this.games = DataStore.getGames() || [];
    this.players = DataStore.getPlayers() || [];

    if (this.games.length === 0) {
      container.innerHTML = `<div style="padding: 20px; color: #dc2626; font-weight: 700;">${TranslationStore.t("no_games_recorded", "No hay partidos registrados.")}</div>`;
      return;
    }

    // SI HAY UN ID DE PARTIDO ESPECÍFICO -> VISTA 2: DETALLE DEL BOXSCORE
    if (targetGameId) {
      this.selectedGameId = targetGameId;
      this._renderGameBoxScoreDetail(container, containerId);
      return;
    }

    // SI NO HAY ID -> VISTA 1: LISTADO GENERAL CON MÉTRICAS DE EQUIPO
    this._renderGamesBoxScoreList(container, containerId);
  }

  // =========================================================================
  // VISTA 1: RESUMEN GENERAL DE MÉTRICAS AVANZADAS POR PARTIDO
  // =========================================================================
  _renderGamesBoxScoreList(container, containerId) {
    const rowsMarkup = this.games.map(g => {
      const isWin = Number(g.team_score || 0) > Number(g.opponent_score || 0);
      const scoreColor = isWin ? '#16a34a' : '#dc2626';

      // Obtener estadísticas de todos los jugadores de este partido
      const statsList = DataStore.getPlayerGameStats(null, g.id) || [];

      let totFg2m = 0, totFg2a = 0, totFg3m = 0, totFg3a = 0, totFtm = 0, totFta = 0;
      let totReb = 0, totAst = 0, totRob = 0, totTap = 0, totPer = 0;

      statsList.forEach(st => {
        totFg2m += Number(st.fg2_made || 0);
        totFg2a += Number(st.fg2_attempted || 0);
        totFg3m += Number(st.fg3_made || 0);
        totFg3a += Number(st.fg3_attempted || 0);
        totFtm  += Number(st.ft_made || 0);
        totFta  += Number(st.ft_attempted || 0);

        totReb += Number(st.off_reb || 0) + Number(st.def_reb || 0);
        totAst += Number(st.assists || 0);
        totRob += Number(st.steals || 0);
        totTap += Number(st.blocks || 0);
        totPer += Number(st.turnovers || 0);
      });

      const totFgm = totFg2m + totFg3m;
      const totFga = totFg2a + totFg3a;

      const efgVal = totFga > 0 ? (((totFgm + 0.5 * totFg3m) / totFga) * 100).toFixed(1) : "0.0";
      const pct2p  = totFg2a > 0 ? ((totFg2m / totFg2a) * 100).toFixed(1) : "0.0";
      const pct3p  = totFg3a > 0 ? ((totFg3m / totFg3a) * 100).toFixed(1) : "0.0";
      const pctFt  = totFta > 0 ? ((totFtm / totFta) * 100).toFixed(1) : "0.0";

      const venueLower = String(g.venue || '').toLowerCase();
      const isHome = venueLower === 'home' || venueLower === 'local';
      const venueText = isHome ? TranslationStore.t("local", "Local") : TranslationStore.t("visitor", "Visitante");
      const opponentText = g.opponent || TranslationStore.t("opponent", "Rival");

      return `
        <tr class="game-boxscore-row" style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 14px 12px;">
            <div style="font-weight: 800; color: #0f172a;">vs ${opponentText}</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 500;">${g.date || '-'} · ${venueText}</div>
          </td>
          <td style="padding: 14px 12px; text-align: center;">
            <span style="font-weight: 900; color: ${scoreColor}; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              ${g.team_score ?? 0} - ${g.opponent_score ?? 0}
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
        
        <!-- Header -->
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
            📊 ${TranslationStore.t("boxscore", "Registro estadístico")}
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
            ${TranslationStore.t("boxscore_subtitle", "Resumen de métricas avanzadas por equipo. Selecciona un partido para ver o editar las estadísticas por jugador.")}
          </p>
        </div>

        <!-- Tabla General -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                <th style="padding: 10px 12px;">FECHA / ${TranslationStore.t("opponent", "RIVAL").toUpperCase()}</th>
                <th style="padding: 10px 12px; text-align: center;">${TranslationStore.t("score", "RESULTADO").toUpperCase()}</th>
                <th style="padding: 10px 12px; text-align: center;">EFG%</th>
                <th style="padding: 10px 12px; text-align: center;">%T2</th>
                <th style="padding: 10px 12px; text-align: center;">%T3</th>
                <th style="padding: 10px 12px; text-align: center;">%TL</th>
                <th style="padding: 10px 12px; text-align: center;">REB</th>
                <th style="padding: 10px 12px; text-align: center;">AST</th>
                <th style="padding: 10px 12px; text-align: center;">ROB</th>
                <th style="padding: 10px 12px; text-align: center;">TAP</th>
                <th style="padding: 10px 12px; text-align: center;">PER</th>
                <th style="padding: 10px 12px; text-align: center;">${TranslationStore.t("actions", "ACCIONES").toUpperCase()}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsMarkup}
            </tbody>
          </table>
        </div>

      </div>
    `;

    // Manejador para abrir el detalle de un partido
    container.querySelectorAll(".btn-open-boxscore").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        window.location.hash = `#/boxscore/${id}`;
      });
    });
  }

  // =========================================================================
  // VISTA 2: DETALLE DEL BOXSCORE POR JUGADOR (TABLEVIEW Y CARDVIEW)
  // =========================================================================
  _renderGameBoxScoreDetail(container, containerId) {
    const currentGame = this.games.find(g => String(g.id) === String(this.selectedGameId)) || this.games[0];
    this.gameStats = DataStore.getPlayerGameStats(null, currentGame.id) || [];

    const starters = currentGame.starter_ids || [];
    const canEdit = this._canEdit();

    // CÁLCULOS DE FILA TOTAL / MEDIA
    let totMin = 0, totPts = 0, totFg2m = 0, totFg2a = 0, totFg3m = 0, totFg3a = 0, totFtm = 0, totFta = 0;
    let totRo = 0, totRd = 0, totAst = 0, totRob = 0, totTap = 0, totPer = 0, totFc = 0, totFr = 0, totVal = 0;

    const playerRowsMarkup = this.players.map(p => {
      const st = this.gameStats.find(s => String(s.player_id) === String(p.id)) || {};
      const isStarter = starters.includes(p.id);

      const computed = StatsEngine.calculatePlayerStats(st);

      totMin += Number(st.minutes || 0);
      totPts += computed.points || 0;
      totFg2m += Number(st.fg2_made || 0);
      totFg2a += Number(st.fg2_attempted || 0);
      totFg3m += Number(st.fg3_made || 0);
      totFg3a += Number(st.fg3_attempted || 0);
      totFtm += Number(st.ft_made || 0);
      totFta += Number(st.ft_attempted || 0);
      totRo += Number(st.off_reb || 0);
      totRd += Number(st.def_reb || 0);
      totAst += Number(st.assists || 0);
      totRob += Number(st.steals || 0);
      totTap += Number(st.blocks || 0);
      totPer += Number(st.turnovers || 0);
      totFc += Number(st.fouls_committed || 0);
      totFr += Number(st.fouls_received || 0);
      totVal += computed.evaluation || 0;

      const efgText = computed.eFG ? `${computed.eFG.toFixed(1)}%` : "0.0%";
      const valText = computed.evaluation ?? 0;
      const astToText = Number(st.turnovers || 0) > 0 ? (Number(st.assists || 0) / Number(st.turnovers)).toFixed(1) : Number(st.assists || 0).toFixed(1);
      const usgText = computed.usageRate ? `${computed.usageRate.toFixed(1)}%` : "40.0%";

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 12px;" data-player-id="${p.id}">
          <td style="padding: 10px; font-weight: 700; color: #0f172a; white-space: nowrap;">#${p.jersey ?? '-'} ${p.first_name || ''} ${p.last_name || ''}</td>
          <td style="padding: 10px; text-align: center;"><input type="checkbox" class="chk-starter" ${isStarter ? 'checked' : ''} ${canEdit ? '' : 'disabled'} /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="minutes" value="${st.minutes ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 32px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center; font-weight: 800;">${computed.points || 0}</td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="fg2_made" value="${st.fg2_made ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="fg2_attempted" value="${st.fg2_attempted ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="fg3_made" value="${st.fg3_made ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="fg3_attempted" value="${st.fg3_attempted ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="ft_made" value="${st.ft_made ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="ft_attempted" value="${st.ft_attempted ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="off_reb" value="${st.off_reb ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="def_reb" value="${st.def_reb ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="assists" value="${st.assists ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="steals" value="${st.steals ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="blocks" value="${st.blocks ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="turnovers" value="${st.turnovers ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="fouls_committed" value="${st.fouls_committed ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          <td style="padding: 10px; text-align: center;"><input type="number" class="bs-input" data-field="fouls_received" value="${st.fouls_received ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 35px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;" /></td>
          
          <!-- Columnas Avanzadas -->
          <td style="padding: 10px; text-align: center; font-weight: 700; color: #a855f7;">${efgText}</td>
          <td style="padding: 10px; text-align: center; font-weight: 800; color: #a855f7;">${valText}</td>
          <td style="padding: 10px; text-align: center; font-weight: 700; color: #166534;">${astToText}</td>
          <td style="padding: 10px; text-align: center; font-weight: 700; color: #1e40af;">${usgText}</td>
        </tr>
      `;
    }).join("");

    // CARDVIEW PARA DISPOSITIVOS MÓVILES
    const mobileCardsMarkup = this.players.map(p => {
      const st = this.gameStats.find(s => String(s.player_id) === String(p.id)) || {};
      const isStarter = starters.includes(p.id);
      const computed = StatsEngine.calculatePlayerStats(st);
      const totalReb = Number(st.off_reb || 0) + Number(st.def_reb || 0);

      return `
        <div class="mobile-boxscore-card card" data-player-id="${p.id}">
          <div class="card-player-header">
            <div>
              <strong class="player-name">#${p.jersey ?? '-'} ${p.first_name || ''} ${p.last_name || ''}</strong>
              <span class="player-pos">${p.primary_position || 'Jugador'}</span>
            </div>
            <label class="starter-label">
              <input type="checkbox" class="chk-starter" ${isStarter ? 'checked' : ''} ${canEdit ? '' : 'disabled'} />
              <span>TIT</span>
            </label>
          </div>
          <div class="card-kpi-summary">
            <div class="kpi-mini"><span>PTS</span><strong>${computed.points || 0}</strong></div>
            <div class="kpi-mini"><span>REB</span><strong>${totalReb}</strong></div>
            <div class="kpi-mini"><span>AST</span><strong>${st.assists || 0}</strong></div>
            <div class="kpi-mini"><span>VAL</span><strong style="color: #a855f7;">${computed.evaluation ?? 0}</strong></div>
          </div>
          <div class="card-inputs-grid">
            <div class="input-unit"><label>MIN</label><input type="number" class="bs-input" data-field="minutes" value="${st.minutes ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>T2C</label><input type="number" class="bs-input" data-field="fg2_made" value="${st.fg2_made ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>T2I</label><input type="number" class="bs-input" data-field="fg2_attempted" value="${st.fg2_attempted ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>T3C</label><input type="number" class="bs-input" data-field="fg3_made" value="${st.fg3_made ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>T3I</label><input type="number" class="bs-input" data-field="fg3_attempted" value="${st.fg3_attempted ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>TLC</label><input type="number" class="bs-input" data-field="ft_made" value="${st.ft_made ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>TLI</label><input type="number" class="bs-input" data-field="ft_attempted" value="${st.ft_attempted ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>RO</label><input type="number" class="bs-input" data-field="off_reb" value="${st.off_reb ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>RD</label><input type="number" class="bs-input" data-field="def_reb" value="${st.def_reb ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>AST</label><input type="number" class="bs-input" data-field="assists" value="${st.assists ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>ROB</label><input type="number" class="bs-input" data-field="steals" value="${st.steals ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>PER</label><input type="number" class="bs-input" data-field="turnovers" value="${st.turnovers ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
            <div class="input-unit"><label>FC</label><input type="number" class="bs-input" data-field="fouls_committed" value="${st.fouls_committed ?? 0}" ${canEdit ? '' : 'disabled'} /></div>
          </div>
        </div>
      `;
    }).join("");

    const totalFga = totFg2a + totFg3a;
    const totalFgm = totFg2m + totFg3m;
    const teamEfg = totalFga > 0 ? (((totalFgm + 0.5 * totFg3m) / totalFga) * 100).toFixed(1) : "0.0";
    const teamAstTo = totPer > 0 ? (totAst / totPer).toFixed(1) : totAst.toFixed(1);

    const opponentText = currentGame.opponent || TranslationStore.t("opponent", "Rival");
    const optionsMarkup = this.games.map(g => `
      <option value="${g.id}" ${String(g.id) === String(currentGame.id) ? 'selected' : ''}>
        ${g.date || ''} vs ${g.opponent || TranslationStore.t("opponent", "Rival")} (${g.team_score ?? 0} - ${g.opponent_score ?? 0})
      </option>
    `).join("");

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        
        <!-- Header con Botón de Regreso -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <a href="#/boxscore" style="background: #f1f5f9; color: #475569; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; min-height: 44px;">
              ← ${TranslationStore.t("back_to_register", "Volver a Registro Estadístico")}
            </a>
            <div>
              <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
                📊 Box Score e Indicadores Avanzados
              </h1>
              <span style="font-size: 12px; color: #64748b;">${TranslationStore.t("boxscore_detail_subtitle", "Estadísticas tradicionales y métricas avanzadas por jugador")} (${this.players.length} ${TranslationStore.t("players", "jugadores")}).</span>
            </div>
          </div>

          ${canEdit ? `
            <button id="btn-save-boxscore" style="background: var(--color-primary, #ea580c); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;">
              💾 ${TranslationStore.t("save_changes", "Guardar Cambios")}
            </button>
          ` : `<span style="background: #fef2f2; color: #dc2626; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 8px;">${TranslationStore.t("read_only", "Modo Solo Lectura")}</span>`}
        </div>

        <!-- Selector de Partido -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
            <span style="font-size: 18px;">🏆</span>
            <div style="flex: 1; max-width: 500px;">
              <label style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">${TranslationStore.t("change_game", "CAMBIAR DE PARTIDO")}:</label>
              <select id="select-game-bs" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; background: white; min-height: 44px;">
                ${optionsMarkup}
              </select>
            </div>
          </div>

          <span style="background: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 8px;">
            ${TranslationStore.t("score", "Marcador")}: ${currentGame.team_score ?? 0} - ${currentGame.opponent_score ?? 0}
          </span>
        </div>

        <!-- RENDERIZADO DUAL: TABLEVIEW (DESKTOP) VS CARDVIEW (MÓVIL) -->
        <div class="desktop-only" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; background: #f8fafc;">
                <th style="padding: 10px;">${TranslationStore.t("players", "JUGADOR").toUpperCase()}</th>
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
              <tr style="background: #f8fafc; font-size: 11px; font-weight: 900; color: #0f172a; border-top: 2px solid #e2e8f0;">
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

        <div class="mobile-only mobile-boxscore-grid">
          ${mobileCardsMarkup}
        </div>

      </div>

      <style>
        .mobile-boxscore-grid { display: flex; flex-direction: column; gap: 12px; }
        .mobile-boxscore-card { padding: 14px; display: flex; flex-direction: column; gap: 10px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; }
        .card-player-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
        .player-name { font-size: 14px; color: #0f172a; display: block; }
        .player-pos { font-size: 11px; color: #64748b; }
        .starter-label { font-size: 11px; font-weight: 700; color: #1e3a8a; display: flex; align-items: center; gap: 4px; }
        .card-kpi-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center; }
        .kpi-mini span { font-size: 9px; color: #64748b; font-weight: 800; display: block; }
        .kpi-mini strong { font-size: 14px; color: #0f172a; }
        .card-inputs-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .input-unit label { font-size: 9px; font-weight: 800; color: #64748b; display: block; margin-bottom: 2px; }
        .input-unit input { width: 100%; height: 36px; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 700; }
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
      </style>
    `;

    // Listener del Selector de Partido Superior
    container.querySelector("#select-game-bs")?.addEventListener("change", (e) => {
      window.location.hash = `#/boxscore/${e.target.value}`;
    });

    // Guardado de BoxScore
    if (canEdit) {
      container.querySelector("#btn-save-boxscore")?.addEventListener("click", async () => {
        const rows = container.querySelectorAll("tr[data-player-id], .mobile-boxscore-card[data-player-id]");
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

          statsList.push({
            player_id: playerId,
            minutes: getInpVal("minutes"),
            fg2_made: getInpVal("fg2_made"),
            fg2_attempted: getInpVal("fg2_attempted"),
            fg3_made: getInpVal("fg3_made"),
            fg3_attempted: getInpVal("fg3_attempted"),
            ft_made: getInpVal("ft_made"),
            ft_attempted: getInpVal("ft_attempted"),
            off_reb: getInpVal("off_reb"),
            def_reb: getInpVal("def_reb"),
            assists: getInpVal("assists"),
            steals: getInpVal("steals"),
            blocks: getInpVal("blocks"),
            turnovers: getInpVal("turnovers"),
            fouls_committed: getInpVal("fouls_committed"),
            fouls_received: getInpVal("fouls_received")
          });
        }

        const gameData = {
          ...currentGame,
          starter_ids: starterIds
        };

        // GUARDADO EN DATASTORE Y SINCRONIZACIÓN EN SEGUNDO PLANO
        await DataStore.saveGameAndStats(gameData, statsList);

        alert("✅ " + TranslationStore.t("boxscore_saved_msg", "BoxScore guardado y métricas recalculadas exitosamente."));
        this.render(containerId, currentGame.id);
      });
    }
  }
}

export default GameBoxScoreView;