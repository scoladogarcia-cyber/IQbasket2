/**
 * @fileoverview Vista de Partidos y Formulario de Edición (GameLiveEditorView.js).
 * Sincronizado con 'game_period_scores', borrado de prórrogas y traducido dinámicamente con I18nService.
 * Incluye validación triple de marcador:
 *  1. Puntos de Jugadores vs Marcador Total.
 *  2. Suma de Cuartos/Prórrogas vs Marcador Total (con indicador de diferencia).
 *  3. Campos de Marcador Global manuales A Favor / En Contra.
 * Mantiene la posición de scroll al teclear estadísticas o cuartos.
 * Restricciones de permisos para JUGADOR e INVITADO con aviso emergente.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class GameLiveEditorView {
  constructor(gameController, authController) {
    this.gameController = gameController;
    this.auth = authController;
    this.supabase = gameController?.supabase || gameController?.options?.supabase;
    this.games = [];
    this.players = [];
    this.currentGame = null;
    this.currentGameStats = [];
    this.currentPeriods = [];
    this.filterCondition = "Todos";
    this.sortOrder = "desc"; // 'asc': P1 -> Pn | 'desc': Pn -> P1
    this.isEditing = false;
  }

  // =========================================================================
  // CONTROL DE PERMISOS POR ROL
  // =========================================================================
  _canEdit() {
    if (!this.auth || typeof this.auth.hasRole !== "function") return true;
    return (
      this.auth.hasRole("SUPERADMIN") ||
      this.auth.hasRole("ADMIN") ||
      this.auth.hasRole("ENTRENADOR") ||
      this.auth.hasRole("ANALISTA")
    );
  }

  // =========================================================================
  // CARGA DE DATOS Y RENDERIZADO PRINCIPAL
  // =========================================================================
  async render(containerId = "dashboard-content-area", gameId = null, teamId = "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22") {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.players = DataStore.getPlayers() || [];

    if (gameId && gameId !== teamId) {
      await this._openEditForm(gameId, container);
      return;
    }

    if (this.isEditing && this.currentGame) {
      this._renderEditForm(container);
    } else {
      await this._renderGamesList(container, teamId);
    }
  }

  // =========================================================================
  // VISTA 1: LISTADO DE PARTIDOS
  // =========================================================================
  async _renderGamesList(container, teamId) {
    this.games = DataStore.getGames() || [];
    const canEdit = this._canEdit();

    // Asignar el código P1, P2... Pn en estricto orden cronológico
    const chronologicalGames = [...this.games].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const pCodeMap = new Map();
    chronologicalGames.forEach((g, idx) => {
      pCodeMap.set(String(g.id), `P${idx + 1}`);
    });

    const filteredGames = this.games.filter(g => {
      const v = String(g.venue || '').toLowerCase();
      if (this.filterCondition === "Local") return v === "local" || v === "home";
      if (this.filterCondition === "Visitante") return v === "visitante" || v === "away";
      return true;
    });

    const sortedGames = [...filteredGames].sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return this.sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    const gamesCardsMarkup = sortedGames.map(g => {
      const isWin = Number(g.team_score || 0) > Number(g.opponent_score || 0);
      const resultClass = isWin ? "background: #166534; color: white;" : "background: #dc2626; color: white;";
      const resultText = isWin ? TranslationStore.t("win", "VICTORIA") : TranslationStore.t("loss", "DERROTA");

      const periods = DataStore.getGamePeriodScores(g.id);
      const quarters = periods.filter(p => !p.is_overtime);
      const overtimes = periods.filter(p => p.is_overtime);

      const q1 = quarters[0] ? `${quarters[0].team_score}-${quarters[0].opponent_score}` : '0-0';
      const q2 = quarters[1] ? `${quarters[1].team_score}-${quarters[1].opponent_score}` : '0-0';
      const q3 = quarters[2] ? `${quarters[2].team_score}-${quarters[2].opponent_score}` : '0-0';
      const q4 = quarters[3] ? `${quarters[3].team_score}-${quarters[3].opponent_score}` : '0-0';

      let otMarkup = "";
      if (overtimes.length > 0) {
        otMarkup = overtimes.map((ot, i) => `<b>OT${i + 1}:</b> ${ot.team_score}-${ot.opponent_score} `).join(" ");
      }

      const venueLower = String(g.venue || '').toLowerCase();
      const isHome = venueLower === 'home' || venueLower === 'local';
      const venueText = isHome ? TranslationStore.t("local", "Local") : TranslationStore.t("visitor", "Visitante");
      const pCode = pCodeMap.get(String(g.id)) || "P-";
      const opponentText = g.opponent || TranslationStore.t("opponent", "Rival");
      const formattedDate = g.date ? I18n.formatDate(g.date) : '-';

      return `
        <div class="game-item-card card" style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04); flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div style="padding: 10px 14px; border-radius: 10px; font-weight: 900; font-size: 13px; text-align: center; width: 85px; ${resultClass}">
              <div style="font-size: 9px; text-transform: uppercase; opacity: 0.9;">${resultText}</div>
              <div style="font-size: 16px; font-weight: 900; margin-top: 2px;">${g.team_score ?? 0}-${g.opponent_score ?? 0}</div>
            </div>

            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a;">vs ${opponentText}</h3>
                <span style="background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 10px;">
                  ${venueText} (${pCode})
                </span>
              </div>
              <div style="font-size: 12px; color: #64748b; margin: 4px 0;">
                📅 ${formattedDate} &nbsp;·&nbsp; 🏆 ${g.competition || 'B1'}
              </div>
              <div style="font-size: 11px; color: #64748b; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid #f1f5f9; display: inline-block;">
                <b>${TranslationStore.t("quarters", "CUARTOS")}:</b> Q1: ${q1} &nbsp; Q2: ${q2} &nbsp; Q3: ${q3} &nbsp; Q4: ${q4} ${otMarkup ? `&nbsp; ${otMarkup}` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <button onclick="window.location.hash='#/boxscore/${g.id}'" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px;">👁️ Boxscore</button>
            <button onclick="window.location.hash='#/reports'" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px;">📊 ${TranslationStore.t("report", "Informe")}</button>
            
            ${canEdit ? `
              <button class="btn-edit-game" data-id="${g.id}" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; min-height: 44px; min-width: 44px;" title="${TranslationStore.t("edit_game", "Editar partido")}">✏️</button>
              <button class="btn-delete-game" data-id="${g.id}" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #ef4444; min-height: 44px; min-width: 44px;" title="${TranslationStore.t("delete_game", "Eliminar partido")}">🗑️</button>
            ` : `
              <button class="btn-edit-game-disabled" style="background: none; border: none; font-size: 18px; cursor: not-allowed; color: #cbd5e1; opacity: 0.5; min-height: 44px; min-width: 44px;" title="🔒 No permitido">✏️</button>
              <button class="btn-delete-game-disabled" style="background: none; border: none; font-size: 18px; cursor: not-allowed; color: #cbd5e1; opacity: 0.5; min-height: 44px; min-width: 44px;" title="🔒 No permitido">🗑️</button>
            `}
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">${TranslationStore.t("team_games", "Partidos del Equipo")}</h1>
            <span style="font-size: 13px; color: #64748b;">JMJ Manyanet Sant Andreu · ${this.games.length} ${TranslationStore.t("registered_games", "partidos registrados")}</span>
          </div>
          ${canEdit ? `
            <button id="btn-create-game" style="background: var(--color-primary, #ea580c); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;">+ ${TranslationStore.t("register_new_game", "Registrar nuevo partido")}</button>
          ` : `
            <button id="btn-create-game-disabled" style="background: #cbd5e1; color: #64748b; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: not-allowed; min-height: 44px;" aria-disabled="true">🔒 + ${TranslationStore.t("register_new_game", "Registrar nuevo partido")}</button>
          `}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; gap: 8px;">
            <button class="filter-btn ${this.filterCondition === 'Todos' ? 'active' : ''}" data-cond="Todos" style="padding: 8px 16px; border-radius: 20px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px; background: ${this.filterCondition === 'Todos' ? '#1e3a8a' : '#e2e8f0'}; color: ${this.filterCondition === 'Todos' ? 'white' : '#475569'};">${TranslationStore.t("all", "Todos")} (${this.games.length})</button>
            <button class="filter-btn ${this.filterCondition === 'Local' ? 'active' : ''}" data-cond="Local" style="padding: 8px 16px; border-radius: 20px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px; background: ${this.filterCondition === 'Local' ? '#1e3a8a' : '#e2e8f0'}; color: ${this.filterCondition === 'Local' ? 'white' : '#475569'};">${TranslationStore.t("local", "Local")}</button>
            <button class="filter-btn ${this.filterCondition === 'Visitante' ? 'active' : ''}" data-cond="Visitante" style="padding: 8px 16px; border-radius: 20px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px; background: ${this.filterCondition === 'Visitante' ? '#1e3a8a' : '#e2e8f0'}; color: ${this.filterCondition === 'Visitante' ? 'white' : '#475569'};">${TranslationStore.t("visitor", "Visitante")}</button>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 12px; font-weight: 700; color: #64748b;">ORDENAR CRONOLÓGICAMENTE:</label>
            <select id="select-sort-games" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; background: white; cursor: pointer; min-height: 44px;">
              <option value="desc" ${this.sortOrder === 'desc' ? 'selected' : ''}>Pn → P1 (Más recientes primero)</option>
              <option value="asc" ${this.sortOrder === 'asc' ? 'selected' : ''}>P1 → Pn (Antiguos a recientes)</option>
            </select>
          </div>
        </div>

        <div>${gamesCardsMarkup.length > 0 ? gamesCardsMarkup : `<div style="padding: 40px; text-align: center; color: #64748b; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">${TranslationStore.t("no_games_recorded", "No hay partidos registrados.")}</div>`}</div>
      </div>
    `;

    // Interceptadores de permisos para roles deshabilitados
    const disabledCreateBtn = container.querySelector("#btn-create-game-disabled");
    if (disabledCreateBtn) {
      disabledCreateBtn.addEventListener("click", (e) => {
        e.preventDefault();
        alert("⚠️ Esta función no está disponible para tu rol de usuario.");
      });
    }

    container.querySelectorAll(".btn-edit-game-disabled").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        alert("⚠️ Tu rol de usuario no tiene permisos para editar partidos.");
      });
    });

    container.querySelectorAll(".btn-delete-game-disabled").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        alert("⚠️ Tu rol de usuario no tiene permisos para eliminar partidos.");
      });
    });

    if (canEdit) {
      container.querySelector("#btn-create-game")?.addEventListener("click", () => {
        this.currentGame = {
          date: "2026-05-30", time: "18:00", opponent: "", competition: "B1", matchday: "Jornada 12",
          venue: "Local", arena: "", status: "Finalizado", starter_ids: [], notes: "", video_url: "",
          team_score: 0, opponent_score: 0
        };
        this.currentPeriods = [
          { period_type: 'quarter', period_number: 1, team_score: 0, opponent_score: 0, is_overtime: false },
          { period_type: 'quarter', period_number: 2, team_score: 0, opponent_score: 0, is_overtime: false },
          { period_type: 'quarter', period_number: 3, team_score: 0, opponent_score: 0, is_overtime: false },
          { period_type: 'quarter', period_number: 4, team_score: 0, opponent_score: 0, is_overtime: false }
        ];
        this.currentGameStats = this.players.map(p => ({
          player_id: p.id, minutes: 0, fg2_made: 0, fg2_attempted: 0, fg3_made: 0, fg3_attempted: 0,
          ft_made: 0, ft_attempted: 0, off_reb: 0, def_reb: 0, assists: 0, steals: 0, blocks: 0,
          turnovers: 0, fouls_committed: 0, fouls_received: 0, plus_minus: 0
        }));
        this.isEditing = true;
        this._renderEditForm(container);
      });

      container.querySelectorAll(".btn-edit-game").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const id = e.target.getAttribute("data-id");
          this._openEditForm(id, container);
        });
      });

      container.querySelectorAll(".btn-delete-game").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.getAttribute("data-id");
          if (confirm(TranslationStore.t("confirm_delete_game", "¿Estás seguro de que deseas eliminar este partido?"))) {
            await this.supabase.from("game_period_scores").delete().eq("game_id", id);
            await this.supabase.from("player_game_stats").delete().eq("game_id", id);
            await this.supabase.from("games").delete().eq("id", id);
            await DataStore.init(teamId, true);
            this._renderGamesList(container, teamId);
          }
        });
      });
    }

    container.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.filterCondition = btn.getAttribute("data-cond");
        this._renderGamesList(container, teamId);
      });
    });

    container.querySelector("#select-sort-games")?.addEventListener("change", (e) => {
      this.sortOrder = e.target.value;
      this._renderGamesList(container, teamId);
    });
  }

  // =========================================================================
  // VISTAS DE EDICIÓN
  // =========================================================================
  async _openEditForm(gameId, container) {
    this.currentGame = DataStore.getGameById(gameId) || {};
    
    const existingPeriods = DataStore.getGamePeriodScores(gameId);

    if (existingPeriods.length > 0) {
      this.currentPeriods = existingPeriods.map(p => ({
        period_type: p.period_type || (p.is_overtime ? 'overtime' : 'quarter'),
        period_number: Number(p.period_number),
        team_score: Number(p.team_score || 0),
        opponent_score: Number(p.opponent_score || 0),
        is_overtime: Boolean(p.is_overtime)
      }));
    } else {
      this.currentPeriods = [1, 2, 3, 4].map(num => ({
        period_type: 'quarter',
        period_number: num,
        team_score: 0,
        opponent_score: 0,
        is_overtime: false
      }));
    }

    const pStats = DataStore.getPlayerGameStats(null, gameId);
    this.currentGameStats = this.players.map(p => {
      const existing = (pStats || []).find(s => String(s.player_id) === String(p.id));
      return existing || {
        player_id: p.id, minutes: 0, fg2_made: 0, fg2_attempted: 0, fg3_made: 0, fg3_attempted: 0,
        ft_made: 0, ft_attempted: 0, off_reb: 0, def_reb: 0, assists: 0, steals: 0, blocks: 0,
        turnovers: 0, fouls_committed: 0, fouls_received: 0, plus_minus: 0
      };
    });

    this.isEditing = true;
    this._renderEditForm(container);
  }

  _renderEditFormPreservingScroll(container) {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    this._renderEditForm(container);
    window.scrollTo(0, scrollTop);
  }

  /**
   * Recalcula en tiempo real los marcadores e indicadores de descuadre.
   * Modifica directamente el DOM sin re-renderizar la vista (sin perder foco/scroll).
   */
  _updateScoreBadgeAndTotals(container) {
    // 1. Puntos Totales de Jugadores
    let playerPointsTotal = 0;
    this.currentGameStats.forEach(s => {
      playerPointsTotal += (Number(s.fg2_made || 0) * 2) + (Number(s.fg3_made || 0) * 3) + Number(s.ft_made || 0);
    });

    // 2. Suma de Cuartos / Prórrogas
    let qTeamSum = 0;
    let qOppSum = 0;
    this.currentPeriods.forEach(p => {
      qTeamSum += Number(p.team_score || 0);
      qOppSum += Number(p.opponent_score || 0);
    });

    // 3. Puntos Totales declarados manualmente en el formulario
    const inpTeamScore = container.querySelector('input[name="team_score"]');
    const inpOppScore = container.querySelector('input[name="opponent_score"]');

    const totalTeamScore = inpTeamScore ? Number(inpTeamScore.value || 0) : qTeamSum;
    const totalOppScore = inpOppScore ? Number(inpOppScore.value || 0) : qOppSum;

    if (this.currentGame) {
      this.currentGame.team_score = totalTeamScore;
      this.currentGame.opponent_score = totalOppScore;
    }

    // 4. Indicador 1: Jugadores vs Marcador Total
    const isPlayerPointsMatch = playerPointsTotal === totalTeamScore;
    const playerBadgeEl = container.querySelector("#points-match-badge");
    if (playerBadgeEl) {
      playerBadgeEl.style.cssText = isPlayerPointsMatch 
        ? "font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;"
        : "font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;";
      
      playerBadgeEl.textContent = isPlayerPointsMatch
        ? `✔ Puntos Plantilla Cuadrados: ${playerPointsTotal} pts = Marcador (${totalTeamScore} pts)`
        : `⚠️ Descuadre Plantilla: Jugadores (${playerPointsTotal} pts) vs Marcador (${totalTeamScore} pts)`;
    }

    // 5. Indicador 2: Suma de Cuartos vs Marcador Total (Diferencia)
    const diffQuartersTeam = qTeamSum - totalTeamScore;
    const diffQuartersOpp = qOppSum - totalOppScore;

    const quartersBadgeEl = container.querySelector("#quarters-diff-badge");
    if (quartersBadgeEl) {
      const isQuartersMatch = diffQuartersTeam === 0 && diffQuartersOpp === 0;
      quartersBadgeEl.style.cssText = isQuartersMatch
        ? "font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;"
        : "font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5;";

      const diffTextTeam = diffQuartersTeam > 0 ? `+${diffQuartersTeam}` : String(diffQuartersTeam);
      const diffTextOpp = diffQuartersOpp > 0 ? `+${diffQuartersOpp}` : String(diffQuartersOpp);

      quartersBadgeEl.textContent = isQuartersMatch
        ? `✔ Cuartos Cuadrados: Suma (${qTeamSum}-${qOppSum}) = Total (${totalTeamScore}-${totalOppScore})`
        : `⚠️ Dif. Cuartos vs Total: Nosotros (${diffTextTeam} pts) | Rival (${diffTextOpp} pts)`;
    }

    // 6. Displays del total del marcador
    const totalScoreEl = container.querySelector("#total-score-display");
    if (totalScoreEl) {
      totalScoreEl.textContent = `Suma Cuartos: ${qTeamSum} - ${qOppSum} | Marcador: ${totalTeamScore} - ${totalOppScore}`;
    }

    const resultStatusEl = container.querySelector("#result-status-display");
    if (resultStatusEl) {
      const isWin = totalTeamScore > totalOppScore;
      resultStatusEl.style.background = isWin ? '#dcfce7' : '#fef2f2';
      resultStatusEl.style.color = isWin ? '#166534' : '#dc2626';
      resultStatusEl.textContent = isWin ? TranslationStore.t("win", "Victoria") : TranslationStore.t("loss", "Derrota");
    }
  }

  _renderEditForm(container) {
    const g = this.currentGame || {};
    const starters = g.starter_ids || [];
    const canEdit = this._canEdit();

    // Cálculos preliminares
    let playerPointsTotal = 0;
    this.currentGameStats.forEach(s => {
      playerPointsTotal += (Number(s.fg2_made || 0) * 2) + (Number(s.fg3_made || 0) * 3) + Number(s.ft_made || 0);
    });

    let qTeamSum = 0;
    let qOppSum = 0;
    this.currentPeriods.forEach(p => {
      qTeamSum += Number(p.team_score || 0);
      qOppSum += Number(p.opponent_score || 0);
    });

    const initTeamScore = g.team_score !== undefined && g.team_score !== null ? Number(g.team_score) : qTeamSum;
    const initOppScore = g.opponent_score !== undefined && g.opponent_score !== null ? Number(g.opponent_score) : qOppSum;

    const isPlayerPointsMatch = playerPointsTotal === initTeamScore;
    const badgeClass = isPlayerPointsMatch ? "background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;" : "background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;";
    const badgeText = isPlayerPointsMatch 
      ? `✔ Puntos Plantilla Cuadrados: ${playerPointsTotal} pts = Marcador (${initTeamScore} pts)`
      : `⚠️ Descuadre Plantilla: Jugadores (${playerPointsTotal} pts) vs Marcador (${initTeamScore} pts)`;

    const diffQuartersTeam = qTeamSum - initTeamScore;
    const diffQuartersOpp = qOppSum - initOppScore;
    const isQuartersMatch = diffQuartersTeam === 0 && diffQuartersOpp === 0;

    const qBadgeClass = isQuartersMatch 
      ? "background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;" 
      : "background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5;";

    const diffTextTeam = diffQuartersTeam > 0 ? `+${diffQuartersTeam}` : String(diffQuartersTeam);
    const diffTextOpp = diffQuartersOpp > 0 ? `+${diffQuartersOpp}` : String(diffQuartersOpp);

    const qBadgeText = isQuartersMatch
      ? `✔ Cuartos Cuadrados: Suma (${qTeamSum}-${qOppSum}) = Total (${initTeamScore}-${initOppScore})`
      : `⚠️ Dif. Cuartos vs Total: Nosotros (${diffTextTeam} pts) | Rival (${diffTextOpp} pts)`;

    const isWin = initTeamScore > initOppScore;

    const startersMarkup = this.players.map(p => {
      const isSelected = starters.includes(p.id);
      return `
        <button type="button" class="btn-starter ${isSelected ? 'active' : ''}" data-id="${p.id}" ${canEdit ? '' : 'disabled'} style="padding: 10px 12px; border-radius: 8px; border: 1px solid ${isSelected ? '#2563eb' : '#cbd5e1'}; background: ${isSelected ? '#eff6ff' : 'white'}; color: ${isSelected ? '#1e40af' : '#475569'}; font-size: 12px; font-weight: 700; cursor: ${canEdit ? 'pointer' : 'not-allowed'}; display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 44px;">
          <span>#${p.jersey ?? '-'} ${p.first_name || ''} ${p.last_name || ''}</span>
          <span style="font-size: 10px; opacity: 0.8; font-weight: 600;">${p.primary_position || TranslationStore.t("player", "Jugador")}</span>
        </button>
      `;
    }).join("");

    const playerRowsMarkup = this.players.map(p => {
      const st = this.currentGameStats.find(s => String(s.player_id) === String(p.id)) || {};
      const pmVal = Number(st.plus_minus || 0);
      const pmText = pmVal > 0 ? `+${pmVal}` : String(pmVal);
      const pmColor = pmVal < 0 ? '#ef4444' : pmVal > 0 ? '#16a34a' : '#64748b';

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 12px;" data-player-id="${p.id}">
          <td style="padding: 8px; font-weight: 700; color: #0f172a; white-space: nowrap;">#${p.jersey ?? '-'} ${p.first_name || ''} ${p.last_name || ''}</td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="minutes" value="${st.minutes ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 45px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="fg2_made" value="${st.fg2_made ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="fg2_attempted" value="${st.fg2_attempted ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="fg3_made" value="${st.fg3_made ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="fg3_attempted" value="${st.fg3_attempted ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="ft_made" value="${st.ft_made ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="ft_attempted" value="${st.ft_attempted ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="off_reb" value="${st.off_reb ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="def_reb" value="${st.def_reb ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="assists" value="${st.assists ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="steals" value="${st.steals ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="blocks" value="${st.blocks ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="turnovers" value="${st.turnovers ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="fouls_committed" value="${st.fouls_committed ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 4px;"><input type="number" class="st-input" data-field="fouls_received" value="${st.fouls_received ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 36px; text-align: center; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px;" /></td>
          <td style="padding: 8px; text-align: center; font-weight: 800; color: ${pmColor};">${pmText}</td>
        </tr>
      `;
    }).join("");

    const quarters = this.currentPeriods.filter(p => !p.is_overtime);
    const overtimes = this.currentPeriods.filter(p => p.is_overtime);

    const quartersMarkup = quarters.map((q, i) => `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 12px; font-weight: 700; color: #64748b;">${i + 1}º ${TranslationStore.t("quarter", "cuarto")}:</span>
        <input type="number" class="q-input" data-index="${i}" data-side="team" value="${q.team_score}" ${canEdit ? '' : 'disabled'} style="width: 50px; height: 40px; text-align: center; padding: 6px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-weight: 800;" /> -
        <input type="number" class="q-input" data-index="${i}" data-side="opp" value="${q.opponent_score}" ${canEdit ? '' : 'disabled'} style="width: 50px; height: 40px; text-align: center; padding: 6px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-weight: 800;" />
      </div>
    `).join("");

    const overtimesMarkup = overtimes.map((ot, i) => `
      <div style="display: flex; align-items: center; gap: 6px; background: #fff7ed; border: 1px solid #ffedd5; padding: 4px 8px; border-radius: 8px;">
        <span style="font-size: 12px; font-weight: 800; color: #c2410c;">${TranslationStore.t("overtime", "Prórroga")} ${i + 1}:</span>
        <input type="number" class="ot-input" data-otindex="${i}" data-side="team" value="${ot.team_score}" ${canEdit ? '' : 'disabled'} style="width: 48px; height: 36px; text-align: center; padding: 4px; border: 1px solid #fdba74; border-radius: 6px; font-size: 14px; font-weight: 800;" />
        <span>-</span>
        <input type="number" class="ot-input" data-otindex="${i}" data-side="opp" value="${ot.opponent_score}" ${canEdit ? '' : 'disabled'} style="width: 48px; height: 36px; text-align: center; padding: 4px; border: 1px solid #fdba74; border-radius: 6px; font-size: 14px; font-weight: 800;" />
        ${canEdit ? `
          <button type="button" class="btn-delete-ot" data-otindex="${i}" style="background: none; border: none; font-size: 14px; cursor: pointer; color: #ef4444; margin-left: 4px; min-height: 44px; min-width: 44px;" title="${TranslationStore.t("delete_ot", "Eliminar prórroga")}">🗑️</button>
        ` : ''}
      </div>
    `).join("");

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">${TranslationStore.t("edit_game", "Editar partido")}</h1>
          <button id="btn-cancel-edit" style="background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;">✕ ${TranslationStore.t("cancel", "Cancelar")}</button>
        </div>

        <form id="form-game-editor" style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; display: flex; flex-direction: column; gap: 20px;">
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
            <div><label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("date", "Fecha")}</label><input type="date" name="date" value="${g.date || ''}" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" /></div>
            <div><label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("time", "Hora")}</label><input type="time" name="time" value="${g.time || '18:00'}" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" /></div>
            <div><label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("opponent", "Rival")} *</label><input type="text" name="opponent" value="${g.opponent || ''}" ${canEdit ? '' : 'disabled'} required style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" /></div>
            <div><label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("competition", "Competición")}</label><input type="text" name="competition" value="${g.competition || 'B1'}" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" /></div>
            <div><label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("matchday", "Jornada")}</label><input type="text" name="matchday" value="${g.matchday || ''}" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" /></div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("venue", "Sede")}</label>
              <select name="venue" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: white;">
                <option value="Local" ${g.venue === 'Local' ? 'selected' : ''}>${TranslationStore.t("local", "Local")}</option>
                <option value="Visitante" ${g.venue === 'Visitante' ? 'selected' : ''}>${TranslationStore.t("visitor", "Visitante")}</option>
              </select>
            </div>
            <div><label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("arena", "Pabellón / Arena")}</label><input type="text" name="arena" value="${g.arena || ''}" ${canEdit ? '' : 'disabled'} placeholder="Ej: Polideportivo Municipal" style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" /></div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("status", "Estado")}</label>
              <select name="status" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: white;">
                <option value="Finalizado" ${g.status === 'Finalizado' ? 'selected' : ''}>${TranslationStore.t("completed", "Finalizado")}</option>
                <option value="Programado" ${g.status === 'Programado' ? 'selected' : ''}>${TranslationStore.t("scheduled", "Programado")}</option>
                <option value="En juego" ${g.status === 'En juego' ? 'selected' : ''}>${TranslationStore.t("live", "En juego")}</option>
              </select>
            </div>
          </div>

          <!-- BLOQUE DE MARCADOR GLOBAL MANUAL -->
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div>
              <span style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; display: block;">MARCADOR FINAL DECLARADO</span>
              <span style="font-size: 11px; color: #64748b;">Puntos oficiales del partido (A Favor vs En Contra)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="text-align: center;">
                <label style="font-size: 10px; font-weight: 800; color: #1e3a8a; display: block;">A FAVOR</label>
                <input type="number" name="team_score" value="${initTeamScore}" ${canEdit ? '' : 'disabled'} style="width: 60px; height: 44px; text-align: center; padding: 6px; border: 2px solid #1e3a8a; border-radius: 8px; font-size: 16px; font-weight: 900; color: #1e3a8a;" />
              </div>
              <span style="font-size: 20px; font-weight: 900; color: #94a3b8; margin-top: 12px;">-</span>
              <div style="text-align: center;">
                <label style="font-size: 10px; font-weight: 800; color: #c2410c; display: block;">EN CONTRA</label>
                <input type="number" name="opponent_score" value="${initOppScore}" ${canEdit ? '' : 'disabled'} style="width: 60px; height: 44px; text-align: center; padding: 6px; border: 2px solid #f97316; border-radius: 8px; font-size: 16px; font-weight: 900; color: #c2410c;" />
              </div>
            </div>
          </div>

          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 4px 0;" />

          <div>
            <h3 style="font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 12px 0;">${TranslationStore.t("starting_five", "QUINTETO TITULAR")} (${starters.length}/5)</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
              ${startersMarkup}
            </div>
          </div>

          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 4px 0;" />

          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
              <h3 style="font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0;">${TranslationStore.t("player_stats", "Estadísticas de Jugadores")} (${this.players.length})</h3>
              <span id="points-match-badge" style="font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; ${badgeClass}">
                ${badgeText}
              </span>
            </div>

            <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
              <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="background: #f8fafc; font-size: 10px; font-weight: 800; color: #64748b; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 10px;">${TranslationStore.t("player", "Jugador")}</th>
                    <th style="padding: 10px;">MIN</th>
                    <th style="padding: 10px;">T2C</th><th style="padding: 10px;">T2I</th>
                    <th style="padding: 10px;">T3C</th><th style="padding: 10px;">T3I</th>
                    <th style="padding: 10px;">TLC</th><th style="padding: 10px;">TLI</th>
                    <th style="padding: 10px;">RO</th><th style="padding: 10px;">RD</th>
                    <th style="padding: 10px;">AST</th><th style="padding: 10px;">ROB</th><th style="padding: 10px;">TAP</th>
                    <th style="padding: 10px;">PER</th><th style="padding: 10px;">FC</th><th style="padding: 10px;">FR</th>
                    <th style="padding: 10px;">+/- (${TranslationStore.t("system", "Sistema")})</th>
                  </tr>
                </thead>
                <tbody>
                  ${playerRowsMarkup}
                </tbody>
              </table>
            </div>
          </div>

          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 4px 0;" />

          <!-- RESULTADO POR CUARTOS CON INDICADOR DE DIFERENCIA VS TOTAL -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <h3 style="font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0;">${TranslationStore.t("quarter_results", "RESULTADO POR CUARTOS")}</h3>
                <span id="quarters-diff-badge" style="font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; ${qBadgeClass}">
                  ${qBadgeText}
                </span>
              </div>
              
              <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <span id="total-score-display" style="background: #f1f5f9; color: #0f172a; font-size: 11px; font-weight: 800; padding: 6px 14px; border-radius: 8px;">
                  Suma Cuartos: ${qTeamSum} - ${qOppSum} | Marcador: ${initTeamScore} - ${initOppScore}
                </span>
                <span id="result-status-display" style="background: ${isWin ? '#dcfce7' : '#fef2f2'}; color: ${isWin ? '#166534' : '#dc2626'}; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 8px;">
                  ${isWin ? TranslationStore.t("win", "Victoria") : TranslationStore.t("loss", "Derrota")}
                </span>
              </div>
            </div>

            <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
              ${quartersMarkup}
              ${overtimesMarkup}

              ${canEdit ? `
                <button type="button" id="btn-add-ot" style="background: #f1f5f9; color: #1e3a8a; border: 1px dashed #2563eb; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px;">
                  + ${TranslationStore.t("add_overtime", "Añadir Prórroga (OT)")}
                </button>
              ` : ''}
            </div>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("notes", "Observaciones")}</label>
            <textarea name="notes" rows="3" ${canEdit ? '' : 'disabled'} style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-family: inherit;" placeholder="${TranslationStore.t("notes_placeholder", "Notas tácticas del partido...")}">${g.notes || ''}</textarea>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("video_url", "Enlace a vídeo (opcional)")}</label>
            <input type="text" name="video_url" value="${g.video_url || ''}" ${canEdit ? '' : 'disabled'} placeholder="https://..." style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;">
            <button type="button" id="btn-cancel-edit-form" style="background: #f1f5f9; color: #475569; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">${TranslationStore.t("cancel", "Cancelar")}</button>
            ${canEdit ? `
              <button type="submit" style="background: var(--color-primary, #ea580c); color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">💾 ${TranslationStore.t("save_changes", "Guardar cambios")}</button>
            ` : ''}
          </div>

        </form>
      </div>
    `;

    container.querySelector("#btn-cancel-edit")?.addEventListener("click", () => {
      this.isEditing = false;
      this._renderGamesList(container, g.team_id || "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22");
    });

    container.querySelector("#btn-cancel-edit-form")?.addEventListener("click", () => {
      this.isEditing = false;
      this._renderGamesList(container, g.team_id || "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22");
    });

    if (canEdit) {
      // Listeners para campos de marcador total manual
      container.querySelector('input[name="team_score"]')?.addEventListener("input", () => {
        this._updateScoreBadgeAndTotals(container);
      });

      container.querySelector('input[name="opponent_score"]')?.addEventListener("input", () => {
        this._updateScoreBadgeAndTotals(container);
      });

      container.querySelectorAll(".btn-starter").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          let currentStarters = this.currentGame.starter_ids || [];
          if (currentStarters.includes(id)) {
            currentStarters = currentStarters.filter(s => s !== id);
          } else {
            if (currentStarters.length >= 5) {
              alert(TranslationStore.t("max_starters_warning", "Solo puedes seleccionar máximo 5 titulares."));
              return;
            }
            currentStarters.push(id);
          }
          this.currentGame.starter_ids = currentStarters;
          this._renderEditFormPreservingScroll(container);
        });
      });

      // MODIFICAR CUARTOS
      container.querySelectorAll(".q-input").forEach(inp => {
        inp.addEventListener("input", (e) => {
          const idx = Number(e.target.getAttribute("data-index"));
          const side = e.target.getAttribute("data-side");
          const val = Number(e.target.value || 0);

          const quartersList = this.currentPeriods.filter(p => !p.is_overtime);
          if (quartersList[idx]) {
            if (side === "team") quartersList[idx].team_score = val;
            else quartersList[idx].opponent_score = val;
          }
          this._updateScoreBadgeAndTotals(container);
        });
      });

      // AÑADIR PRÓRROGA
      container.querySelector("#btn-add-ot")?.addEventListener("click", () => {
        const overtimesList = this.currentPeriods.filter(p => p.is_overtime);
        const otNumber = overtimesList.length + 1;
        this.currentPeriods.push({
          period_type: 'overtime',
          period_number: otNumber,
          team_score: 0,
          opponent_score: 0,
          is_overtime: true
        });
        this._renderEditFormPreservingScroll(container);
      });

      // MODIFICAR PRÓRROGAS
      container.querySelectorAll(".ot-input").forEach(inp => {
        inp.addEventListener("input", (e) => {
          const otIdx = Number(e.target.getAttribute("data-otindex"));
          const side = e.target.getAttribute("data-side");
          const val = Number(e.target.value || 0);

          const overtimesList = this.currentPeriods.filter(p => p.is_overtime);
          if (overtimesList[otIdx]) {
            if (side === "team") overtimesList[otIdx].team_score = val;
            else overtimesList[otIdx].opponent_score = val;
          }
          this._updateScoreBadgeAndTotals(container);
        });
      });

      // ELIMINAR PRÓRROGA
      container.querySelectorAll(".btn-delete-ot").forEach(btn => {
        btn.addEventListener("click", () => {
          const otIdx = Number(btn.getAttribute("data-otindex"));
          const overtimesList = this.currentPeriods.filter(p => p.is_overtime);
          
          if (overtimesList[otIdx]) {
            const targetOt = overtimesList[otIdx];
            this.currentPeriods = this.currentPeriods.filter(p => p !== targetOt);
            
            let otCount = 1;
            this.currentPeriods.forEach(p => {
              if (p.is_overtime) {
                p.period_number = otCount++;
              }
            });

            this._renderEditFormPreservingScroll(container);
          }
        });
      });

      // MODIFICAR ESTADÍSTICAS INDIVIDUALES
      container.querySelectorAll(".st-input").forEach(inp => {
        inp.addEventListener("input", (e) => {
          const tr = e.target.closest("tr");
          const playerId = tr.getAttribute("data-player-id");
          const field = e.target.getAttribute("data-field");
          const val = Number(e.target.value || 0);

          const st = this.currentGameStats.find(s => String(s.player_id) === String(playerId));
          if (st) {
            st[field] = val;
          }
          this._updateScoreBadgeAndTotals(container);
        });
      });

      const form = container.querySelector("#form-game-editor");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const formData = new FormData(form);

          const teamScore = Number(formData.get("team_score") || 0);
          const oppScore = Number(formData.get("opponent_score") || 0);
          const overtimesCount = this.currentPeriods.filter(p => p.is_overtime).length;

          const gameData = {
            id: g.id,
            team_id: g.team_id || "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22",
            date: formData.get("date"),
            time: formData.get("time"),
            opponent: formData.get("opponent"),
            competition: formData.get("competition"),
            matchday: formData.get("matchday"),
            venue: formData.get("venue"),
            arena: formData.get("arena"),
            status: formData.get("status"),
            starter_ids: this.currentGame.starter_ids || [],
            team_score: teamScore,
            opponent_score: oppScore,
            has_overtime: overtimesCount > 0,
            overtime_count: overtimesCount,
            notes: formData.get("notes"),
            video_url: formData.get("video_url")
          };

          await DataStore.saveGameAndStats(gameData, this.currentGameStats, this.currentPeriods);

          this.isEditing = false;
          alert("✅ " + TranslationStore.t("game_saved_msg", "Partido guardado exitosamente con cuartos y prórrogas sincronizados en 'game_period_scores'."));
          this._renderGamesList(container, gameData.team_id);
        });
      }
    }
  }
}

export default GameLiveEditorView;