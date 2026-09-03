/**
 * @fileoverview Vista de Partidos, Toma Gráfica en Pista y Acta Oficial: GameLiveEditorView.js
 * @description Gestión integral de la toma de datos de partido en 3 modos:
 * 1) Modo Pista (Shot chart y coordenadas espaciales FIBA)
 * 2) Modo Rápido (Control táctil directo y atajos)
 * 3) Acta Oficial (Tabla completa con cuadre de parciales y PIR)
 */

import { supabase } from "../config/database.config.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { LiveScoreHUDView } from "./LiveScoreHUDView.js";
import { Permission } from "../security/PermissionService.js";
import { GameLockService } from "../services/games/GameLockService.js";

export class GameLiveEditorView {
  constructor(gameController, authController) {
    this.gameController = gameController;
    this.auth = authController;
    this.supabase = supabase;
    this.games = [];
    this.players = [];
    this.currentGame = null;
    this.currentGameStats = [];
    this.currentPeriods = [];
    this.filterCondition = "Todos";
    this.sortOrder = "desc";
    this.isEditing = false;
    
    this.entrySubMode = "court"; // 'court' | 'fast' | 'classic'
    this.activePeriodNumber = 1;
    this.isPeriodOvertime = false;
    this.selectedPlayerId = null;
    this.selectedPlayerName = null;
    this.pendingShot = null;
    this.liveEventsHistory = [];
    this.opponentStats = { oreb: 0, dreb: 0, tov: 0, ast: 0, blk_made: 0, blk_received: 0, fouls: 0 };
    this.continuationDialog = null;
    this.pendingLockRequests = [];
    this.gameLockService = new GameLockService(this.supabase, this.auth);
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  _canEditFullBoxScore() {
    return Boolean(this.auth?.canPreview?.(Permission.EDIT_GAME));
  }

  _isGameLocked(game = null) {
    return GameLockService.isLocked(game || {});
  }

  _gameContext(game = null) {
    return {
      teamId: game?.team_id || game?.teamId || this.teamId || DataStore.getActiveTeamId(),
      seasonId: game?.season_id || game?.seasonId || null,
      teamSeasonId: game?.team_season_id || game?.teamSeasonId || DataStore.getActiveTeamSeasonId?.()
    };
  }

  _canDeleteGame(game = null) {
    if (this._isGameLocked(game)) return false;
    return Boolean(
      this.auth?.canPreview?.(Permission.DELETE_GAME, this._gameContext(game))
    );
  }

  _escapeText(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _pendingLockRequest(gameId) {
    return (this.pendingLockRequests || []).find(
      request => String(request.game_id || request.gameId) === String(gameId)
    ) || null;
  }

  async _loadLockRequests() {
    const gameIds = (this.games || []).map(game => game.id).filter(Boolean);
    if (gameIds.length === 0) {
      this.pendingLockRequests = [];
      return;
    }

    const shouldQuery = (this.games || []).some(game =>
      this.gameLockService.canReviewRequests(game)
      || this.gameLockService.canRequestLock(game)
    );
    if (!shouldQuery) {
      this.pendingLockRequests = [];
      return;
    }

    try {
      this.pendingLockRequests = await this.gameLockService.listPendingRequests(gameIds);
    } catch (error) {
      // During staged rollout the UI can be deployed before the additive DB
      // objects. Read-only game browsing must keep working in that case.
      console.warn("[GameLiveEditorView] Solicitudes de cierre no disponibles:", error?.message || error);
      this.pendingLockRequests = [];
    }
  }

  _renderLockRequestsPanel() {
    const reviewable = (this.pendingLockRequests || []).filter(request => {
      const game = this.games.find(
        item => String(item.id) === String(request.game_id || request.gameId)
      );
      return game && this.gameLockService.canReviewRequests(game);
    });

    if (reviewable.length === 0) return "";

    return `
      <section style="margin-bottom: 18px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
          <div>
            <h2 style="margin:0; font-size:15px; font-weight:900; color:#78350f;">📨 Peticiones de cierre</h2>
            <p style="margin:3px 0 0; font-size:12px; color:#92400e;">Entrenadores y analistas solicitan aquí el bloqueo definitivo del partido.</p>
          </div>
          <span style="background:#fef3c7; color:#92400e; border-radius:999px; padding:4px 9px; font-size:11px; font-weight:900;">${reviewable.length} pendiente${reviewable.length === 1 ? "" : "s"}</span>
        </div>
        <div style="display:grid; gap:8px;">
          ${reviewable.map(request => {
            const game = this.games.find(
              item => String(item.id) === String(request.game_id || request.gameId)
            ) || {};
            const opponent = this._escapeText(game.opponent || game.opponentName || "Rival");
            const reason = this._escapeText(request.request_reason || "Sin comentario");
            const role = this._escapeText(request.requested_by_role || "Usuario");
            return `
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; background:#ffffff; border:1px solid #fde68a; border-radius:10px; padding:10px 12px;">
                <div style="min-width:220px;">
                  <strong style="display:block; color:#0f172a; font-size:13px;">vs ${opponent} · ${this._escapeText(game.date || "")}</strong>
                  <span style="display:block; color:#64748b; font-size:11px; margin-top:2px;">${role}: ${reason}</span>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button type="button" class="btn-approve-lock-request" data-request-id="${request.id}" style="min-height:40px; border:0; border-radius:8px; padding:8px 12px; background:#166534; color:#ffffff; font-weight:800; cursor:pointer;">✓ Aprobar y cerrar</button>
                  <button type="button" class="btn-reject-lock-request" data-request-id="${request.id}" style="min-height:40px; border:1px solid #fca5a5; border-radius:8px; padding:8px 12px; background:#fff1f2; color:#be123c; font-weight:800; cursor:pointer;">Rechazar</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  async _refreshAfterLockAction(container, teamId) {
    await DataStore.init(teamId, true);
    this.games = DataStore.getGames(teamId) || [];
    this.isEditing = false;
    this.currentGame = null;
    await this._renderGamesList(container, teamId);
  }

  _bindGameLockEvents(container, teamId) {
    container.querySelectorAll(".btn-lock-game").forEach(button => {
      button.addEventListener("click", async event => {
        const gameId = event.currentTarget.dataset.id;
        const game = this.games.find(item => String(item.id) === String(gameId));
        if (!game || !this.gameLockService.canLock(game)) {
          alert("⚠️ No tienes permiso para cerrar este partido.");
          return;
        }
        if (!confirm("¿Cerrar este partido? Una vez cerrado nadie podrá modificar sus datos hasta que un Admin o Superadmin lo reabra.")) return;

        const reason = prompt("Motivo del cierre (opcional):", "Partido revisado y validado");
        try {
          event.currentTarget.disabled = true;
          await this.gameLockService.setLocked(gameId, true, reason);
          await this._refreshAfterLockAction(container, teamId);
        } catch (error) {
          console.error("[GameLiveEditorView] Error cerrando partido:", error);
          alert(`❌ No se pudo cerrar el partido: ${error.message || error}`);
          event.currentTarget.disabled = false;
        }
      });
    });

    container.querySelectorAll(".btn-reopen-game").forEach(button => {
      button.addEventListener("click", async event => {
        const gameId = event.currentTarget.dataset.id;
        const game = this.games.find(item => String(item.id) === String(gameId));
        if (!game || !this.gameLockService.canReopen(game)) {
          alert("⚠️ No tienes permiso para reabrir este partido.");
          return;
        }
        if (!confirm("¿Reabrir este partido? Volverá a ser editable para los roles autorizados.")) return;

        const reason = prompt("Motivo de reapertura (opcional):", "Corrección autorizada");
        try {
          event.currentTarget.disabled = true;
          await this.gameLockService.setLocked(gameId, false, reason);
          await this._refreshAfterLockAction(container, teamId);
        } catch (error) {
          console.error("[GameLiveEditorView] Error reabriendo partido:", error);
          alert(`❌ No se pudo reabrir el partido: ${error.message || error}`);
          event.currentTarget.disabled = false;
        }
      });
    });

    container.querySelectorAll(".btn-request-game-lock").forEach(button => {
      button.addEventListener("click", async event => {
        const gameId = event.currentTarget.dataset.id;
        const game = this.games.find(item => String(item.id) === String(gameId));
        if (!game || !this.gameLockService.canRequestLock(game)) {
          alert("⚠️ No tienes permiso para solicitar el cierre de este partido.");
          return;
        }

        const reason = prompt("Comentario para Admin/Superadmin (opcional):", "Partido revisado; solicito cierre");
        if (reason === null) return;

        try {
          event.currentTarget.disabled = true;
          await this.gameLockService.requestLock(gameId, reason);
          await this._refreshAfterLockAction(container, teamId);
          alert("✅ Solicitud de cierre enviada.");
        } catch (error) {
          console.error("[GameLiveEditorView] Error solicitando cierre:", error);
          alert(`❌ No se pudo solicitar el cierre: ${error.message || error}`);
          event.currentTarget.disabled = false;
        }
      });
    });

    container.querySelectorAll(".btn-approve-lock-request").forEach(button => {
      button.addEventListener("click", async event => {
        const requestId = event.currentTarget.dataset.requestId;
        if (!confirm("¿Aprobar la petición y cerrar el partido?")) return;
        try {
          event.currentTarget.disabled = true;
          await this.gameLockService.resolveRequest(requestId, "APPROVED", "Cierre aprobado");
          await this._refreshAfterLockAction(container, teamId);
        } catch (error) {
          console.error("[GameLiveEditorView] Error aprobando cierre:", error);
          alert(`❌ No se pudo aprobar la petición: ${error.message || error}`);
          event.currentTarget.disabled = false;
        }
      });
    });

    container.querySelectorAll(".btn-reject-lock-request").forEach(button => {
      button.addEventListener("click", async event => {
        const requestId = event.currentTarget.dataset.requestId;
        const note = prompt("Motivo del rechazo (opcional):", "");
        if (note === null) return;
        try {
          event.currentTarget.disabled = true;
          await this.gameLockService.resolveRequest(requestId, "REJECTED", note);
          await this._refreshAfterLockAction(container, teamId);
        } catch (error) {
          console.error("[GameLiveEditorView] Error rechazando cierre:", error);
          alert(`❌ No se pudo rechazar la petición: ${error.message || error}`);
          event.currentTarget.disabled = false;
        }
      });
    });
  }

  _generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async render(containerId = "dashboard-content-area", gameId = null, teamId = null) {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    this.teamId = teamId || DataStore.getActiveTeamId();
    this.players = DataStore.getPlayersEligibleOnDate?.(
      this.teamId,
      new Date().toISOString().slice(0, 10)
    ) || DataStore.getPlayers(this.teamId) || [];

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
    this.games = DataStore.getGames(teamId) || [];
    await this._loadLockRequests();

    const canCreateGame = Boolean(this.auth?.canPreview?.(Permission.CREATE_GAME, { teamId }));
    const canRecordLive = Boolean(this.auth?.canPreview?.(Permission.RECORD_LIVE_GAME, { teamId }));
    const canEditGame = Boolean(this.auth?.canPreview?.(Permission.EDIT_GAME, { teamId }));

    const chronologicalGames = [...this.games].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const pCodeMap = new Map();
    chronologicalGames.forEach((game, index) => {
      pCodeMap.set(String(game.id), `P${index + 1}`);
    });

    const filteredGames = this.games.filter(game => {
      const venue = String(game.venue || "").toLowerCase();
      if (this.filterCondition === "Local") return venue === "local" || venue === "home";
      if (this.filterCondition === "Visitante") return venue === "visitante" || venue === "away";
      return true;
    });

    const sortedGames = [...filteredGames].sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return this.sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    const gamesCardsMarkup = sortedGames.map(game => {
      const isWin = Number(game.team_score ?? game.teamScore ?? 0) > Number(game.opponent_score ?? game.opponentScore ?? 0);
      const resultClass = isWin ? "background: #166534; color: #ffffff;" : "background: #dc2626; color: #ffffff;";
      const resultText = isWin ? this.t("win", "VICTORIA") : this.t("loss", "DERROTA");

      const periods = DataStore.getGamePeriodScores(game.id) || [];
      const quarters = periods.filter(period => !period.is_overtime && !period.isOvertime);
      const overtimes = periods.filter(period => period.is_overtime || period.isOvertime);
      const quarterScore = index => quarters[index]
        ? `${quarters[index].team_score ?? quarters[index].teamScore ?? 0}-${quarters[index].opponent_score ?? quarters[index].opponentScore ?? 0}`
        : "0-0";

      const otMarkup = overtimes.length > 0
        ? overtimes.map((period, index) =>
          `<b>OT${index + 1}:</b> ${period.team_score ?? period.teamScore ?? 0}-${period.opponent_score ?? period.opponentScore ?? 0}`
        ).join(" ")
        : "";

      const venueLower = String(game.venue || "").toLowerCase();
      const isHome = venueLower === "home" || venueLower === "local" || game.is_home === true || game.isHome === true;
      const venueText = isHome ? this.t("local", "Local") : this.t("visitor", "Visitante");
      const pCode = pCodeMap.get(String(game.id)) || "P-";
      const opponentText = this._escapeText(game.opponent || game.opponent_name || game.opponentName || this.t("opponent", "Rival"));
      const formattedDate = game.date ? (I18n.formatDate ? I18n.formatDate(game.date) : game.date) : "-";

      const locked = this._isGameLocked(game);
      const pendingRequest = this._pendingLockRequest(game.id);
      const editable = canEditGame && !locked;
      const canLock = !locked && this.gameLockService.canLock(game);
      const canReopen = locked && this.gameLockService.canReopen(game);
      const canRequestLock = !locked && this.gameLockService.canRequestLock(game);
      const canDelete = this._canDeleteGame(game);

      const lifecycleBadge = locked
        ? '<span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:900;padding:3px 8px;border-radius:999px;">🔒 Cerrado</span>'
        : pendingRequest
          ? '<span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:900;padding:3px 8px;border-radius:999px;">⏳ Cierre solicitado</span>'
          : '<span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:900;padding:3px 8px;border-radius:999px;">🔓 Abierto</span>';

      let lifecycleAction = "";
      if (canReopen) {
        lifecycleAction = `<button type="button" class="btn-reopen-game" data-id="${game.id}" style="background:#ecfdf5;color:#166534;border:1px solid #86efac;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;min-height:44px;">🔓 Reabrir</button>`;
      } else if (canLock) {
        lifecycleAction = `<button type="button" class="btn-lock-game" data-id="${game.id}" style="background:#fff7ed;color:#9a3412;border:1px solid #fdba74;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;min-height:44px;">🔒 Cerrar</button>`;
      } else if (canRequestLock) {
        lifecycleAction = `<button type="button" class="btn-request-game-lock" data-id="${game.id}" ${pendingRequest ? "disabled" : ""} style="background:${pendingRequest ? "#f1f5f9" : "#eff6ff"};color:${pendingRequest ? "#94a3b8" : "#1d4ed8"};border:1px solid ${pendingRequest ? "#cbd5e1" : "#93c5fd"};padding:8px 12px;border-radius:8px;font-size:12px;font-weight:800;cursor:${pendingRequest ? "not-allowed" : "pointer"};min-height:44px;">${pendingRequest ? "⏳ Cierre solicitado" : "📨 Solicitar cierre"}</button>`;
      }

      return `
        <div class="game-item-card card" style="background:#ffffff;border:1px solid ${locked ? "#fecaca" : "#e2e8f0"};border-radius:14px;padding:18px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <div style="padding:10px 14px;border-radius:10px;font-weight:900;font-size:13px;text-align:center;width:85px;${resultClass}">
              <div style="font-size:9px;text-transform:uppercase;opacity:.9;">${resultText}</div>
              <div style="font-size:16px;font-weight:900;margin-top:2px;">${game.team_score ?? game.teamScore ?? 0}-${game.opponent_score ?? game.opponentScore ?? 0}</div>
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <h3 style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">vs ${opponentText}</h3>
                <span style="background:#dbeafe;color:#1e40af;font-size:11px;font-weight:800;padding:2px 8px;border-radius:10px;">${venueText} (${pCode})</span>
                ${lifecycleBadge}
              </div>
              <div style="font-size:12px;color:#475569;margin:4px 0;">
                📅 ${formattedDate} &nbsp;·&nbsp; 🏆 ${this._escapeText(game.competition || "Liga")} &nbsp;·&nbsp; 📍 ${this._escapeText(game.venue_name || game.venueName || "-")}
              </div>
              <div style="font-size:11px;color:#334155;background:#f8fafc;padding:4px 10px;border-radius:6px;border:1px solid #cbd5e1;display:inline-block;">
                <b>${this.t("quarters", "CUARTOS")}:</b> Q1: ${quarterScore(0)} &nbsp; Q2: ${quarterScore(1)} &nbsp; Q3: ${quarterScore(2)} &nbsp; Q4: ${quarterScore(3)} ${otMarkup ? `&nbsp; ${otMarkup}` : ""}
              </div>
              ${locked && game.lock_reason ? `<div style="font-size:11px;color:#991b1b;margin-top:5px;">Motivo de cierre: ${this._escapeText(game.lock_reason || game.lockReason)}</div>` : ""}
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button class="btn-open-court-direct" data-id="${game.id}" aria-disabled="${!editable}" style="background:${editable ? "#0284c7" : "#e2e8f0"};color:${editable ? "#ffffff" : "#64748b"};border:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:${editable ? "pointer" : "not-allowed"};min-height:44px;display:inline-flex;align-items:center;gap:4px;">
              🏀 Pista / Edición${editable ? "" : " 🔒"}
            </button>
            <button onclick="window.location.hash='#/boxscore/${game.id}'" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;">📋 Boxscore</button>
            <button onclick="window.location.hash='#/reports'" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;">📊 Informe</button>
            ${lifecycleAction}
            <button class="btn-delete-game-direct" data-id="${game.id}" ${!canDelete ? "disabled" : ""} style="background:${canDelete ? "#fee2e2" : "#f1f5f9"};border:1px solid ${canDelete ? "#fca5a5" : "#cbd5e1"};font-size:18px;cursor:${canDelete ? "pointer" : "not-allowed"};color:${canDelete ? "#dc2626" : "#94a3b8"};min-height:44px;min-width:44px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;" title="${canDelete ? "Eliminar partido" : locked ? "Reabre el partido antes de eliminarlo" : "Tu rol no puede eliminar partidos"}">🗑️</button>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div style="max-width:1400px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <h1 style="font-size:24px;font-weight:800;color:#0f172a;margin:0;">${this.t("team_games", "Partidos del Equipo")}</h1>
            <span style="font-size:13px;color:#475569;">${this.games.length} ${this.t("registered_games", "partidos registrados")}</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="btn-create-game-hud" aria-disabled="${!canRecordLive}" style="background:${canRecordLive ? "#f97316" : "#e2e8f0"};color:${canRecordLive ? "#ffffff" : "#64748b"};border:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:900;cursor:${canRecordLive ? "pointer" : "not-allowed"};min-height:44px;display:inline-flex;align-items:center;gap:6px;">
              ⚡ Nueva Anotación en Vivo (HUD Pro)${canRecordLive ? "" : " 🔒"}
            </button>
            <button id="btn-create-game" aria-disabled="${!canCreateGame}" style="background:${canCreateGame ? "#0f172a" : "#e2e8f0"};color:${canCreateGame ? "#ffffff" : "#64748b"};border:none;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:800;cursor:${canCreateGame ? "pointer" : "not-allowed"};min-height:44px;display:inline-flex;align-items:center;gap:6px;">
              + 🏀 Registro Rápido
            </button>
          </div>
        </div>

        ${this._renderLockRequestsPanel()}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="filter-btn ${this.filterCondition === "Todos" ? "active" : ""}" data-cond="Todos" style="padding:8px 16px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;background:${this.filterCondition === "Todos" ? "#1e3a8a" : "#e2e8f0"};color:${this.filterCondition === "Todos" ? "#ffffff" : "#334155"};">${this.t("all", "Todos")} (${this.games.length})</button>
            <button class="filter-btn ${this.filterCondition === "Local" ? "active" : ""}" data-cond="Local" style="padding:8px 16px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;background:${this.filterCondition === "Local" ? "#1e3a8a" : "#e2e8f0"};color:${this.filterCondition === "Local" ? "#ffffff" : "#334155"};">${this.t("local", "Local")}</button>
            <button class="filter-btn ${this.filterCondition === "Visitante" ? "active" : ""}" data-cond="Visitante" style="padding:8px 16px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;background:${this.filterCondition === "Visitante" ? "#1e3a8a" : "#e2e8f0"};color:${this.filterCondition === "Visitante" ? "#ffffff" : "#334155"};">${this.t("visitor", "Visitante")}</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:12px;font-weight:700;color:#475569;">${this.t("sort", "ORDENAR")}:</label>
            <select id="select-sort-games" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;font-weight:700;background:#ffffff;color:#0f172a;cursor:pointer;min-height:44px;">
              <option value="desc" ${this.sortOrder === "desc" ? "selected" : ""}>Pn → P1 (Más recientes primero)</option>
              <option value="asc" ${this.sortOrder === "asc" ? "selected" : ""}>P1 → Pn (Antiguos a recientes)</option>
            </select>
          </div>
        </div>

        <div>${gamesCardsMarkup.length > 0 ? gamesCardsMarkup : `<div style="padding:40px;text-align:center;color:#64748b;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">${this.t("no_games_recorded", "No hay partidos registrados.")}</div>`}</div>
      </div>
    `;

    this._bindGameLockEvents(container, teamId);

    container.querySelector("#btn-create-game-hud")?.addEventListener("click", () => {
      if (!this.auth?.canPreview?.(Permission.RECORD_LIVE_GAME, { teamId })) {
        alert("⚠️ Tu perfil puede consultar partidos, pero no registrar una anotación en vivo.");
        return;
      }
      new LiveScoreHUDView(this.auth).render("dashboard-content-area");
    });

    container.querySelectorAll(".btn-open-court-direct").forEach(button => {
      button.addEventListener("click", event => {
        const id = event.currentTarget.getAttribute("data-id");
        const game = this.games.find(item => String(item.id) === String(id));
        if (this._isGameLocked(game)) {
          alert("🔒 Partido cerrado. Puedes consultar el BoxScore y los informes, pero no modificar datos.");
          return;
        }
        if (!this.auth?.canPreview?.(Permission.EDIT_GAME, this._gameContext(game))) {
          alert("⚠️ Tu perfil puede consultar el partido y su BoxScore, pero no editarlo.");
          return;
        }
        this.entrySubMode = "court";
        this._openEditForm(id, container);
      });
    });

    container.querySelector("#btn-create-game")?.addEventListener("click", () => {
      if (!this.auth?.canPreview?.(Permission.CREATE_GAME, { teamId })) {
        alert("⚠️ Tu perfil no tiene permiso para registrar nuevos partidos.");
        return;
      }
      const activeTeam = DataStore.getTeamById(teamId) || {};
      const newGameId = this._generateUUID();
      this.currentGame = {
        id: newGameId,
        team_id: teamId,
        season_id: DataStore.getActiveSeasonId(teamId),
        team_season_id: DataStore.getActiveTeamSeasonId?.(teamId) || null,
        date: new Date().toISOString().split("T")[0],
        time: "18:00",
        opponent: "",
        competition: activeTeam.competition || "Liga",
        round: "Jornada " + (this.games.length + 1),
        venue: "Local",
        venue_name: "",
        status: "Finalizado",
        edit_state: "OPEN",
        starter_ids: [],
        notes: "",
        video_url: "",
        team_score: 0,
        opponent_score: 0
      };
      this.currentPeriods = [1, 2, 3, 4].map(periodNumber => ({
        period_type: "quarter",
        period_number: periodNumber,
        team_score: 0,
        opponent_score: 0,
        is_overtime: false
      }));
      this.currentGameStats = this.players.map(player => ({
        player_id: player.id,
        minutes: 0,
        fg2_made: 0,
        fg2_attempted: 0,
        fg3_made: 0,
        fg3_attempted: 0,
        ft_made: 0,
        ft_attempted: 0,
        off_reb: 0,
        def_reb: 0,
        assists: 0,
        steals: 0,
        blocks_made: 0,
        blocks_received: 0,
        turnovers: 0,
        fouls_committed: 0,
        fouls_drawn: 0,
        plus_minus: 0
      }));
      this.liveEventsHistory = [];
      this.entrySubMode = "classic";
      this.isEditing = true;
      this._renderEditForm(container);
    });

    container.querySelectorAll(".btn-delete-game-direct").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        const id = event.currentTarget.getAttribute("data-id");
        if (!id) return;
        const game = this.games.find(item => String(item.id) === String(id));

        if (this._isGameLocked(game)) {
          alert("🔒 Partido cerrado. Debes reabrirlo antes de poder eliminarlo.");
          return;
        }
        if (!this.auth?.can?.(Permission.DELETE_GAME, this._gameContext(game))) {
          alert("⚠️ Tu rol no puede eliminar partidos.");
          return;
        }
        if (!confirm(this.t("confirm_delete_game", "¿Estás seguro de que deseas eliminar este partido? Se borrarán todas sus estadísticas, cuartos y jugadas asociadas."))) return;

        try {
          await DataStore.deleteGame(id);
          this.games = DataStore.getGames(teamId) || [];
          await this._renderGamesList(container, teamId);
          alert("✅ Partido eliminado correctamente.");
        } catch (error) {
          console.error("❌ Excepción al eliminar partido:", error);
          alert(`❌ No se pudo eliminar el partido: ${error.message || error}`);
        }
      });
    });

    container.querySelectorAll(".filter-btn").forEach(button => {
      button.addEventListener("click", () => {
        this.filterCondition = button.getAttribute("data-cond");
        this._renderGamesList(container, teamId);
      });
    });

    container.querySelector("#select-sort-games")?.addEventListener("change", event => {
      this.sortOrder = event.target.value;
      this._renderGamesList(container, teamId);
    });
  }

async _openEditForm(gameId, container) {
    this.currentGame = DataStore.getGameById(gameId) || {};

    const gameTeamId = this.currentGame.team_id || this.currentGame.teamId || this.teamId;
    if (this._isGameLocked(this.currentGame)) {
      this.isEditing = false;
      alert("🔒 Partido cerrado. Reabre el partido antes de modificar datos.");
      await this._renderGamesList(container, gameTeamId);
      return;
    }
    const eligiblePlayers = DataStore.getPlayersEligibleOnDate?.(
      gameTeamId,
      this.currentGame.date
    ) || DataStore.getPlayers(gameTeamId) || [];
    const seasonParticipants = DataStore.getSeasonParticipantPlayers?.(gameTeamId)
      || DataStore.getPlayers(gameTeamId)
      || [];
    this.players = eligiblePlayers;

    let existingPeriods = DataStore.getGamePeriodScores(gameId) || [];

    // Si no estaban cargados por separado, extraerlos del objeto de partido
    if (existingPeriods.length === 0 && this.currentGame && Array.isArray(this.currentGame.periods) && this.currentGame.periods.length > 0) {
      existingPeriods = this.currentGame.periods;
    }

    if (existingPeriods.length > 0) {
      this.currentPeriods = existingPeriods.map(p => ({
        period_type: p.period_type || p.periodType || (p.is_overtime || p.isOvertime ? 'overtime' : 'quarter'),
        period_number: Number(p.period_number ?? p.periodNumber ?? 1),
        team_score: Number(p.team_score ?? p.teamScore ?? 0),
        opponent_score: Number(p.opponent_score ?? p.opponentScore ?? 0),
        is_overtime: Boolean(p.is_overtime ?? p.isOvertime)
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

    const pStats = DataStore.getPlayerGameStats(null, gameId) || [];

    // Historical truth is preserved: if a legacy game already contains stats
    // for a player, keep that player visible even if a later roster correction
    // makes the inferred stint incomplete.
    const playerMap = new Map(this.players.map(player => [String(player.id), player]));
    pStats.forEach(stat => {
      const playerId = String(stat.player_id ?? stat.playerId ?? "");
      if (!playerId || playerMap.has(playerId)) return;
      const historicalPlayer = seasonParticipants.find(
        player => String(player.id) === playerId
      );
      if (historicalPlayer) playerMap.set(playerId, historicalPlayer);
    });
    this.players = [...playerMap.values()];

    this.currentGameStats = this.players.map(p => {
      const existing = pStats.find(s => String(s.player_id ?? s.playerId) === String(p.id));
      return existing ? { ...existing } : {
        player_id: p.id, minutes: 0, fg2_made: 0, fg2_attempted: 0, fg3_made: 0, fg3_attempted: 0,
        ft_made: 0, ft_attempted: 0, off_reb: 0, def_reb: 0, assists: 0, steals: 0, blocks_made: 0,
        blocks_received: 0, turnovers: 0, fouls_committed: 0, fouls_drawn: 0, plus_minus: 0
      };
    });

    let loadedEvents = DataStore.getGameEvents(gameId);

    if ((!loadedEvents || loadedEvents.length === 0) && gameId) {
      try {
        const data = typeof DataStore.loadGameEvents === "function"
          ? await DataStore.loadGameEvents([gameId])
          : [];

        if (data && data.length > 0) {
          loadedEvents = data.map(ev => {
            const pObj = this.players.find(p => String(p.id) === String(ev.player_id));
            return {
              id: ev.id,
              playerId: ev.player_id,
              playerName: pObj ? `#${pObj.jersey ?? '-'} ${pObj.first_name || pObj.firstName || ''}` : "Equipo",
              action: ev.action_type,
              points: ev.points || 0,
              period: Number(ev.period || 1),
              isOvertime: Number(ev.period || 1) > 4,
              isOpponent: !ev.player_id && String(ev.action_type || '').includes("opp"),
              coordinates: (ev.coord_x !== null && ev.coord_y !== null)
                ? { x: Number(ev.coord_x), y: Number(ev.coord_y), made: ev.made }
                : null
            };
          });
        }
      } catch (err) {
        console.warn("Aviso recuperando game_events:", err);
      }
    }

    this.liveEventsHistory = loadedEvents || [];
    this.isEditing = true;
    this._renderEditForm(container);
  }

  _renderEditFormPreservingScroll(container) {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    this._renderEditForm(container);
    window.scrollTo(0, scrollTop);
  }

  _renderEditForm(container) {
    const g = this.currentGame || {};
    let starters = g.starter_ids || g.starterIds || [];
    if (typeof starters === "string") {
      try { starters = JSON.parse(starters); } catch { starters = []; }
    }
    const canManageTable = this._canEditFullBoxScore();

    let qTeamSum = 0;
    let qOppSum = 0;
    this.currentPeriods.forEach(p => {
      qTeamSum += Number(p.team_score ?? p.teamScore ?? 0);
      qOppSum += Number(p.opponent_score ?? p.opponentScore ?? 0);
    });

    const startersMarkup = this.players.map(p => {
      const isSelected = starters.includes(p.id);
      return `
        <button type="button" class="btn-starter ${isSelected ? 'active' : ''}" data-id="${p.id}" style="padding: 8px 10px; border-radius: 8px; border: 1px solid ${isSelected ? '#f97316' : '#cbd5e1'}; background: ${isSelected ? '#fff7ed' : '#ffffff'}; color: ${isSelected ? '#ea580c' : '#334155'}; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; justify-content: space-between; align-items: center; min-height: 40px;">
          <span>#${p.jersey ?? '-'} ${p.first_name || p.firstName || ''}</span>
          <span style="font-size: 9px; opacity: 0.8;">${p.primary_position || p.primaryPosition || 'Jugador'}</span>
        </button>
      `;
    }).join("");

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
        
        <style>
          .st-input, .period-input, .meta-input, .live-input-box {
            color: #0f172a !important;
            background-color: #ffffff !important;
            -webkit-text-fill-color: #0f172a !important;
            opacity: 1 !important;
            font-weight: 700 !important;
            box-sizing: border-box !important;
            line-height: normal !important;
            display: inline-block !important;
            visibility: visible !important;
            padding: 0 !important;
            margin: 0 auto !important;
          }
          .st-input {
            width: 38px !important;
            height: 32px !important;
            text-align: center !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 4px !important;
            font-size: 13px !important;
          }
          .period-input {
            width: 44px !important;
            height: 34px !important;
            text-align: center !important;
            font-size: 15px !important;
            font-weight: 900 !important;
            border-radius: 6px !important;
            border: 1px solid #cbd5e1 !important;
          }
          .btn-period-select.active {
            background: #f97316 !important;
            color: #ffffff !important;
          }
        </style>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0;">🏀 ${this.t("edit_game", "Editar Partido")}</h1>
            <span style="font-size: 12px; color: #475569;">vs ${g.opponent || g.opponentName || 'Rival'} · ${g.date || ''}</span>
          </div>
          
          <button id="btn-cancel-edit" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 40px;">✕ ${this.t("cancel", "Cancelar")}</button>
        </div>

        <form id="form-game-editor" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 16px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
            <div>
              <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 2px;">${this.t("date", "Fecha")}</label>
              <input type="date" name="date" class="meta-input" data-key="date" value="${g.date || ''}" style="width: 100%; height: 40px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" />
            </div>
            <div>
              <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 2px;">${this.t("opponent", "Rival")} *</label>
              <input type="text" name="opponent" class="meta-input" data-key="opponent" value="${g.opponent || g.opponentName || ''}" required placeholder="Nombre del rival" style="width: 100%; height: 40px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" />
            </div>
            <div>
              <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 2px;">${this.t("matchday", "Jornada")}</label>
              <input type="text" name="round" class="meta-input" data-key="round" value="${g.round || ''}" style="width: 100%; height: 40px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" />
            </div>
            <div>
              <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 2px;">${this.t("venue", "Sede")}</label>
              <select name="venue" class="meta-input" data-key="venue" style="width: 100%; height: 40px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; color: #0f172a; font-size: 12px;">
                <option value="Local" ${g.venue === 'Local' || g.is_home || g.isHome ? 'selected' : ''}>${this.t("local", "Local")}</option>
                <option value="Visitante" ${g.venue === 'Visitante' || g.venue === 'Away' ? 'selected' : ''}>${this.t("visitor", "Visitante")}</option>
              </select>
            </div>
            <div>
              <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 2px;">${this.t("arena", "Pabellón / Arena")}</label>
              <input type="text" name="venue_name" class="meta-input" data-key="venue_name" value="${g.venue_name || g.venueName || ''}" placeholder="Ej: Pavelló JMJ" style="width: 100%; height: 40px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" />
            </div>
          </div>

          <div>
            <h3 style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin: 0 0 8px 0;">${this.t("starting_five", "QUINTETO TITULAR")} (${starters.length}/5)</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px;">
              ${startersMarkup}
            </div>
          </div>

          <!-- SELECTOR DE MODOS -->
          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 6px; width: 100%; flex-wrap: wrap;">
              <button type="button" id="btn-mode-court" style="flex: 1; min-height: 40px; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; border: 1px solid #cbd5e1; background: ${this.entrySubMode === 'court' ? '#16a34a' : '#ffffff'}; color: ${this.entrySubMode === 'court' ? '#ffffff' : '#334155'};">
                🏀 Modo Pista (Visual)
              </button>
              <button type="button" id="btn-mode-fast" style="flex: 1; min-height: 40px; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; border: 1px solid #cbd5e1; background: ${this.entrySubMode === 'fast' ? '#0284c7' : '#ffffff'}; color: ${this.entrySubMode === 'fast' ? '#ffffff' : '#334155'};">
                ⚡ Modo Rápido (Botones)
              </button>
              ${canManageTable ? `
                <button type="button" id="btn-mode-classic" style="flex: 1; min-height: 40px; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; border: 1px solid #cbd5e1; background: ${this.entrySubMode === 'classic' ? '#0f172a' : '#ffffff'}; color: ${this.entrySubMode === 'classic' ? '#ffffff' : '#334155'};">
                  📊 Acta Oficial (Tabla & Cuadre)
                </button>
              ` : ''}
            </div>
          </div>

          <div id="entry-mode-content-container">
            ${this.entrySubMode === 'court' || this.entrySubMode === 'fast' 
              ? this._renderBSAGraphicalModeMarkup(qTeamSum, qOppSum) 
              : this._renderClassicTableMarkup()}
          </div>

          <div id="continuation-dialog-layer">
            ${this._renderContinuationDialog()}
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
            <button type="submit" id="btn-submit-game-all" style="background: var(--color-primary, #f97316); color: #ffffff; border: none; padding: 12px 28px; border-radius: 8px; font-weight: 900; cursor: pointer; min-height: 44px; font-size: 14px; width: 100%; max-width: 320px;">
              💾 ${this.t("save_changes", "Guardar Cambios")}
            </button>
          </div>
        </form>
      </div>
    `;

    this._bindUnifiedFormEvents(container, canManageTable, g);
  }

  _renderBSAGraphicalModeMarkup(qTeamSum, qOppSum) {
    const quarters = this.currentPeriods.filter(p => !p.is_overtime && !p.isOvertime);
    const overtimes = this.currentPeriods.filter(p => p.is_overtime || p.isOvertime);

    const getActionLabel = (action) => {
      const map = {
        fg2_made: `Canasta de 2 (+2 pts)`,
        fg3_made: `Triple (+3 pts)`,
        ft_made: `Tiro Libre (+1 pt)`,
        fg2_attempted: `Tiro de 2 Fallado`,
        fg3_attempted: `Triple Fallado`,
        ft_attempted: `Tiro Libre Fallado`,
        off_reb: `Rebote Ofensivo`,
        def_reb: `Rebote Defensivo`,
        assists: `Asistencia`,
        steals: `Robo de Balón`,
        blocks_made: `Tapón Realizado`,
        turnovers: `Pérdida de Balón`,
        fouls_committed: `Falta Cometida`,
        fouls_drawn: `Falta Recibida`
      };
      return map[action] || action;
    };

    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: #0f172a; color: #ffffff; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 4px; overflow-x: auto; max-width: 100%;">
            ${quarters.map((q, i) => `
              <button type="button" class="btn-period-select ${this.activePeriodNumber === (i + 1) && !this.isPeriodOvertime ? 'active' : ''}" data-period="${i + 1}" data-ot="false" style="padding: 6px 10px; border-radius: 6px; border: none; font-weight: 800; font-size: 11px; cursor: pointer; background: ${this.activePeriodNumber === (i + 1) && !this.isPeriodOvertime ? '#f97316' : '#334155'}; color: #ffffff; white-space: nowrap;">
                Q${i + 1} (${q.team_score ?? q.teamScore ?? 0}-${q.opponent_score ?? q.opponentScore ?? 0})
              </button>
            `).join('')}

            ${overtimes.map((ot, i) => `
              <button type="button" class="btn-period-select ${this.activePeriodNumber === (i + 1) && this.isPeriodOvertime ? 'active' : ''}" data-period="${i + 1}" data-ot="true" style="padding: 6px 10px; border-radius: 6px; border: none; font-weight: 800; font-size: 11px; cursor: pointer; background: ${this.activePeriodNumber === (i + 1) && this.isPeriodOvertime ? '#f97316' : '#475569'}; color: #ffffff; white-space: nowrap;">
                OT${i + 1} (${ot.team_score ?? ot.teamScore ?? 0}-${ot.opponent_score ?? ot.opponentScore ?? 0})
              </button>
            `).join('')}
            
            <button type="button" id="btn-add-overtime" style="padding: 6px 10px; border-radius: 6px; border: 1px dashed #94a3b8; font-weight: 800; font-size: 11px; cursor: pointer; background: transparent; color: #cbd5e1; white-space: nowrap;">
              + OT
            </button>
          </div>

          <div style="font-size: 13px; font-weight: 800;">
            Total: <span style="color: #38bdf8;">${qTeamSum}</span> - <span style="color: #f43f5e;">${qOppSum}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
          <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px;">
            <h3 style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase;">1️⃣ Elige Jugador Activo</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); gap: 6px;">
              ${this.players.map(p => {
                const st = this.currentGameStats.find(s => String(s.player_id ?? s.playerId) === String(p.id)) || { minutes: 0 };
                const pMin = Number(st.minutes ?? st.minutesPlayed ?? 0);
                return `
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <button type="button" class="live-player-btn ${this.selectedPlayerId === p.id ? 'active' : ''}" 
                            data-id="${p.id}" data-name="#${p.jersey ?? '-'} ${p.first_name || p.firstName || ''}"
                            style="display: flex; flex-direction: column; align-items: center; padding: 6px 2px; border: 2px solid ${this.selectedPlayerId === p.id ? '#0284c7' : '#e2e8f0'}; background: ${this.selectedPlayerId === p.id ? '#e0f2fe' : '#f8fafc'}; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 1.1rem; font-weight: 900; color: #0f172a;">#${p.jersey ?? '-'}</span>
                      <span style="font-size: 0.7rem; font-weight: 700; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px;">${p.first_name || p.firstName || p.name}</span>
                    </button>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                      <span style="font-size: 0.65rem; color: #475569; font-weight: 800;">MIN</span>
                      <input type="number" class="st-input" data-player-id="${p.id}" data-field="minutes" value="${pMin}" style="width: 38px; height: 26px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.75rem; font-weight: 800; color: #0f172a !important; background: #ffffff !important;" />
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          ${this.entrySubMode === 'court' ? `
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; align-items: center;">
              <div style="font-size: 11px; font-weight: 800; color: #334155; margin-bottom: 6px; width: 100%; display: flex; justify-content: space-between;">
                <span>📍 Toca en la Cancha</span>
                <span id="court-shot-hint" style="color: #0284c7;">Paso 2: Toca el punto exacto</span>
              </div>
              <div style="position: relative; width: 100%; max-width: 380px; aspect-ratio: 50/47; background: #e09f67; border: 3px solid #ffffff; border-radius: 8px; overflow: hidden; cursor: crosshair;" id="court-canvas-clickarea">
                <svg viewBox="0 0 500 470" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none;">
                  <rect x="0" y="0" width="500" height="470" fill="none" stroke="#fff" stroke-width="4"/>
                  <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.15)" stroke="#fff" stroke-width="3"/>
                  <path d="M 170 190 A 80 80 0 0 0 330 190" fill="none" stroke="#fff" stroke-width="3"/>
                  <line x1="220" y1="40" x2="280" y2="40" stroke="#fff" stroke-width="4"/>
                  <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
                  <path d="M 215 52 A 35 35 0 0 0 285 52" fill="none" stroke="#fff" stroke-width="2"/>
                  <line x1="30" y1="0" x2="30" y2="140" stroke="#fff" stroke-width="3"/>
                  <line x1="470" y1="0" x2="470" y2="140" stroke="#fff" stroke-width="3"/>
                  <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#fff" stroke-width="3"/>
                </svg>
                <div id="live-shot-markers-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
                  ${this.liveEventsHistory.filter(ev => ev.coordinates).map(ev => `
                    <div style="position: absolute; left: ${ev.coordinates.x}%; top: ${ev.coordinates.y}%; transform: translate(-50%, -50%); width: 12px; height: 12px; border-radius: 50%; background: ${ev.coordinates.made ? '#22c55e' : '#ef4444'}; border: 2px solid #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.5);"></div>
                  `).join('')}
                </div>
              </div>
            </div>
          ` : ''}

          <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
            <h3 style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">2️⃣ Registrar Acción</h3>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <button type="button" class="btn-live-court-outcome" data-made="true" style="background: #22c55e; color: #ffffff; border: none; padding: 10px 4px; border-radius: 8px; font-weight: 900; font-size: 0.9rem; cursor: pointer;">✔ ANOTADO</button>
              <button type="button" class="btn-live-court-outcome" data-made="false" style="background: #ef4444; color: #ffffff; border: none; padding: 10px 4px; border-radius: 8px; font-weight: 900; font-size: 0.9rem; cursor: pointer;">✖ FALLADO</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <button type="button" class="btn-court-ft" data-made="true" style="background: #84cc16; color: #ffffff; border: none; padding: 8px 4px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">+1 TL Anotado</button>
              <button type="button" class="btn-court-ft" data-made="false" style="background: #fca5a5; color: #7f1d1d; border: none; padding: 8px 4px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">Fallo TL</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
              <button type="button" class="btn-fast-action" data-action="off_reb" style="background: #0284c7; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Reb Of</button>
              <button type="button" class="btn-fast-action" data-action="def_reb" style="background: #38bdf8; color: #0f172a; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Reb Def</button>
              <button type="button" class="btn-fast-action" data-action="assists" style="background: #6366f1; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Asistencia</button>
              <button type="button" class="btn-fast-action" data-action="steals" style="background: #8b5cf6; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Robo</button>
              <button type="button" class="btn-fast-action" data-action="blocks_made" style="background: #a855f7; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Tapón</button>
              <button type="button" class="btn-fast-action" data-action="turnovers" style="background: #ea580c; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Pérdida</button>
              <button type="button" class="btn-fast-action" data-action="fouls_committed" style="background: #f59e0b; color: #ffffff; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Falta Com.</button>
              <button type="button" class="btn-fast-action" data-action="fouls_drawn" style="background: #fbbf24; color: #78350f; border: none; padding: 8px 2px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Falta Rec.</button>
            </div>

            <div style="background: #fff7ed; padding: 6px; border-radius: 6px; border: 1px solid #ffedd5; display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 9px; font-weight: 800; color: #c2410c; text-transform: uppercase;">Estadísticas del Rival</span>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
                <button type="button" class="btn-opp-action" data-field="points" data-val="2" style="background: #ea580c; color: #ffffff; border: none; padding: 6px 2px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">+2 Rival</button>
                <button type="button" class="btn-opp-action" data-field="points" data-val="3" style="background: #c2410c; color: #ffffff; border: none; padding: 6px 2px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">+3 Rival</button>
                <button type="button" class="btn-opp-action" data-field="points" data-val="1" style="background: #f97316; color: #ffffff; border: none; padding: 6px 2px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">+1 TL Riv</button>
                <button type="button" class="btn-opp-action" data-field="tov" style="background: #fed7aa; color: #9a3412; border: none; padding: 6px 2px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">Pérdida Riv</button>
                <button type="button" class="btn-opp-action" data-field="oreb" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Reb Of Riv</button>
                <button type="button" class="btn-opp-action" data-field="dreb" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Reb Def Riv</button>
                <button type="button" class="btn-opp-action" data-field="blk_made" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Tapón Riv</button>
                <button type="button" class="btn-opp-action" data-field="fouls" style="background: #fed7aa; color: #9a3412; border: none; padding: 8px 2px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; cursor: pointer;">Falta Riv</button>
              </div>
            </div>
          </div>
        </div>

        <section style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a;">📋 Historial de Jugadas Registradas (${this.liveEventsHistory.length})</h3>
              <span style="font-size: 0.75rem; color: #475569;">Listado cronológico de acciones del partido</span>
            </div>
            <button type="button" id="btn-clear-all-events" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
              Vaciar Jugadas
            </button>
          </div>

          <div style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            ${this.liveEventsHistory.length === 0 ? `
              <div style="padding: 20px; text-align: center; color: #64748b; font-size: 0.85rem;">
                No hay jugadas registradas todavía. Selecciona un jugador y pulsa su acción.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                <thead style="background: #f8fafc; color: #334155; position: sticky; top: 0; z-index: 5;">
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 6px 8px;">#</th>
                    <th style="padding: 6px 8px;">Periodo</th>
                    <th style="padding: 6px 8px;">Jugador / Equipo</th>
                    <th style="padding: 6px 8px;">Acción Realizada</th>
                    <th style="padding: 6px 8px; text-align: right;">Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  ${[...this.liveEventsHistory].reverse().map((ev, rIdx) => {
                    const originalIdx = this.liveEventsHistory.length - 1 - rIdx;
                    return `
                      <tr style="border-bottom: 1px solid #f1f5f9; background: ${ev.isOpponent ? '#fff7ed' : '#ffffff'};">
                        <td style="padding: 6px 8px; color: #64748b; font-weight: 700;">${this.liveEventsHistory.length - rIdx}</td>
                        <td style="padding: 6px 8px;">
                          <span style="background: #e2e8f0; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 0.75rem;">
                            ${ev.isOvertime ? 'OT' : 'Q'}${ev.period}
                          </span>
                        </td>
                        <td style="padding: 6px 8px; font-weight: 800; color: #0f172a;">
                          ${ev.isOpponent ? '🔴 Rival' : (ev.playerName || 'Jugador')}
                        </td>
                        <td style="padding: 6px 8px; color: #334155;">
                          ${ev.isOpponent ? `Acción Rival: ${ev.field || ev.action_type}` : getActionLabel(ev.action || ev.action_type)}
                        </td>
                        <td style="padding: 6px 8px; text-align: right;">
                          <button type="button" class="btn-delete-single-event" data-idx="${originalIdx}" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
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

  _renderContinuationDialog() {
    if (!this.continuationDialog) return "";

    const { type, shooterName } = this.continuationDialog;

    if (type === "shot_missed") {
      return `
        <div style="position: fixed; inset: 0; background: rgba(15,23,42,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;">
          <div style="background: #ffffff; border-radius: 14px; padding: 20px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center;">
            <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 900; color: #0f172a;">🏀 Tiro Fallado por ${shooterName}</h3>
            <p style="font-size: 12px; color: #475569; margin: 0 0 14px 0;">¿Quién capturó el rebote?</p>
            
            <div style="margin-bottom: 12px;">
              <button type="button" id="btn-cont-opp-dreb" style="width: 100%; background: #fed7aa; color: #9a3412; border: none; padding: 10px; border-radius: 8px; font-weight: 900; cursor: pointer; font-size: 12px; margin-bottom: 10px;">
                🛡️ Rebote Defensivo Rival
              </button>

              <div style="font-size: 11px; font-weight: 800; color: #0284c7; margin-bottom: 6px; text-transform: uppercase;">Rebote Ofensivo de Nuestro Equipo:</div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 6px; max-height: 140px; overflow-y: auto;">
                ${this.players.map(p => `
                  <button type="button" class="btn-cont-oreb-player" data-id="${p.id}" data-name="#${p.jersey ?? '-'} ${p.first_name || p.firstName}" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 6px 2px; border-radius: 6px; font-size: 10px; font-weight: 800; cursor: pointer;">
                    #${p.jersey ?? '-'} ${p.first_name || p.firstName}
                  </button>
                `).join('')}
              </div>
            </div>

            <button type="button" id="btn-close-continuation" style="background: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer;">
              Omitir / No registrar rebote
            </button>
          </div>
        </div>
      `;
    }

    if (type === "shot_made") {
      return `
        <div style="position: fixed; inset: 0; background: rgba(15,23,42,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;">
          <div style="background: #ffffff; border-radius: 14px; padding: 20px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center;">
            <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 900; color: #16a34a;">🎯 ¡Canasta de ${shooterName}!</h3>
            <p style="font-size: 12px; color: #475569; margin: 0 0 14px 0;">¿Hubo asistencia de algún compañero?</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 6px; margin-bottom: 14px; max-height: 160px; overflow-y: auto;">
              ${this.players.filter(p => p.id !== this.continuationDialog.shooterId).map(p => `
                <button type="button" class="btn-cont-ast-player" data-id="${p.id}" data-name="#${p.jersey ?? '-'} ${p.first_name || p.firstName}" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 6px 2px; border-radius: 6px; font-size: 10px; font-weight: 800; cursor: pointer;">
                  #${p.jersey ?? '-'} ${p.first_name || p.firstName}
                </button>
              `).join('')}
            </div>

            <button type="button" id="btn-close-continuation" style="background: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer;">
              Sin Asistencia
            </button>
          </div>
        </div>
      `;
    }

    return "";
  }

  _renderClassicTableMarkup() {
    let quartersTeamSum = 0;
    let quartersOppSum = 0;
    this.currentPeriods.forEach(p => {
      quartersTeamSum += Number(p.team_score ?? p.teamScore ?? 0);
      quartersOppSum += Number(p.opponent_score ?? p.opponentScore ?? 0);
    });

    let playersTeamSum = 0;
    this.currentGameStats.forEach(st => {
      const pPts = (Number(st.fg2_made || 0) * 2) + (Number(st.fg3_made || 0) * 3) + Number(st.ft_made || 0);
      playersTeamSum += pPts;
    });

    const isMatched = quartersTeamSum === playersTeamSum;
    const diffPts = playersTeamSum - quartersTeamSum;

    const quarters = this.currentPeriods.filter(p => !p.is_overtime && !p.isOvertime);
    const overtimes = this.currentPeriods.filter(p => p.is_overtime || p.isOvertime);

    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 13px; font-weight: 900; color: #0f172a;">⏱️ Desglose de Puntos por Cuartos</span>
              <span style="font-size: 11px; color: #475569;">(Introduce los parciales del acta oficial)</span>
            </div>

            <div style="padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; ${isMatched ? 'background: #dcfce7; color: #15803d; border: 1px solid #86efac;' : 'background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;'}">
              ${isMatched 
                ? `✅ Puntos Cuadrados: Jugadores (${playersTeamSum}) = Cuartos (${quartersTeamSum})` 
                : `⚠️ Descuadre de Puntos: Jugadores (${playersTeamSum}) ≠ Cuartos (${quartersTeamSum}) [Dif: ${diffPts > 0 ? '+' + diffPts : diffPts} pts]`
              }
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
            ${quarters.map((q, i) => `
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 8px; text-align: center;">
                <div style="font-size: 10px; font-weight: 800; color: #475569; margin-bottom: 4px;">Cuarto ${i + 1} (Q${i + 1})</div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <input type="number" class="period-input" data-period-idx="${i}" data-side="team" value="${q.team_score ?? q.teamScore ?? 0}" min="0" style="color: #1e40af !important; background: #eff6ff !important;" />
                  <span style="font-weight: 900; color: #94a3b8;">-</span>
                  <input type="number" class="period-input" data-period-idx="${i}" data-side="opp" value="${q.opponent_score ?? q.opponentScore ?? 0}" min="0" style="color: #b91c1c !important; background: #fef2f2 !important;" />
                </div>
              </div>
            `).join('')}

            ${overtimes.map((ot, i) => `
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 8px; text-align: center;">
                <div style="font-size: 10px; font-weight: 800; color: #f97316; margin-bottom: 4px;">Prórroga (OT${i + 1})</div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <input type="number" class="period-input" data-period-idx="${quarters.length + i}" data-side="team" value="${ot.team_score ?? ot.teamScore ?? 0}" min="0" style="color: #1e40af !important; background: #eff6ff !important;" />
                  <span style="font-weight: 900; color: #94a3b8;">-</span>
                  <input type="number" class="period-input" data-period-idx="${quarters.length + i}" data-side="opp" value="${ot.opponent_score ?? ot.opponentScore ?? 0}" min="0" style="color: #b91c1c !important; background: #fef2f2 !important;" />
                </div>
              </div>
            `).join('')}

            <div style="background: #0f172a; color: #ffffff; border-radius: 8px; padding: 6px 8px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
              <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Marcador Final</div>
              <div style="font-size: 15px; font-weight: 900;">
                <span style="color: #38bdf8;">${quartersTeamSum}</span> - <span style="color: #f87171;">${quartersOppSum}</span>
              </div>
            </div>
          </div>
        </div>

        <div style="overflow-x: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: center;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #334155; font-weight: 800;">
                <th style="padding: 8px; text-align: left;">Jugador</th>
                <th style="padding: 8px;">MIN</th>
                <th style="padding: 8px; background: #eff6ff; color: #1e40af; font-weight: 900;">PTS</th>
                <th style="padding: 8px;">T2C</th><th style="padding: 8px;">T2I</th>
                <th style="padding: 8px;">T3C</th><th style="padding: 8px;">T3I</th>
                <th style="padding: 8px;">TLC</th><th style="padding: 8px;">TLI</th>
                <th style="padding: 8px;">RO</th><th style="padding: 8px;">RD</th>
                <th style="padding: 8px;">AST</th><th style="padding: 8px;">ROB</th><th style="padding: 8px;">TAP</th>
                <th style="padding: 8px;">PER</th><th style="padding: 8px;">FC</th><th style="padding: 8px;">FR</th>
                <th style="padding: 8px; background: #fefce8; color: #854d0e; font-weight: 900;">VAL</th>
              </tr>
            </thead>
            <tbody>
              ${this.players.map(p => {
                const st = this.currentGameStats.find(s => String(s.player_id ?? s.playerId) === String(p.id)) || {};
                
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

                const boxMetrics = BoxScoreCalculator.calculatePlayerBoxScore({
                  minutes: valMin, fg2_made: valFg2m, fg2_attempted: valFg2a,
                  fg3_made: valFg3m, fg3_attempted: valFg3a, ft_made: valFtm, ft_attempted: valFta,
                  off_reb: valRo, def_reb: valRd, assists: valAst, steals: valRob,
                  blocks: valTap, turnovers: valPer, fouls_committed: valFc, fouls_drawn: valFr,
                  points: valPts
                });

                return `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 6px 8px; font-weight: 800; text-align: left; white-space: nowrap; color: #0f172a;">
                      #${p.jersey ?? p.number ?? '-'} ${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}
                    </td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="minutes" value="${valMin}" /></td>
                    
                    <td style="padding: 2px; background: #eff6ff; font-weight: 900; color: #1e40af; font-size: 14px;">${boxMetrics.points}</td>

                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="fg2_made" value="${valFg2m}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="fg2_attempted" value="${valFg2a}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="fg3_made" value="${valFg3m}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="fg3_attempted" value="${valFg3a}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="ft_made" value="${valFtm}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="ft_attempted" value="${valFta}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="off_reb" value="${valRo}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="def_reb" value="${valRd}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="assists" value="${valAst}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="steals" value="${valRob}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="blocks_made" value="${valTap}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="turnovers" value="${valPer}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="fouls_committed" value="${valFc}" /></td>
                    <td style="padding: 2px;"><input type="number" class="st-input" data-player-id="${p.id}" data-field="fouls_drawn" value="${valFr}" /></td>
                    
                    <td style="padding: 2px; background: #fefce8; font-weight: 800; color: #854d0e; font-size: 13px;">${boxMetrics.pir}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  _bindUnifiedFormEvents(container, canManageTable, g) {
    container.querySelectorAll(".meta-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const key = e.target.getAttribute("data-key");
        if (key && this.currentGame) this.currentGame[key] = e.target.value;
      });
    });

    container.querySelectorAll(".btn-starter").forEach(btn => {
      btn.addEventListener("click", () => {
        const pId = btn.getAttribute("data-id");
        let starters = this.currentGame.starter_ids || this.currentGame.starterIds || [];
        if (typeof starters === "string") {
          try { starters = JSON.parse(starters); } catch { starters = []; }
        }

        if (starters.includes(pId)) {
          starters = starters.filter(id => id !== pId);
        } else {
          if (starters.length >= 5) {
            alert("⚠️ Ya has seleccionado los 5 titulares reglamentarios.");
            return;
          }
          starters.push(pId);
        }
        this.currentGame.starter_ids = starters;
        this.currentGame.starterIds = starters;
        this._renderEditFormPreservingScroll(container);
      });
    });

    container.querySelector("#btn-mode-court")?.addEventListener("click", () => {
      this.entrySubMode = "court";
      this._renderEditFormPreservingScroll(container);
    });

    container.querySelector("#btn-mode-fast")?.addEventListener("click", () => {
      this.entrySubMode = "fast";
      this._renderEditFormPreservingScroll(container);
    });

    container.querySelector("#btn-mode-classic")?.addEventListener("click", () => {
      this.entrySubMode = "classic";
      this._renderEditFormPreservingScroll(container);
    });

    const handleCancel = () => {
      this.isEditing = false;
      this._renderGamesList(container, g.team_id || g.teamId || this.teamId || DataStore.getActiveTeamId());
    };
    container.querySelector("#btn-cancel-edit")?.addEventListener("click", handleCancel);

    container.querySelectorAll(".period-input").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const pIdx = Number(e.target.getAttribute("data-period-idx"));
        const side = e.target.getAttribute("data-side");
        const val = Number(e.target.value || 0);

        if (this.currentPeriods[pIdx]) {
          if (side === "team") this.currentPeriods[pIdx].team_score = val;
          if (side === "opp") this.currentPeriods[pIdx].opponent_score = val;
        }

        this._renderEditFormPreservingScroll(container);
      });
    });

    container.querySelectorAll(".live-player-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.selectedPlayerId = btn.getAttribute("data-id");
        this.selectedPlayerName = btn.getAttribute("data-name");
        this._renderEditFormPreservingScroll(container);
      });
    });

    container.querySelectorAll(".st-input").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const playerId = e.target.getAttribute("data-player-id");
        const field = e.target.getAttribute("data-field");
        const val = Number(e.target.value || 0);
        const st = this.currentGameStats.find(s => String(s.player_id ?? s.playerId) === String(playerId));
        if (st) st[field] = val;

        if (this.entrySubMode === "classic") {
          this._renderEditFormPreservingScroll(container);
        }
      });
    });

    container.querySelectorAll(".btn-period-select").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activePeriodNumber = Number(btn.getAttribute("data-period"));
        this.isPeriodOvertime = btn.getAttribute("data-ot") === "true";
        this._renderEditFormPreservingScroll(container);
      });
    });

    container.querySelector("#btn-add-overtime")?.addEventListener("click", () => {
      const otCount = this.currentPeriods.filter(p => p.is_overtime || p.isOvertime).length + 1;
      this.currentPeriods.push({
        period_type: 'overtime',
        period_number: otCount,
        team_score: 0,
        opponent_score: 0,
        is_overtime: true
      });
      this.activePeriodNumber = otCount;
      this.isPeriodOvertime = true;
      this._renderEditFormPreservingScroll(container);
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
        hintEl.innerHTML = `<strong style="color: #16a34a;">${isThree ? '🎯 Triple' : '🏀 Tiro 2'} marcado. Pulsa ANOTADO o FALLADO ➔</strong>`;
      }
    });

    container.querySelectorAll(".btn-live-court-outcome").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!this.selectedPlayerId) return alert("Selecciona un jugador");
        if (!this.pendingShot) return alert("Toca primero en la pista");

        const made = btn.getAttribute("data-made") === "true";
        const action = made ? `${this.pendingShot.shotType}_made` : `${this.pendingShot.shotType}_attempted`;
        const pts = made ? this.pendingShot.pts : 0;

        const shooterId = this.selectedPlayerId;
        const shooterName = this.selectedPlayerName;

        this._recordLiveEvent(shooterId, shooterName, action, pts, {
          x: this.pendingShot.x,
          y: this.pendingShot.y,
          made
        });

        this.pendingShot = null;

        this.continuationDialog = {
          type: made ? "shot_made" : "shot_missed",
          shooterId,
          shooterName
        };

        this._renderEditFormPreservingScroll(container);
      });
    });

    container.querySelectorAll(".btn-court-ft").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!this.selectedPlayerId) return alert("Selecciona un jugador");
        const made = btn.getAttribute("data-made") === "true";
        this._recordLiveEvent(this.selectedPlayerId, this.selectedPlayerName, made ? "ft_made" : "ft_attempted", made ? 1 : 0, {
          x: 50.0, y: 40.4, made
        });
      });
    });

    container.querySelectorAll(".btn-fast-action").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!this.selectedPlayerId) return alert("Selecciona primero un jugador");
        const action = btn.getAttribute("data-action");
        
        let autoCoords = null;
        if (action === "off_reb" || action === "def_reb") autoCoords = { x: 50.0, y: 20.0, made: true };
        
        this._recordLiveEvent(this.selectedPlayerId, this.selectedPlayerName, action, 0, autoCoords);
      });
    });

    container.querySelectorAll(".btn-opp-action").forEach(btn => {
      btn.addEventListener("click", () => {
        const field = btn.getAttribute("data-field");
        const val = parseInt(btn.getAttribute("data-val") || "1", 10);
        this._recordOpponentEvent(field, val);
      });
    });

    container.querySelector("#btn-cont-opp-dreb")?.addEventListener("click", () => {
      this._recordOpponentEvent("dreb", 1);
      this.continuationDialog = null;
      this._renderEditFormPreservingScroll(container);
    });

    container.querySelectorAll(".btn-cont-oreb-player").forEach(btn => {
      btn.addEventListener("click", () => {
        const pId = btn.getAttribute("data-id");
        const pName = btn.getAttribute("data-name");
        this._recordLiveEvent(pId, pName, "off_reb", 0, { x: 50.0, y: 20.0, made: true });
        this.continuationDialog = null;
        this._renderEditFormPreservingScroll(container);
      });
    });

    container.querySelectorAll(".btn-cont-ast-player").forEach(btn => {
      btn.addEventListener("click", () => {
        const astId = btn.getAttribute("data-id");
        const astName = btn.getAttribute("data-name");
        this._recordLiveEvent(astId, astName, "assists", 0, null);
        this.continuationDialog = null;
        this._renderEditFormPreservingScroll(container);
      });
    });

    container.querySelector("#btn-close-continuation")?.addEventListener("click", () => {
      this.continuationDialog = null;
      this._renderEditFormPreservingScroll(container);
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
        if (this.currentGame?.id) {
          localStorage.removeItem(`iq_game_events_${this.currentGame.id}`);
        }
        this._renderEditFormPreservingScroll(container);
      }
    });

    const form = container.querySelector("#form-game-editor");
    form?.addEventListener("submit", async (e) => {
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
        qTeamSum += Number(p.team_score ?? p.teamScore ?? 0);
        qOppSum += Number(p.opponent_score ?? p.opponentScore ?? 0);
      });

      const targetTeamId = g.team_id || g.teamId || this.teamId || DataStore.getActiveTeamId();
      const targetSeasonId = DataStore.getActiveSeasonId();

      const gameData = {
        team_id: targetTeamId,
        season_id: targetSeasonId,
        date: formData.get("date") || this.currentGame?.date || new Date().toISOString().split("T")[0],
        time: formData.get("time") || this.currentGame?.time || "18:00",
        opponent: formData.get("opponent") || this.currentGame?.opponent || this.currentGame?.opponentName || "Rival",
        competition: formData.get("competition") || this.currentGame?.competition || "Liga",
        round: formData.get("round") || this.currentGame?.round || "Jornada 1",
        venue: formData.get("venue") || this.currentGame?.venue || "Local",
        venue_name: formData.get("venue_name") || this.currentGame?.venue_name || this.currentGame?.venueName || "",
        status: formData.get("status") || this.currentGame?.status || "Finalizado",
        starter_ids: this.currentGame?.starter_ids || this.currentGame?.starterIds || [],
        team_score: qTeamSum,
        opponent_score: qOppSum,
        notes: formData.get("notes") || this.currentGame?.notes || "",
        video_url: formData.get("video_url") || this.currentGame?.video_url || this.currentGame?.videoUrl || ""
      };

      if (g.id) gameData.id = g.id;

      const formattedEvents = this.liveEventsHistory.map((ev, index) => {
        const pId = ev.playerId || ev.player_id || null;
        const actionType = ev.action || ev.action_type || ev.field || 'fg2_attempted';
        return {
          id: ev.id || this._generateUUID(),
          player_id: pId,
          playerId: pId,
          playerName: ev.playerName || '',
          period: Number(ev.period || 1),
          action_type: actionType,
          action: actionType,
          event_type: actionType,
          points: Number(ev.points || 0),
          is_opponent: Boolean(ev.isOpponent),
          isOpponent: Boolean(ev.isOpponent),
          made: Boolean(ev.coordinates?.made || ev.made),
          coord_x: ev.coordinates?.x !== undefined ? parseFloat(Number(ev.coordinates.x).toFixed(2)) : (ev.coord_x !== undefined ? parseFloat(Number(ev.coord_x).toFixed(2)) : null),
          coord_y: ev.coordinates?.y !== undefined ? parseFloat(Number(ev.coordinates.y).toFixed(2)) : (ev.coord_y !== undefined ? parseFloat(Number(ev.coord_y).toFixed(2)) : null)
        };
      });

      try {
        const savedGameId = await DataStore.saveGameAndStats(
          gameData,
          this.currentGameStats,
          this.currentPeriods,
          formattedEvents
        );

        localStorage.setItem(`iq_game_events_${savedGameId}`, JSON.stringify(formattedEvents));

        await DataStore.init(targetTeamId, true);
        this.isEditing = false;
        alert("✅ " + this.t("game_saved_msg", "Partido guardado exitosamente con cuartos, estadísticas y mapa de calor sincronizados."));
        this._renderGamesList(container, targetTeamId);
      } catch (err) {
        console.error("Error guardando partido:", err);
        alert(`❌ Error al guardar partido: ${err.message || err}`);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "💾 Guardar Cambios";
        }
      }
    });
  }

  _recordLiveEvent(playerId, playerName, action, points, coordinates) {
    const pStat = this.currentGameStats.find(s => String(s.player_id ?? s.playerId) === String(playerId));
    if (pStat) {
      if (action === "fg2_made") { pStat.fg2_made = (pStat.fg2_made || 0) + 1; pStat.fg2_attempted = (pStat.fg2_attempted || 0) + 1; }
      else if (action === "fg3_made") { pStat.fg3_made = (pStat.fg3_made || 0) + 1; pStat.fg3_attempted = (pStat.fg3_attempted || 0) + 1; }
      else if (action === "ft_made") { pStat.ft_made = (pStat.ft_made || 0) + 1; pStat.ft_attempted = (pStat.ft_attempted || 0) + 1; }
      else if (action === "fg2_attempted") { pStat.fg2_attempted = (pStat.fg2_attempted || 0) + 1; }
      else if (action === "fg3_attempted") { pStat.fg3_attempted = (pStat.fg3_attempted || 0) + 1; }
      else if (action === "ft_attempted") { pStat.ft_attempted = (pStat.ft_attempted || 0) + 1; }
      else if (action === "blocks_made") { pStat.blocks_made = (pStat.blocks_made || 0) + 1; }
      else if (action === "fouls_drawn") { pStat.fouls_drawn = (pStat.fouls_drawn || 0) + 1; }
      else { pStat[action] = (pStat[action] || 0) + 1; }
    }

    if (points > 0) {
      const activePeriod = this.currentPeriods.find(p => p.period_number === this.activePeriodNumber && Boolean(p.is_overtime) === this.isPeriodOvertime);
      if (activePeriod) activePeriod.team_score = (activePeriod.team_score || 0) + points;
    }

    this.liveEventsHistory.push({
      id: this._generateUUID(),
      timestamp: Date.now(),
      playerId,
      playerName,
      action,
      points,
      period: this.activePeriodNumber,
      isOvertime: this.isPeriodOvertime,
      coordinates
    });

    if (this.currentGame?.id) {
      localStorage.setItem(`iq_game_events_${this.currentGame.id}`, JSON.stringify(this.liveEventsHistory));
    }

    this.selectedPlayerId = null;
    this.selectedPlayerName = null;
    this._renderEditFormPreservingScroll(document.getElementById("dashboard-content-area"));
  }

  _recordOpponentEvent(field, val) {
    const activePeriod = this.currentPeriods.find(p => p.period_number === this.activePeriodNumber && Boolean(p.is_overtime) === this.isPeriodOvertime);
    
    if (field === "points") {
      if (activePeriod) activePeriod.opponent_score = (activePeriod.opponent_score || 0) + val;
    } else {
      this.opponentStats[field] = (this.opponentStats[field] || 0) + 1;
    }

    this.liveEventsHistory.push({
      id: this._generateUUID(),
      timestamp: Date.now(),
      isOpponent: true,
      field,
      action: `opp_${field}`,
      points: field === "points" ? val : 0,
      period: this.activePeriodNumber,
      isOvertime: this.isPeriodOvertime
    });

    if (this.currentGame?.id) {
      localStorage.setItem(`iq_game_events_${this.currentGame.id}`, JSON.stringify(this.liveEventsHistory));
    }

    this._renderEditFormPreservingScroll(document.getElementById("dashboard-content-area"));
  }

  _removeSingleLiveEvent(index, container) {
    if (index < 0 || index >= this.liveEventsHistory.length) return;
    const [target] = this.liveEventsHistory.splice(index, 1);

    if (target.isOpponent) {
      if (target.field === "points") {
        const period = this.currentPeriods.find(p => p.period_number === target.period && Boolean(p.is_overtime) === target.isOvertime);
        if (period) period.opponent_score = Math.max(0, (period.opponent_score || 0) - target.points);
      } else {
        this.opponentStats[target.field] = Math.max(0, (this.opponentStats[target.field] || 0) - 1);
      }
    } else {
      const pStat = this.currentGameStats.find(s => String(s.player_id ?? s.playerId) === String(target.playerId));
      if (pStat) {
        if (target.action === "fg2_made") { pStat.fg2_made = Math.max(0, pStat.fg2_made - 1); pStat.fg2_attempted = Math.max(0, pStat.fg2_attempted - 1); }
        else if (target.action === "fg3_made") { pStat.fg3_made = Math.max(0, pStat.fg3_made - 1); pStat.fg3_attempted = Math.max(0, pStat.fg3_attempted - 1); }
        else if (target.action === "ft_made") { pStat.ft_made = Math.max(0, pStat.ft_made - 1); pStat.ft_attempted = Math.max(0, pStat.ft_attempted - 1); }
        else if (target.action === "fg2_attempted") { pStat.fg2_attempted = Math.max(0, pStat.fg2_attempted - 1); }
        else if (target.action === "fg3_attempted") { pStat.fg3_attempted = Math.max(0, pStat.fg3_attempted - 1); }
        else if (target.action === "ft_attempted") { pStat.ft_attempted = Math.max(0, pStat.ft_attempted - 1); }
        else if (target.action === "blocks_made") { pStat.blocks_made = Math.max(0, pStat.blocks_made - 1); }
        else if (target.action === "fouls_drawn") { pStat.fouls_drawn = Math.max(0, pStat.fouls_drawn - 1); }
        else if (pStat[target.action] !== undefined) { pStat[target.action] = Math.max(0, pStat[target.action] - 1); }
      }

      if (target.points > 0) {
        const period = this.currentPeriods.find(p => p.period_number === target.period && Boolean(p.is_overtime) === target.isOvertime);
        if (period) period.team_score = Math.max(0, (period.team_score || 0) - target.points);
      }
    }

    if (this.currentGame?.id) {
      localStorage.setItem(`iq_game_events_${this.currentGame.id}`, JSON.stringify(this.liveEventsHistory));
    }

    this._renderEditFormPreservingScroll(container);
  }
}

export default GameLiveEditorView;