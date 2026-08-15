/**
 * @fileoverview Vista de Partidos y Formulario de Edición (GameLiveEditorView.js).
 * - Sincronización en tiempo real de marcador declarado con la suma de cuartos.
 * - Registro con coordenadas automáticas por defecto para tiros de botones rápidos.
 * - Mapeo estricto con las columnas de Supabase: 'round', 'venue_name', 'season_id'.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class GameLiveEditorView {
  constructor(gameController, authController) {
    this.gameController = gameController;
    this.auth = authController;
    this.supabase = gameController?.supabase || gameController?.options?.supabase || DataStore.supabase;
    this.games = [];
    this.players = [];
    this.currentGame = null;
    this.currentGameStats = [];
    this.currentPeriods = [];
    this.filterCondition = "Todos";
    this.sortOrder = "desc";
    this.isEditing = false;
    
    // Estado para Modo Rápido / Pista
    this.entrySubMode = "classic"; // 'classic' | 'fast' | 'court'
    this.activePeriodNumber = 1;
    this.isPeriodOvertime = false;
    this.selectedPlayerId = null;
    this.selectedPlayerName = null;
    this.pendingShot = null;
    this.liveEventsHistory = [];
    this.opponentStats = { oreb: 0, dreb: 0, tov: 0, ast: 0, blk_made: 0, blk_received: 0, fouls: 0 };
  }

  _canEdit() {
    if (!this.auth || typeof this.auth.hasRole !== "function") return true;
    return (
      this.auth.hasRole("SUPERADMIN") ||
      this.auth.hasRole("ADMIN") ||
      this.auth.hasRole("ENTRENADOR") ||
      this.auth.hasRole("ANALISTA")
    );
  }

  async render(containerId = "dashboard-content-area", gameId = null, teamId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.teamId = teamId || DataStore.getActiveTeamId();
    this.players = DataStore.getPlayers() || [];

    if (gameId && gameId !== this.teamId) {
      await this._openEditForm(gameId, container);
      return;
    }

    if (this.isEditing && this.currentGame) {
      this._renderEditForm(container);
    } else {
      await this._renderGamesList(container, this.teamId);
    }
  }

  async _renderGamesList(container, teamId) {
    this.games = DataStore.getGames() || [];
    const canEdit = this._canEdit();

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

      const periods = DataStore.getGamePeriodScores(g.id) || [];
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
                📅 ${formattedDate} &nbsp;·&nbsp; 🏆 ${g.competition || 'Liga'} &nbsp;·&nbsp; 📍 ${g.venue_name || '-'}
              </div>
              <div style="font-size: 11px; color: #64748b; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid #f1f5f9; display: inline-block;">
                <b>${TranslationStore.t("quarters", "CUARTOS")}:</b> Q1: ${q1} &nbsp; Q2: ${q2} &nbsp; Q3: ${q3} &nbsp; Q4: ${q4} ${otMarkup ? `&nbsp; ${otMarkup}` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button onclick="window.location.hash='#/boxscore/${g.id}'" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px;">👁️ Boxscore</button>
            <button onclick="window.location.hash='#/reports'" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px;">📊 ${TranslationStore.t("report", "Informe")}</button>
            
            ${canEdit ? `
              <button class="btn-edit-game" data-id="${g.id}" style="background: #0284c7; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 44px; display: inline-flex; align-items: center; gap: 4px;">⚙️ ${TranslationStore.t("edit", "Editar / Datos")}</button>
              <button class="btn-delete-game" data-id="${g.id}" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #ef4444; min-height: 44px; min-width: 44px;" title="${TranslationStore.t("delete_game", "Eliminar partido")}">🗑️</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">${TranslationStore.t("team_games", "Partidos del Equipo")}</h1>
            <span style="font-size: 13px; color: #64748b;">${this.games.length} ${TranslationStore.t("registered_games", "partidos registrados")}</span>
          </div>

          ${canEdit ? `
            <button id="btn-create-game" style="background: var(--color-primary, #ea580c); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;">
              + ${TranslationStore.t("register_new_game", "Registrar Nuevo Partido")}
            </button>
          ` : `
            <button style="background: #cbd5e1; color: #64748b; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: not-allowed; min-height: 44px;">🔒 + ${TranslationStore.t("register_new_game", "Registrar Nuevo Partido")}</button>
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

    if (canEdit) {
      container.querySelector("#btn-create-game")?.addEventListener("click", () => {
        const activeTeam = DataStore.getTeamById(teamId) || {};
        this.currentGame = {
          date: new Date().toISOString().split("T")[0],
          time: "18:00",
          opponent: "",
          competition: activeTeam.competition || "B1",
          round: "Jornada " + (this.games.length + 1),
          venue: "Local",
          venue_name: "",
          status: "Finalizado",
          starter_ids: [],
          notes: "",
          video_url: "",
          team_score: null,
          opponent_score: null
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
        this.liveEventsHistory = [];
        this.entrySubMode = "classic";
        this.isEditing = true;
        this._renderEditForm(container);
      });

      container.querySelectorAll(".btn-edit-game").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const id = e.currentTarget.getAttribute("data-id");
          this._openEditForm(id, container);
        });
      });

      container.querySelectorAll(".btn-delete-game").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.getAttribute("data-id");
          if (confirm(TranslationStore.t("confirm_delete_game", "¿Estás seguro de que deseas eliminar este partido?"))) {
            if (this.supabase) {
              await this.supabase.from("game_events").delete().eq("game_id", id);
              await this.supabase.from("game_period_scores").delete().eq("game_id", id);
              await this.supabase.from("player_game_stats").delete().eq("game_id", id);
              await this.supabase.from("games").delete().eq("id", id);
            }
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

  async _openEditForm(gameId, container) {
    this.currentGame = DataStore.getGameById(gameId) || {};
    const existingPeriods = DataStore.getGamePeriodScores(gameId) || [];

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
      return existing ? { ...existing } : {
        player_id: p.id, minutes: 0, fg2_made: 0, fg2_attempted: 0, fg3_made: 0, fg3_attempted: 0,
        ft_made: 0, ft_attempted: 0, off_reb: 0, def_reb: 0, assists: 0, steals: 0, blocks: 0,
        turnovers: 0, fouls_committed: 0, fouls_received: 0, plus_minus: 0
      };
    });

    if (this.supabase && gameId) {
      try {
        const { data } = await this.supabase
          .from("game_events")
          .select("*")
          .eq("game_id", gameId)
          .order("created_at", { ascending: true });

        if (data && data.length > 0) {
          this.liveEventsHistory = data.map(ev => {
            const pObj = this.players.find(p => String(p.id) === String(ev.player_id));
            return {
              id: ev.id,
              playerId: ev.player_id,
              playerName: pObj ? `#${pObj.jersey ?? '-'} ${pObj.first_name || ''}` : "Equipo",
              action: ev.action_type,
              points: ev.points || 0,
              period: ev.period,
              isOpponent: !ev.player_id && String(ev.action_type || '').includes("opp"),
              coordinates: ev.coord_x ? { x: ev.coord_x, y: ev.coord_y, made: ev.made } : null
            };
          });
        } else {
          this.liveEventsHistory = [];
        }
      } catch (err) {
        console.warn("Nota cargando eventos previos:", err);
      }
    }

    this.isEditing = true;
    this._renderEditForm(container);
  }

  _renderEditFormPreservingScroll(container) {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    this._renderEditForm(container);
    window.scrollTo(0, scrollTop);
  }

  _updateScoreBadgeAndTotals(container) {
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

    const inpTeamScore = container.querySelector('input[name="team_score"]');
    const inpOppScore = container.querySelector('input[name="opponent_score"]');

    // Sincronizar inputs visuales del marcador final declarado
    if (inpTeamScore && (this.entrySubMode === "fast" || this.entrySubMode === "court" || inpTeamScore.value === "")) {
      inpTeamScore.value = qTeamSum;
    }
    if (inpOppScore && (this.entrySubMode === "fast" || this.entrySubMode === "court" || inpOppScore.value === "")) {
      inpOppScore.value = qOppSum;
    }

    const totalTeamScore = inpTeamScore && inpTeamScore.value !== "" ? Number(inpTeamScore.value) : qTeamSum;
    const totalOppScore = inpOppScore && inpOppScore.value !== "" ? Number(inpOppScore.value) : qOppSum;

    if (this.currentGame) {
      this.currentGame.team_score = totalTeamScore;
      this.currentGame.opponent_score = totalOppScore;
    }

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

    // Si team_score no se ha fijado a mano, sincroniza automáticamente con la suma de los cuartos
    const initTeamScore = (g.team_score !== null && g.team_score !== undefined && g.team_score !== 0) 
      ? Number(g.team_score) 
      : qTeamSum;
    const initOppScore = (g.opponent_score !== null && g.opponent_score !== undefined && g.opponent_score !== 0) 
      ? Number(g.opponent_score) 
      : qOppSum;

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

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">${TranslationStore.t("edit_game", "Datos y Edición del Partido")}</h1>
            <span style="font-size: 12px; color: #64748b;">Rellena los datos generales y selecciona tu modo de entrada preferido</span>
          </div>
          <button id="btn-cancel-edit" style="background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;">✕ ${TranslationStore.t("cancel", "Cancelar")}</button>
        </div>

        <form id="form-game-editor" style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; display: flex; flex-direction: column; gap: 20px;">
          
          <!-- 1. METADATOS GENERALES DEL ENCUENTRO -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("date", "Fecha")}</label>
              <input type="date" name="date" class="meta-input" data-key="date" value="${g.date || ''}" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("time", "Hora")}</label>
              <input type="time" name="time" class="meta-input" data-key="time" value="${g.time || '18:00'}" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("opponent", "Rival")} *</label>
              <input type="text" name="opponent" class="meta-input" data-key="opponent" value="${g.opponent || ''}" ${canEdit ? '' : 'disabled'} required placeholder="Nombre del rival" style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("competition", "Competición")}</label>
              <input type="text" name="competition" class="meta-input" data-key="competition" value="${g.competition || ''}" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("matchday", "Jornada")}</label>
              <input type="text" name="round" class="meta-input" data-key="round" value="${g.round || ''}" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("venue", "Sede")}</label>
              <select name="venue" class="meta-input" data-key="venue" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: white;">
                <option value="Local" ${g.venue === 'Local' ? 'selected' : ''}>${TranslationStore.t("local", "Local")}</option>
                <option value="Visitante" ${g.venue === 'Visitante' ? 'selected' : ''}>${TranslationStore.t("visitor", "Visitante")}</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("arena", "Pabellón / Arena")}</label>
              <input type="text" name="venue_name" class="meta-input" data-key="venue_name" value="${g.venue_name || ''}" ${canEdit ? '' : 'disabled'} placeholder="Ej: Polideportivo Municipal" style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("status", "Estado")}</label>
              <select name="status" class="meta-input" data-key="status" ${canEdit ? '' : 'disabled'} style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: white;">
                <option value="Finalizado" ${g.status === 'Finalizado' ? 'selected' : ''}>${TranslationStore.t("completed", "Finalizado")}</option>
                <option value="Programado" ${g.status === 'Programado' ? 'selected' : ''}>${TranslationStore.t("scheduled", "Programado")}</option>
                <option value="En juego" ${g.status === 'En juego' ? 'selected' : ''}>${TranslationStore.t("live", "En juego")}</option>
              </select>
            </div>
          </div>

          <!-- 2. QUINTETO TITULAR -->
          <div>
            <h3 style="font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 10px 0;">${TranslationStore.t("starting_five", "QUINTETO TITULAR")} (${starters.length}/5)</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px;">
              ${startersMarkup}
            </div>
          </div>

          <hr style="border: 0; border-top: 2px solid #e2e8f0; margin: 6px 0;" />

          <!-- 3. SELECTOR DE MODO DE ENTRADA -->
          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <span style="font-size: 0.8rem; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Selecciona cómo deseas registrar las estadísticas:</span>
              <div style="font-size: 0.8rem; color: #64748b;">Puedes alternar en cualquier momento sin perder datos</div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" id="btn-mode-classic" style="padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid #cbd5e1; background: ${this.entrySubMode === 'classic' ? '#0f172a' : 'white'}; color: ${this.entrySubMode === 'classic' ? 'white' : '#475569'};">
                📊 Modo Acta Oficial / Cuadrícula
              </button>
              <button type="button" id="btn-mode-fast" style="padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid #cbd5e1; background: ${this.entrySubMode === 'fast' ? '#0284c7' : 'white'}; color: ${this.entrySubMode === 'fast' ? 'white' : '#475569'};">
                ⚡ Modo Rápido (Acciones y Rival)
              </button>
              <button type="button" id="btn-mode-court" style="padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid #cbd5e1; background: ${this.entrySubMode === 'court' ? '#16a34a' : 'white'}; color: ${this.entrySubMode === 'court' ? 'white' : '#475569'};">
                🏀 Modo Pista (Mapa de Calor)
              </button>
            </div>
          </div>

          <!-- CONTENIDO CONDICIONAL SEGÚN MODO SELECCIONADO -->
          <div id="entry-mode-content-container">
            ${this.entrySubMode === 'classic' 
              ? this._renderClassicModeMarkup(initTeamScore, initOppScore, isPlayerPointsMatch, badgeClass, badgeText, qBadgeClass, qBadgeText, qTeamSum, qOppSum, isWin, canEdit) 
              : this._renderIntegratedLiveModeMarkup(canEdit, qTeamSum, qOppSum)}
          </div>

          <!-- OBSERVACIONES Y VÍDEO -->
          <div>
            <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("notes", "Observaciones")}</label>
            <textarea name="notes" class="meta-input" data-key="notes" rows="3" ${canEdit ? '' : 'disabled'} style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-family: inherit;" placeholder="${TranslationStore.t("notes_placeholder", "Notas tácticas del partido...")}">${g.notes || ''}</textarea>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${TranslationStore.t("video_url", "Enlace a vídeo (opcional)")}</label>
            <input type="text" name="video_url" class="meta-input" data-key="video_url" value="${g.video_url || ''}" ${canEdit ? '' : 'disabled'} placeholder="https://..." style="width: 100%; height: 44px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
          </div>

          <!-- BOTONES FINALES DE GUARDADO -->
          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;">
            <button type="button" id="btn-cancel-edit-form" style="background: #f1f5f9; color: #475569; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 44px;">${TranslationStore.t("cancel", "Cancelar")}</button>
            ${canEdit ? `
              <button type="submit" id="btn-submit-game-all" style="background: var(--color-primary, #ea580c); color: white; border: none; padding: 12px 30px; border-radius: 8px; font-weight: 800; cursor: pointer; min-height: 44px; font-size: 14px;">💾 ${TranslationStore.t("save_changes", "Guardar Partido y Estadísticas")}</button>
            ` : ''}
          </div>

        </form>
      </div>
    `;

    this._bindUnifiedFormEvents(container, canEdit, g);
  }

  /* MODO 1: CLÁSICO CON CUADRÍCULA COMPLETA */
  _renderClassicModeMarkup(initTeamScore, initOppScore, isPlayerPointsMatch, badgeClass, badgeText, qBadgeClass, qBadgeText, qTeamSum, qOppSum, isWin, canEdit) {
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

    return `
      <!-- MARCADOR GLOBAL MANUAL -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
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

      <!-- ESTADÍSTICAS INDIVIDUALES -->
      <div style="margin-bottom: 16px;">
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

      <!-- RESULTADO POR CUARTOS -->
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
    `;
  }

  /* MODO 2 Y 3: MODO RÁPIDO & PISTA + LISTADO CRONOLÓGICO DE JUGADAS */
  _renderIntegratedLiveModeMarkup(canEdit, qTeamSum = 0, qOppSum = 0) {
    const quarters = this.currentPeriods.filter(p => !p.is_overtime);
    const overtimes = this.currentPeriods.filter(p => p.is_overtime);

    const getActionLabel = (action) => {
      const map = {
        fg2_made: `+2 Canasta`,
        fg3_made: `+3 Triple`,
        ft_made: `+1 Tiro Libre`,
        fg2_attempted: `Fallo Tiro de 2`,
        fg3_attempted: `Fallo Triple`,
        ft_attempted: `Fallo Tiro Libre`,
        off_reb: `Rebote Ofensivo`,
        def_reb: `Rebote Defensivo`,
        assists: `Asistencia`,
        steals: `Robo de Balón`,
        blocks: `Tapón Realizado`,
        turnovers: `Pérdida de Balón`,
        fouls_committed: `Falta Cometida`,
        fouls_received: `Falta Recibida`
      };
      return map[action] || action;
    };

    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- BARRA DE SELECCIÓN DE CUARTO / PRÓRROGA ACTIVA -->
        <div style="background: #0f172a; color: white; border-radius: 10px; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.8rem; font-weight: 800; color: #38bdf8; text-transform: uppercase;">Periodo Activo:</span>
            <div style="display: flex; gap: 4px;">
              ${quarters.map((q, i) => `
                <button type="button" class="btn-period-select ${this.activePeriodNumber === (i + 1) && !this.isPeriodOvertime ? 'active' : ''}" data-period="${i + 1}" data-ot="false" style="padding: 6px 12px; border-radius: 6px; border: none; font-weight: 800; font-size: 0.85rem; cursor: pointer; background: ${this.activePeriodNumber === (i + 1) && !this.isPeriodOvertime ? '#ea580c' : '#334155'}; color: white;">
                  Q${i + 1} (${q.team_score}-${q.opponent_score})
                </button>
              `).join('')}

              ${overtimes.map((ot, i) => `
                <button type="button" class="btn-period-select ${this.activePeriodNumber === (i + 1) && this.isPeriodOvertime ? 'active' : ''}" data-period="${i + 1}" data-ot="true" style="padding: 6px 12px; border-radius: 6px; border: none; font-weight: 800; font-size: 0.85rem; cursor: pointer; background: ${this.activePeriodNumber === (i + 1) && this.isPeriodOvertime ? '#ea580c' : '#475569'}; color: white;">
                  OT${i + 1} (${ot.team_score}-${ot.opponent_score})
                </button>
              `).join('')}

              ${canEdit ? `
                <button type="button" id="btn-add-ot-live" style="background: #1e293b; color: #38bdf8; border: 1px dashed #38bdf8; padding: 6px 10px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer;">+ OT</button>
              ` : ''}
            </div>
          </div>

          <div style="font-size: 13px; font-weight: 700; color: #94a3b8;">
            Marcador Actual: <strong style="color: #38bdf8;">${qTeamSum}</strong> - <strong style="color: #f43f5e;">${qOppSum}</strong>
          </div>
        </div>

        <!-- CUERPO PRINCIPAL DEL MODO RÁPIDO -->
        <div style="display: grid; grid-template-columns: ${this.entrySubMode === 'court' ? '260px 1fr 240px' : '280px 1fr'}; gap: 14px;">
          
          <!-- PANEL IZQUIERDO: SELECCIÓN DE JUGADOR DE TU EQUIPO -->
          <section style="background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px;">
            <h3 style="font-size: 0.85rem; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase;">1️⃣ Elige Jugador y Minutos</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px;">
              ${this.players.map(p => {
                const st = this.currentGameStats.find(s => String(s.player_id) === String(p.id)) || { minutes: 0 };
                return `
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button type="button" class="live-player-btn ${this.selectedPlayerId === p.id ? 'active' : ''}" 
                            data-id="${p.id}" data-name="#${p.jersey ?? '-'} ${p.first_name || ''}"
                            style="display: flex; flex-direction: column; align-items: center; padding: 8px 4px; border: 2px solid ${this.selectedPlayerId === p.id ? '#0284c7' : '#e2e8f0'}; background: ${this.selectedPlayerId === p.id ? '#e0f2fe' : '#f8fafc'}; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 1.2rem; font-weight: 900; color: #0f172a;">#${p.jersey ?? '-'}</span>
                      <span style="font-size: 0.75rem; font-weight: 700; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75px;">${p.first_name || p.name}</span>
                    </button>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                      <span style="font-size: 0.65rem; color: #64748b; font-weight: 800;">MIN</span>
                      <input type="number" class="st-input" data-player-id="${p.id}" data-field="minutes" value="${st.minutes ?? 0}" ${canEdit ? '' : 'disabled'} style="width: 40px; height: 24px; text-align: center; padding: 2px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.75rem; font-weight: 700;" />
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>

          <!-- SI ESTAMOS EN MODO PISTA: SVG INTERACTIVO -->
          ${this.entrySubMode === 'court' ? `
            <section style="background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; align-items: center;">
              <div style="font-size: 0.8rem; font-weight: 800; color: #334155; margin-bottom: 6px; width: 100%; display: flex; justify-content: space-between;">
                <span>📍 Toca el punto exacto del tiro</span>
                <span id="court-shot-hint" style="color: #0284c7;">Paso 2: Toca el punto en cancha</span>
              </div>
              <div style="position: relative; width: 100%; max-width: 440px; aspect-ratio: 50/47; background: #e09f67; border: 3px solid #fff; border-radius: 8px; overflow: hidden; cursor: crosshair;" id="court-canvas-clickarea">
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
                <div id="live-shot-markers-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
                  ${this.liveEventsHistory.filter(ev => ev.coordinates).map(ev => `
                    <div style="position: absolute; left: ${ev.coordinates.x}%; top: ${ev.coordinates.y}%; transform: translate(-50%, -50%); width: 12px; height: 12px; border-radius: 50%; background: ${ev.coordinates.made ? '#22c55e' : '#ef4444'}; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.5);"></div>
                  `).join('')}
                </div>
              </div>
            </section>
          ` : ''}

          <!-- PANEL CENTRAL/DERECHO: ACCIONES DE EQUIPO Y RIVAL -->
          <section style="background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
            <h3 style="font-size: 0.85rem; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">2️⃣ Registrar Acción</h3>

            ${this.entrySubMode === 'court' ? `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <button type="button" class="btn-live-court-outcome" data-made="true" style="background: #22c55e; color: white; border: none; padding: 12px 6px; border-radius: 8px; font-weight: 800; font-size: 0.95rem; cursor: pointer;">✔ ANOTADO</button>
                  <button type="button" class="btn-live-court-outcome" data-made="false" style="background: #ef4444; color: white; border: none; padding: 12px 6px; border-radius: 8px; font-weight: 800; font-size: 0.95rem; cursor: pointer;">✖ FALLADO</button>
                </div>

                <div style="background: #f1f5f9; padding: 8px; border-radius: 8px; border: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                  <button type="button" class="btn-court-ft" data-made="true" style="background: #84cc16; color: white; border: none; padding: 8px 4px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; cursor: pointer;">+1 TL Anotado</button>
                  <button type="button" class="btn-court-ft" data-made="false" style="background: #fca5a5; color: #7f1d1d; border: none; padding: 8px 4px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; cursor: pointer;">Fallo TL</button>
                </div>
              </div>
            ` : `
              <!-- TIROS PROPIOS (MODO BOTONES) -->
              <div>
                <div style="font-size: 0.7rem; font-weight: 800; color: #16a34a; margin-bottom: 4px; text-transform: uppercase;">Canastas Propias</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                  <button type="button" class="btn-fast-action" data-action="fg2_made" data-pts="2" style="background: #22c55e; color: white; border: none; padding: 12px 4px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer;">+2 Canasta</button>
                  <button type="button" class="btn-fast-action" data-action="fg3_made" data-pts="3" style="background: #16a34a; color: white; border: none; padding: 12px 4px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer;">+3 Triple</button>
                  <button type="button" class="btn-fast-action" data-action="ft_made" data-pts="1" style="background: #84cc16; color: white; border: none; padding: 12px 4px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer;">+1 Libre</button>
                </div>
              </div>

              <div>
                <div style="font-size: 0.7rem; font-weight: 800; color: #dc2626; margin-bottom: 4px; text-transform: uppercase;">Fallos Propios</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                  <button type="button" class="btn-fast-action" data-action="fg2_attempted" data-pts="0" style="background: #f87171; color: white; border: none; padding: 8px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer;">Fallo T2</button>
                  <button type="button" class="btn-fast-action" data-action="fg3_attempted" data-pts="0" style="background: #ef4444; color: white; border: none; padding: 8px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer;">Fallo T3</button>
                  <button type="button" class="btn-fast-action" data-action="ft_attempted" data-pts="0" style="background: #fca5a5; color: #7f1d1d; border: none; padding: 8px 4px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer;">Fallo TL</button>
                </div>
              </div>
            `}

            <!-- ACCIONES DEL JUEGO PROPIO -->
            <div>
              <div style="font-size: 0.7rem; font-weight: 800; color: #0284c7; margin-bottom: 4px; text-transform: uppercase;">Juego Propio</div>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                <button type="button" class="btn-fast-action" data-action="off_reb" style="background: #0284c7; color: white; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Reb Of</button>
                <button type="button" class="btn-fast-action" data-action="def_reb" style="background: #38bdf8; color: #0f172a; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Reb Def</button>
                <button type="button" class="btn-fast-action" data-action="assists" style="background: #6366f1; color: white; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Asistencia</button>
                <button type="button" class="btn-fast-action" data-action="steals" style="background: #8b5cf6; color: white; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Robo</button>
                <button type="button" class="btn-fast-action" data-action="blocks" style="background: #a855f7; color: white; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Tapón +</button>
                <button type="button" class="btn-fast-action" data-action="turnovers" style="background: #ea580c; color: white; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Pérdida</button>
                <button type="button" class="btn-fast-action" data-action="fouls_committed" style="background: #f59e0b; color: white; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Falta Com.</button>
                <button type="button" class="btn-fast-action" data-action="fouls_received" style="background: #fbbf24; color: #78350f; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Falta Rec.</button>
              </div>
            </div>

            <!-- BLOQUE DE ACCIONES DEL RIVAL -->
            <div style="background: #fff7ed; border: 1px solid #ffedd5; padding: 8px; border-radius: 8px;">
              <div style="font-size: 0.7rem; font-weight: 800; color: #c2410c; margin-bottom: 4px; text-transform: uppercase;">Estadísticas del Rival (Directo)</div>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                <button type="button" class="btn-opp-action" data-field="points" data-val="2" style="background: #ea580c; color: white; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; cursor: pointer;">+2 Rival</button>
                <button type="button" class="btn-opp-action" data-field="points" data-val="3" style="background: #c2410c; color: white; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; cursor: pointer;">+3 Rival</button>
                <button type="button" class="btn-opp-action" data-field="points" data-val="1" style="background: #f97316; color: white; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; cursor: pointer;">+1 TL Rival</button>
                <button type="button" class="btn-opp-action" data-field="oreb" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Reb Of Riv</button>
                <button type="button" class="btn-opp-action" data-field="dreb" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Reb Def Riv</button>
                <button type="button" class="btn-opp-action" data-field="tov" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Pérdida Riv</button>
                <button type="button" class="btn-opp-action" data-field="blk_made" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Tapón Riv</button>
                <button type="button" class="btn-opp-action" data-field="fouls" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; cursor: pointer;">Falta Riv</button>
              </div>
            </div>

          </section>
        </div>

        <!-- 4. PANEL DE HISTORIAL CRONOLÓGICO DE JUGADAS CON EDICIÓN Y BORRADO RÁPIDO -->
        <section style="background: white; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a;">📋 Historial de Jugadas Registradas (${this.liveEventsHistory.length})</h3>
              <span style="font-size: 0.8rem; color: #64748b;">Elimina cualquier acción errónea directamente desde este listado</span>
            </div>
            <button type="button" id="btn-clear-all-events" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">
              Vaciar Jugadas
            </button>
          </div>

          <div style="max-height: 280px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            ${this.liveEventsHistory.length === 0 ? `
              <div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 0.85rem;">
                No hay jugadas registradas aún. Selecciona un jugador y pulsa una acción.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                <thead style="background: #f8fafc; color: #475569; position: sticky; top: 0; z-index: 5;">
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 8px 10px;">#</th>
                    <th style="padding: 8px 10px;">Cuarto</th>
                    <th style="padding: 8px 10px;">Jugador / Equipo</th>
                    <th style="padding: 8px 10px;">Acción</th>
                    <th style="padding: 8px 10px;">Puntos</th>
                    <th style="padding: 8px 10px; text-align: right;">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${[...this.liveEventsHistory].reverse().map((ev, rIdx) => {
                    const originalIdx = this.liveEventsHistory.length - 1 - rIdx;
                    return `
                      <tr style="border-bottom: 1px solid #f1f5f9; background: ${ev.isOpponent ? '#fff7ed' : 'white'};">
                        <td style="padding: 6px 10px; color: #94a3b8; font-weight: 700;">${this.liveEventsHistory.length - rIdx}</td>
                        <td style="padding: 6px 10px;">
                          <span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">
                            ${ev.isOvertime ? 'OT' : 'Q'}${ev.period}
                          </span>
                        </td>
                        <td style="padding: 6px 10px; font-weight: 700; color: #0f172a;">
                          ${ev.isOpponent ? '🔴 Rival' : (ev.playerName || 'Jugador')}
                        </td>
                        <td style="padding: 6px 10px;">
                          ${ev.isOpponent ? `${ev.field} (${ev.points > 0 ? '+' + ev.points + ' pts' : ''})` : getActionLabel(ev.action)}
                          ${ev.coordinates ? `<span style="font-size: 0.75rem; color: #0284c7; margin-left: 4px;">[x:${ev.coordinates.x}%, y:${ev.coordinates.y}%]</span>` : ''}
                        </td>
                        <td style="padding: 6px 10px; font-weight: 800; color: ${ev.points > 0 ? '#16a34a' : '#64748b'};">
                          ${ev.points > 0 ? `+${ev.points}` : '0'}
                        </td>
                        <td style="padding: 6px 10px; text-align: right;">
                          <button type="button" class="btn-delete-single-event" data-idx="${originalIdx}" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer;" title="Eliminar jugada y restar estadísticas">
                            🗑️ Borrar
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        </section>

      </div>
    `;
  }

  /* BINDING DE EVENTOS */
  _bindUnifiedFormEvents(container, canEdit, g) {
    container.querySelectorAll(".meta-input").forEach(input => {
      const handleMetaChange = (e) => {
        const key = e.target.getAttribute("data-key");
        if (key && this.currentGame) {
          this.currentGame[key] = e.target.value;
        }
      };
      input.addEventListener("input", handleMetaChange);
      input.addEventListener("change", handleMetaChange);
    });

    container.querySelector("#btn-mode-classic")?.addEventListener("click", () => {
      this.entrySubMode = "classic";
      this._renderEditFormPreservingScroll(container);
    });

    container.querySelector("#btn-mode-fast")?.addEventListener("click", () => {
      this.entrySubMode = "fast";
      this._renderEditFormPreservingScroll(container);
    });

    container.querySelector("#btn-mode-court")?.addEventListener("click", () => {
      this.entrySubMode = "court";
      this._renderEditFormPreservingScroll(container);
    });

    const handleCancel = () => {
      this.isEditing = false;
      this._renderGamesList(container, g.team_id || this.teamId || DataStore.getActiveTeamId());
    };

    container.querySelector("#btn-cancel-edit")?.addEventListener("click", handleCancel);
    container.querySelector("#btn-cancel-edit-form")?.addEventListener("click", handleCancel);

    if (canEdit) {
      // Quinteto Titular
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

      // EVENTOS MODO CLÁSICO
      if (this.entrySubMode === "classic") {
        container.querySelector('input[name="team_score"]')?.addEventListener("input", () => this._updateScoreBadgeAndTotals(container));
        container.querySelector('input[name="opponent_score"]')?.addEventListener("input", () => this._updateScoreBadgeAndTotals(container));

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

        container.querySelector("#btn-add-ot")?.addEventListener("click", () => {
          const overtimesList = this.currentPeriods.filter(p => p.is_overtime);
          this.currentPeriods.push({
            period_type: 'overtime',
            period_number: overtimesList.length + 1,
            team_score: 0,
            opponent_score: 0,
            is_overtime: true
          });
          this._renderEditFormPreservingScroll(container);
        });

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

        container.querySelectorAll(".btn-delete-ot").forEach(btn => {
          btn.addEventListener("click", () => {
            const otIdx = Number(btn.getAttribute("data-otindex"));
            const overtimesList = this.currentPeriods.filter(p => p.is_overtime);
            if (overtimesList[otIdx]) {
              const targetOt = overtimesList[otIdx];
              this.currentPeriods = this.currentPeriods.filter(p => p !== targetOt);
              let otCount = 1;
              this.currentPeriods.forEach(p => { if (p.is_overtime) p.period_number = otCount++; });
              this._renderEditFormPreservingScroll(container);
            }
          });
        });

        container.querySelectorAll(".st-input").forEach(inp => {
          inp.addEventListener("input", (e) => {
            const tr = e.target.closest("tr");
            const playerId = tr ? tr.getAttribute("data-player-id") : e.target.getAttribute("data-player-id");
            const field = e.target.getAttribute("data-field");
            const val = Number(e.target.value || 0);
            const st = this.currentGameStats.find(s => String(s.player_id) === String(playerId));
            if (st) st[field] = val;
            this._updateScoreBadgeAndTotals(container);
          });
        });
      }

      // EVENTOS MODO RÁPIDO & PISTA
      if (this.entrySubMode === "fast" || this.entrySubMode === "court") {
        container.querySelectorAll(".st-input").forEach(inp => {
          inp.addEventListener("input", (e) => {
            const playerId = e.target.getAttribute("data-player-id");
            const field = e.target.getAttribute("data-field");
            const val = Number(e.target.value || 0);
            const st = this.currentGameStats.find(s => String(s.player_id) === String(playerId));
            if (st) st[field] = val;
          });
        });

        container.querySelectorAll(".btn-period-select").forEach(btn => {
          btn.addEventListener("click", () => {
            this.activePeriodNumber = Number(btn.getAttribute("data-period"));
            this.isPeriodOvertime = btn.getAttribute("data-ot") === "true";
            this._renderEditFormPreservingScroll(container);
          });
        });

        container.querySelector("#btn-add-ot-live")?.addEventListener("click", () => {
          const overtimesList = this.currentPeriods.filter(p => p.is_overtime);
          const otNum = overtimesList.length + 1;
          this.currentPeriods.push({
            period_type: 'overtime',
            period_number: otNum,
            team_score: 0,
            opponent_score: 0,
            is_overtime: true
          });
          this.activePeriodNumber = otNum;
          this.isPeriodOvertime = true;
          this._renderEditFormPreservingScroll(container);
        });

        container.querySelectorAll(".live-player-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            this.selectedPlayerId = btn.getAttribute("data-id");
            this.selectedPlayerName = btn.getAttribute("data-name");
            this._renderEditFormPreservingScroll(container);
          });
        });

        container.querySelectorAll(".btn-fast-action").forEach(btn => {
          btn.addEventListener("click", () => {
            if (!this.selectedPlayerId) return alert("Selecciona primero un jugador");
            const action = btn.getAttribute("data-action");
            const pts = parseInt(btn.getAttribute("data-pts") || "0", 10);
            
            // Asignar coordenadas automáticas por defecto si no se marcó en la pista
            let autoCoords = null;
            if (action.startsWith("fg3")) {
              autoCoords = { x: 50.0, y: 65.0, made: action.includes("made") };
            } else if (action.startsWith("fg2")) {
              autoCoords = { x: 50.0, y: 25.0, made: action.includes("made") };
            } else if (action.startsWith("ft")) {
              autoCoords = { x: 50.0, y: 40.4, made: action.includes("made") };
            }

            this._recordLiveEvent(this.selectedPlayerId, this.selectedPlayerName, action, pts, autoCoords);
          });
        });

        const courtArea = container.querySelector("#court-canvas-clickarea");
        courtArea?.addEventListener("click", (e) => {
          if (!this.selectedPlayerId) return alert("Selecciona primero un jugador");
          const rect = courtArea.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;

          const hoopX = 50.0;
          const hoopY = 11.06;
          const dx = (x - hoopX) * 5.0;
          const dy = (y - hoopY) * 4.7;
          const distUnits = Math.hypot(dx, dy);

          const isCornerThree = (x <= 6.0 || x >= 94.0) && y <= 29.8;
          const isArcThree = distUnits >= 235.0;
          const isThree = isCornerThree || isArcThree;

          this.pendingShot = {
            x: parseFloat(x.toFixed(1)),
            y: parseFloat(y.toFixed(1)),
            shotType: isThree ? 'fg3' : 'fg2',
            pts: isThree ? 3 : 2
          };

          const hintEl = container.querySelector("#court-shot-hint");
          if (hintEl) {
            hintEl.innerHTML = `<strong style="color: #16a34a;">${isThree ? '🎯 Triple (3 pts)' : '🏀 Tiro de 2 (2 pts)'} marcado. Pulsa ANOTADO o FALLADO ➔</strong>`;
          }
        });

        container.querySelectorAll(".btn-live-court-outcome").forEach(btn => {
          btn.addEventListener("click", () => {
            if (!this.selectedPlayerId) return alert("Selecciona un jugador");
            if (!this.pendingShot) return alert("Toca primero en la pista dónde se realizó el tiro");

            const made = btn.getAttribute("data-made") === "true";
            const action = made ? `${this.pendingShot.shotType}_made` : `${this.pendingShot.shotType}_attempted`;
            const pts = made ? this.pendingShot.pts : 0;

            this._recordLiveEvent(this.selectedPlayerId, this.selectedPlayerName, action, pts, {
              x: this.pendingShot.x,
              y: this.pendingShot.y,
              made
            });

            this.pendingShot = null;
          });
        });

        container.querySelectorAll(".btn-court-ft").forEach(btn => {
          btn.addEventListener("click", () => {
            if (!this.selectedPlayerId) return alert("Selecciona primero un jugador");
            const made = btn.getAttribute("data-made") === "true";
            const action = made ? "ft_made" : "ft_attempted";
            const pts = made ? 1 : 0;

            this._recordLiveEvent(this.selectedPlayerId, this.selectedPlayerName, action, pts, {
              x: 50.0,
              y: 40.4,
              made
            });
          });
        });

        container.querySelectorAll(".btn-opp-action").forEach(btn => {
          btn.addEventListener("click", () => {
            const field = btn.getAttribute("data-field");
            const val = parseInt(btn.getAttribute("data-val") || "1", 10);
            this._recordOpponentEvent(field, val);
          });
        });

        container.querySelectorAll(".btn-delete-single-event").forEach(btn => {
          btn.addEventListener("click", (e) => {
            const idx = Number(e.currentTarget.getAttribute("data-idx"));
            this._removeSingleLiveEvent(idx, container);
          });
        });

        container.querySelector("#btn-clear-all-events")?.addEventListener("click", () => {
          if (confirm("⚠️ ¿Deseas vaciar todas las jugadas del partido actual?")) {
            this.liveEventsHistory = [];
            this._renderEditFormPreservingScroll(container);
          }
        });
      }

      // SUBMIT FINAL DEL FORMULARIO
      const form = container.querySelector("#form-game-editor");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const submitBtn = container.querySelector("#btn-submit-game-all");
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "⏳ Guardando partido...";
          }

          const formData = new FormData(form);

          let qTeamSum = 0;
          let qOppSum = 0;
          this.currentPeriods.forEach(p => {
            qTeamSum += Number(p.team_score || 0);
            qOppSum += Number(p.opponent_score || 0);
          });

          // Si el input está en 0 y la suma de cuartos tiene puntos, priorizar la suma de cuartos
          const rawTeam = formData.get("team_score");
          const rawOpp = formData.get("opponent_score");

          const finalTeamScore = (rawTeam !== "" && Number(rawTeam) > 0) ? Number(rawTeam) : qTeamSum;
          const finalOppScore = (rawOpp !== "" && Number(rawOpp) > 0) ? Number(rawOpp) : qOppSum;
          const overtimesCount = this.currentPeriods.filter(p => p.is_overtime).length;
          const targetTeamId = g.team_id || this.teamId || DataStore.getActiveTeamId();
          const targetSeasonId = DataStore.getActiveSeasonId();

          const gameData = {
            team_id: targetTeamId,
            season_id: targetSeasonId,
            date: formData.get("date") || this.currentGame?.date,
            time: formData.get("time") || this.currentGame?.time || "18:00",
            opponent: formData.get("opponent") || this.currentGame?.opponent,
            competition: formData.get("competition") || this.currentGame?.competition,
            round: formData.get("round") || this.currentGame?.round || "Jornada 1",
            venue: formData.get("venue") || this.currentGame?.venue || "Local",
            venue_name: formData.get("venue_name") || this.currentGame?.venue_name || "",
            status: formData.get("status") || this.currentGame?.status || "Finalizado",
            starter_ids: this.currentGame.starter_ids || [],
            team_score: finalTeamScore,
            opponent_score: finalOppScore,
            has_overtime: overtimesCount > 0,
            overtime_count: overtimesCount,
            notes: formData.get("notes") || this.currentGame?.notes || "",
            video_url: formData.get("video_url") || this.currentGame?.video_url || ""
          };

          if (g.id) {
            gameData.id = g.id;
          }

          try {
            const savedGameId = await DataStore.saveGameAndStats(gameData, this.currentGameStats, this.currentPeriods);

            // Guardar eventos para mapas de calor en Supabase
            if (this.liveEventsHistory.length > 0 && this.supabase && savedGameId) {
              await this.supabase.from("game_events").delete().eq("game_id", savedGameId);

              const eventsToInsert = this.liveEventsHistory
                .filter(ev => ev.coordinates)
                .map(ev => ({
                  game_id: savedGameId,
                  player_id: ev.playerId,
                  team_id: targetTeamId,
                  period: ev.period,
                  action_type: ev.action,
                  points: ev.points,
                  made: ev.coordinates.made,
                  coord_x: ev.coordinates.x,
                  coord_y: ev.coordinates.y
                }));

              if (eventsToInsert.length > 0) {
                await this.supabase.from("game_events").insert(eventsToInsert);
              }
            }

            await DataStore.init(targetTeamId, true);

            this.isEditing = false;
            alert("✅ " + TranslationStore.t("game_saved_msg", "Partido guardado exitosamente con cuartos, estadísticas y mapa de calor sincronizados."));
            this._renderGamesList(container, targetTeamId);
          } catch (err) {
            console.error("Error guardando partido:", err);
            alert(`❌ Error al guardar partido: ${err.message || err}`);
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "💾 Guardar Partido y Estadísticas";
            }
          }
        });
      }
    }
  }

  _recordLiveEvent(playerId, playerName, action, points, coordinates) {
    const pStat = this.currentGameStats.find(s => String(s.player_id) === String(playerId));
    if (pStat) {
      if (action === "fg2_made") { pStat.fg2_made = (pStat.fg2_made || 0) + 1; pStat.fg2_attempted = (pStat.fg2_attempted || 0) + 1; }
      else if (action === "fg3_made") { pStat.fg3_made = (pStat.fg3_made || 0) + 1; pStat.fg3_attempted = (pStat.fg3_attempted || 0) + 1; }
      else if (action === "ft_made") { pStat.ft_made = (pStat.ft_made || 0) + 1; pStat.ft_attempted = (pStat.ft_attempted || 0) + 1; }
      else if (action === "fg2_attempted") { pStat.fg2_attempted = (pStat.fg2_attempted || 0) + 1; }
      else if (action === "fg3_attempted") { pStat.fg3_attempted = (pStat.fg3_attempted || 0) + 1; }
      else if (action === "ft_attempted") { pStat.ft_attempted = (pStat.ft_attempted || 0) + 1; }
      else { pStat[action] = (pStat[action] || 0) + 1; }
    }

    if (points > 0) {
      const activePeriod = this.currentPeriods.find(p => p.period_number === this.activePeriodNumber && p.is_overtime === this.isPeriodOvertime);
      if (activePeriod) activePeriod.team_score = (activePeriod.team_score || 0) + points;
    }

    const eventObj = {
      timestamp: Date.now(),
      playerId,
      playerName,
      action,
      points,
      period: this.activePeriodNumber,
      isOvertime: this.isPeriodOvertime,
      coordinates
    };

    this.liveEventsHistory.push(eventObj);
    this.selectedPlayerId = null;
    this.selectedPlayerName = null;
    this._renderEditFormPreservingScroll(document.getElementById("dashboard-content-area"));
  }

  _recordOpponentEvent(field, val) {
    const activePeriod = this.currentPeriods.find(p => p.period_number === this.activePeriodNumber && p.is_overtime === this.isPeriodOvertime);
    
    if (field === "points") {
      if (activePeriod) activePeriod.opponent_score = (activePeriod.opponent_score || 0) + val;
    } else {
      this.opponentStats[field] = (this.opponentStats[field] || 0) + 1;
    }

    this.liveEventsHistory.push({
      timestamp: Date.now(),
      isOpponent: true,
      field,
      points: field === "points" ? val : 0,
      period: this.activePeriodNumber,
      isOvertime: this.isPeriodOvertime
    });

    this._renderEditFormPreservingScroll(document.getElementById("dashboard-content-area"));
  }

  _removeSingleLiveEvent(index, container) {
    if (index < 0 || index >= this.liveEventsHistory.length) return;
    const [target] = this.liveEventsHistory.splice(index, 1);

    if (target.isOpponent) {
      if (target.field === "points") {
        const period = this.currentPeriods.find(p => p.period_number === target.period && p.is_overtime === target.isOvertime);
        if (period) period.opponent_score = Math.max(0, (period.opponent_score || 0) - target.points);
      } else {
        this.opponentStats[target.field] = Math.max(0, (this.opponentStats[target.field] || 0) - 1);
      }
    } else {
      const pStat = this.currentGameStats.find(s => String(s.player_id) === String(target.playerId));
      if (pStat) {
        if (target.action === "fg2_made") { pStat.fg2_made = Math.max(0, pStat.fg2_made - 1); pStat.fg2_attempted = Math.max(0, pStat.fg2_attempted - 1); }
        else if (target.action === "fg3_made") { pStat.fg3_made = Math.max(0, pStat.fg3_made - 1); pStat.fg3_attempted = Math.max(0, pStat.fg3_attempted - 1); }
        else if (target.action === "ft_made") { pStat.ft_made = Math.max(0, pStat.ft_made - 1); pStat.ft_attempted = Math.max(0, pStat.ft_attempted - 1); }
        else if (target.action === "fg2_attempted") { pStat.fg2_attempted = Math.max(0, pStat.fg2_attempted - 1); }
        else if (target.action === "fg3_attempted") { pStat.fg3_attempted = Math.max(0, pStat.fg3_attempted - 1); }
        else if (target.action === "ft_attempted") { pStat.ft_attempted = Math.max(0, pStat.ft_attempted - 1); }
        else if (pStat[target.action] !== undefined) { pStat[target.action] = Math.max(0, pStat[target.action] - 1); }
      }

      if (target.points > 0) {
        const period = this.currentPeriods.find(p => p.period_number === target.period && p.is_overtime === target.isOvertime);
        if (period) period.team_score = Math.max(0, (period.team_score || 0) - target.points);
      }
    }

    this._renderEditFormPreservingScroll(container);
  }
}

export default GameLiveEditorView;
export default GameLiveEditorView;