/**
 * @fileoverview V38 mobile-first live game scorer.
 * @description Fast PBP keeps the existing game model, RBAC and secure capture
 * boundary while reducing common actions to two taps: player -> action or
 * action -> player. Shot location remains available as optional enrichment.
 */

import { LiveScoreHUDView } from "./LiveScoreHUDView.js";
import { LiveCaptureSyncService } from "../services/games/LiveCaptureSyncService.js";

const FAST_ACTIONS = Object.freeze({
  fg2_made: Object.freeze({ label: "+2", title: "Canasta de 2", points: 2, made: true, shot: true, tone: "made" }),
  fg2_attempted: Object.freeze({ label: "2✕", title: "Fallo de 2", points: 0, made: false, shot: true, tone: "miss" }),
  fg3_made: Object.freeze({ label: "+3", title: "Triple", points: 3, made: true, shot: true, tone: "made" }),
  fg3_attempted: Object.freeze({ label: "3✕", title: "Fallo triple", points: 0, made: false, shot: true, tone: "miss" }),
  ft_made: Object.freeze({ label: "+1", title: "Tiro libre anotado", points: 1, made: true, shot: false, tone: "made" }),
  ft_attempted: Object.freeze({ label: "TL✕", title: "Tiro libre fallado", points: 0, made: false, shot: false, tone: "miss" }),
  def_reb: Object.freeze({ label: "RD", title: "Rebote defensivo", points: 0, made: false, shot: false, tone: "neutral" }),
  off_reb: Object.freeze({ label: "RO", title: "Rebote ofensivo", points: 0, made: false, shot: false, tone: "neutral" }),
  assists: Object.freeze({ label: "AST", title: "Asistencia", points: 0, made: false, shot: false, tone: "skill" }),
  steals: Object.freeze({ label: "ROB", title: "Robo", points: 0, made: false, shot: false, tone: "skill" }),
  turnovers: Object.freeze({ label: "PER", title: "Pérdida", points: 0, made: false, shot: false, tone: "warn" }),
  fouls_committed: Object.freeze({ label: "FC", title: "Falta cometida", points: 0, made: false, shot: false, tone: "warn" }),
  fouls_drawn: Object.freeze({ label: "FR", title: "Falta recibida", points: 0, made: false, shot: false, tone: "neutral" }),
  blocks_made: Object.freeze({ label: "TAP", title: "Tapón", points: 0, made: false, shot: false, tone: "skill" })
});

function actionButtonClass(action) {
  return action.shot ? "btn-action-shot" : "btn-action-direct";
}

function safeShortName(name = "") {
  const value = String(name || "Jugador").trim();
  return value.split(/\s+/)[0] || "Jugador";
}

export class LiveScoreHUDViewV38 extends LiveScoreHUDView {
  constructor(authController = null, gameId = null) {
    super(authController, gameId);
    this.fastSelectedPlayerId = null;
    this.fastPendingActionKey = null;
    this.clockRunning = false;
    this.clockTimer = null;
    this.liveSyncTimer = null;
    this.liveSyncState = "idle";
    this.liveSyncError = "";
    this.lastLiveSyncAt = null;
    this.liveSyncService = null;
  }

  _liveSync() {
    if (!this.liveSyncService || this.liveSyncService.captureService !== this.captureService) {
      this.liveSyncService = new LiveCaptureSyncService(this.captureService);
    }
    return this.liveSyncService;
  }

  _haptic() {
    try {
      globalThis.navigator?.vibrate?.(12);
    } catch {
      // Haptics are progressive enhancement only.
    }
  }

  _clockText() {
    return this._secondsToClock(this.timeRemaining);
  }

  _startClock() {
    if (this.clockRunning || this.timeRemaining <= 0) return;
    this.clockRunning = true;
    this.clockTimer = globalThis.setInterval?.(() => {
      if (!this.clockRunning) return;
      this.timeRemaining = Math.max(0, Number(this.timeRemaining || 0) - 1);
      this._updateClockDom();
      if (this.timeRemaining <= 0) this._stopClock();
    }, 1000) || null;
    this._updateClockDom();
  }

  _stopClock() {
    this.clockRunning = false;
    if (this.clockTimer) globalThis.clearInterval?.(this.clockTimer);
    this.clockTimer = null;
    this._updateClockDom();
  }

  _toggleClock() {
    if (this.clockRunning) this._stopClock();
    else this._startClock();
    this._haptic();
  }

  _adjustClock(deltaSeconds) {
    const max = this._getPeriodDuration(this.currentPeriod);
    this.timeRemaining = Math.max(0, Math.min(max, Number(this.timeRemaining || 0) + Number(deltaSeconds || 0)));
    this._updateClockDom();
    this._haptic();
  }

  _updateClockDom() {
    const clock = this.container?.querySelector?.("#v38-game-clock");
    if (clock) clock.textContent = this._clockText();
    const toggle = this.container?.querySelector?.("#v38-clock-toggle");
    if (toggle) {
      toggle.textContent = this.clockRunning ? "⏸ Pausar" : "▶ Reloj";
      toggle.setAttribute("aria-pressed", String(this.clockRunning));
    }
  }

  _setPeriod(nextPeriod) {
    if (!nextPeriod || this.currentPeriod === nextPeriod) return;
    this._stopClock();

    this.subEvents.push({
      id: `sub-close-${Date.now()}`,
      type: "SUBSTITUTION",
      period: this.currentPeriod,
      timeRemaining: 0,
      playersIn: [],
      playersOut: [...this.onCourtPlayerIds],
      onCourt: [...this.onCourtPlayerIds]
    });

    this.currentPeriod = nextPeriod;
    this.timeRemaining = this._getPeriodDuration(nextPeriod);
    this.subEvents.push({
      id: `sub-start-${Date.now()}`,
      type: "SUBSTITUTION",
      period: this.currentPeriod,
      timeRemaining: this.timeRemaining,
      playersIn: [...this.onCourtPlayerIds],
      playersOut: [],
      onCourt: [...this.onCourtPlayerIds]
    });
    this.fastSelectedPlayerId = null;
    this.fastPendingActionKey = null;
    this._renderHUD();
  }

  _eventMinute() {
    const maxPeriodSec = this._getPeriodDuration(this.currentPeriod);
    const elapsedSec = Math.max(0, maxPeriodSec - Number(this.timeRemaining || 0));
    return Math.floor(elapsedSec / 60) + 1;
  }

  _recordPlayerAction(playerId, actionKey) {
    const action = FAST_ACTIONS[actionKey];
    const player = this.roster.find(item => String(item.id) === String(playerId));
    if (!action || !player || !this.onCourtPlayerIds.includes(player.id)) return;

    if (action.points > 0) this.teamScore += action.points;
    const event = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isOpponent: false,
      period: this.currentPeriod,
      timeRemaining: this.timeRemaining,
      game_clock: this._clockText(),
      minute: this._eventMinute(),
      action: actionKey,
      action_type: actionKey,
      event_type: actionKey,
      actionLabel: this._getActionLabelSpanish(actionKey),
      points: action.points,
      teamScore: this.teamScore,
      opponentScore: this.opponentScore,
      playerId: player.id,
      player_id: player.id,
      playerName: player.name,
      coord_x: null,
      coord_y: null,
      made: Boolean(action.made),
      onCourt: [...this.onCourtPlayerIds]
    };

    this.playByPlayEvents.push(event);
    this.undoneEventsStack = [];
    this.fastSelectedPlayerId = null;
    this.fastPendingActionKey = null;
    this._haptic();
    this._scheduleLiveSync();
    this._renderHUD();
  }

  _recordOpponentAction(type, value = 0) {
    const points = type === "pts" ? Number(value || 0) : 0;
    if (points > 0) this.opponentScore += points;

    const labels = {
      pts: `Rival +${points}`,
      dreb: "Rebote defensivo rival",
      oreb: "Rebote ofensivo rival",
      tov: "Pérdida rival"
    };
    const event = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isOpponent: true,
      period: this.currentPeriod,
      timeRemaining: this.timeRemaining,
      game_clock: this._clockText(),
      minute: this._eventMinute(),
      action: `opp_${type}`,
      action_type: `opp_${type}`,
      event_type: `opp_${type}`,
      actionLabel: labels[type] || "Acción rival",
      points,
      teamScore: this.teamScore,
      opponentScore: this.opponentScore,
      playerName: "Rival",
      player_id: null,
      made: points > 0,
      onCourt: [...this.onCourtPlayerIds]
    };

    this.playByPlayEvents.push(event);
    this.undoneEventsStack = [];
    this._haptic();
    this._scheduleLiveSync();
    this._renderHUD();
  }

  _togglePlayer(playerId) {
    const id = String(playerId || "");
    if (!this.onCourtPlayerIds.includes(id)) return;
    if (this.fastPendingActionKey) {
      this._recordPlayerAction(id, this.fastPendingActionKey);
      return;
    }
    this.fastSelectedPlayerId = this.fastSelectedPlayerId === id ? null : id;
    this._haptic();
    this._renderHUD();
  }

  _chooseAction(actionKey) {
    if (!FAST_ACTIONS[actionKey]) return;
    if (this.fastSelectedPlayerId) {
      this._recordPlayerAction(this.fastSelectedPlayerId, actionKey);
      return;
    }
    this.fastPendingActionKey = this.fastPendingActionKey === actionKey ? null : actionKey;
    this._haptic();
    this._renderHUD();
  }

  _openAdvancedShot(shotType, made) {
    this.pendingAction = {
      type: "shot",
      shotType,
      made: Boolean(made),
      points: made ? (shotType === "T3" ? 3 : 2) : 0
    };
    this.activeModal = "court_shot";
    this._renderHUD();
  }

  _formatEventsForSave() {
    return this.playByPlayEvents.map((event, index) => {
      const playerId = event.player_id || event.playerId || null;
      const actionName = event.action_type || event.action || event.event_type;
      return {
        id: event.id || `ev-${Date.now()}-${index}`,
        player_id: playerId,
        playerId,
        playerName: event.playerName || "",
        period: this._periodNumberForName(event.period || "Q1"),
        game_clock: String(event.game_clock || this._secondsToClock(event.timeRemaining ?? this._getPeriodDuration(event.period || this.currentPeriod))),
        action_type: actionName,
        action: actionName,
        event_type: actionName,
        points: Number(event.points || 0),
        is_opponent: Boolean(event.isOpponent),
        isOpponent: Boolean(event.isOpponent),
        made: Boolean(event.made),
        coord_x: event.coord_x === null || event.coord_x === undefined ? null : Number(event.coord_x),
        coord_y: event.coord_y === null || event.coord_y === undefined ? null : Number(event.coord_y)
      };
    });
  }

  _periodScoresForSave() {
    return this.periodsList.map(periodName => ({
      period_type: periodName.startsWith("OT") ? "overtime" : "quarter",
      period_number: this._periodNumberForName(periodName),
      team_score: this.playByPlayEvents
        .filter(event => event.period === periodName && !event.isOpponent)
        .reduce((sum, event) => sum + Number(event.points || 0), 0),
      opponent_score: this.playByPlayEvents
        .filter(event => event.period === periodName && event.isOpponent)
        .reduce((sum, event) => sum + Number(event.points || 0), 0),
      is_overtime: periodName.startsWith("OT")
    }));
  }

  _buildLivePayload() {
    return {
      teamScore: this.teamScore,
      opponentScore: this.opponentScore,
      starterIds: this.roster.filter(player => player.isConvoked && player.isStarter).map(player => player.id),
      stats: null,
      periods: this._periodScoresForSave(),
      events: this._formatEventsForSave()
    };
  }

  _scheduleLiveSync() {
    if (!this.isExistingGame || !this.gameId) return;
    const payload = this._buildLivePayload();
    this._liveSync().saveDraft(this.gameId, payload);
    this.liveSyncState = "pending";
    this.liveSyncError = "";
    this._updateSyncStatusDom();
    if (this.liveSyncTimer) globalThis.clearTimeout?.(this.liveSyncTimer);
    this.liveSyncTimer = globalThis.setTimeout?.(() => {
      this._flushLiveSync(payload).catch(() => {});
    }, 300) || null;
  }

  async _flushLiveSync(payload = this._buildLivePayload()) {
    if (!this.isExistingGame || !this.gameId) return { synced: false, queued: false };
    this.liveSyncState = "syncing";
    this._updateSyncStatusDom();
    const result = await this._liveSync().sync(this.gameId, payload);
    if (result.synced) {
      this.liveSyncState = "synced";
      this.liveSyncError = "";
      this.lastLiveSyncAt = new Date();
    } else {
      this.liveSyncState = result.queued ? "queued" : "error";
      this.liveSyncError = String(result.error?.message || result.error || "");
    }
    this._updateSyncStatusDom();
    return result;
  }

  _syncStatusText() {
    if (!this.isExistingGame) return "Borrador local · se guardará al cerrar";
    if (this.liveSyncState === "pending") return "Guardando…";
    if (this.liveSyncState === "syncing") return "Sincronizando en vivo…";
    if (this.liveSyncState === "queued") return "Sin cobertura · jugadas protegidas en este móvil";
    if (this.liveSyncState === "error") return "No se pudo sincronizar";
    if (this.liveSyncState === "synced") return "En vivo · sincronizado";
    return "En vivo · listo";
  }

  _updateSyncStatusDom() {
    const node = this.container?.querySelector?.("#v38-sync-status");
    if (!node) return;
    node.textContent = this._syncStatusText();
    node.dataset.state = this.liveSyncState;
    if (this.liveSyncError) node.title = this.liveSyncError;
  }

  _lastEventsMarkup(limit = 4) {
    const rows = [...this.playByPlayEvents].slice(-limit).reverse();
    if (!rows.length) return '<div class="v38-empty-feed">La primera jugada aparecerá aquí.</div>';
    return rows.map(event => `
      <div class="v38-feed-row ${event.isOpponent ? "is-opponent" : ""}">
        <span class="v38-feed-clock">${event.period} · ${this._secondsToClock(event.timeRemaining ?? 0)}</span>
        <span class="v38-feed-action">${event.actionLabel || this._getActionLabelSpanish(event.action)}</span>
        <strong class="v38-feed-player">${event.playerName || "Rival"}</strong>
      </div>
    `).join("");
  }

  _renderHUD() {
    const onCourtPlayers = this.roster.filter(player => this.onCourtPlayerIds.includes(player.id));
    const isHome = this.config.venue === "Local";
    const myTeamLabel = isHome ? "JMJ Manyanet" : (this.config.opponent || "Rival");
    const oppTeamLabel = isHome ? (this.config.opponent || "Rival") : "JMJ Manyanet";
    const selectedAction = FAST_ACTIONS[this.fastPendingActionKey] || null;
    const selectedPlayer = this.roster.find(player => player.id === this.fastSelectedPlayerId) || null;
    const instruction = selectedAction
      ? `Ahora toca la jugadora: ${selectedAction.title}`
      : selectedPlayer
        ? `${safeShortName(selectedPlayer.name)} seleccionada · toca una acción`
        : "Toca jugadora + acción, o acción + jugadora";

    this.container.innerHTML = `
      <div class="v38-live-root" style="max-width: 1400px; margin:0 auto; padding-bottom:96px; box-sizing:border-box;">
        <header class="v38-scorebar">
          <div class="v38-team v38-team-home"><span>${myTeamLabel}</span><strong>${this.teamScore}</strong></div>
          <div class="v38-clock-wrap">
            <button type="button" id="v38-clock-toggle" class="btn-action-direct v38-clock-main" aria-pressed="${this.clockRunning}">${this.clockRunning ? "⏸ Pausar" : "▶ Reloj"}</button>
            <div id="v38-game-clock" class="v38-clock">${this._clockText()}</div>
            <div class="v38-period">${this.currentPeriod}</div>
          </div>
          <div class="v38-team v38-team-away"><strong>${this.opponentScore}</strong><span>${oppTeamLabel}</span></div>
        </header>

        <section class="v38-toolbar" aria-label="Controles del partido">
          <button type="button" id="btn-hud-undo" ${this.playByPlayEvents.length ? "" : "disabled"}>↩ Deshacer</button>
          <button type="button" id="btn-hud-redo" ${this.undoneEventsStack.length ? "" : "disabled"}>↪ Rehacer</button>
          <button type="button" id="btn-hud-subs">🔄 Cambios</button>
          <button type="button" id="btn-hud-pbp">📋 ${this.playByPlayEvents.length}</button>
          <span id="v38-sync-status" class="v38-sync" data-state="${this.liveSyncState}">${this._syncStatusText()}</span>
        </section>

        <section class="v38-period-strip" aria-label="Periodo">
          ${this.periodsList.map(period => `<button type="button" class="btn-period-hud ${period === this.currentPeriod ? "is-active" : ""}" data-period="${period}">${period}</button>`).join("")}
          <button type="button" id="btn-add-ot">+PR</button>
          <button type="button" class="btn-action-direct v38-clock-adjust" data-seconds="5">+5s</button>
          <button type="button" class="btn-action-direct v38-clock-adjust" data-seconds="-5">−5s</button>
        </section>

        <section class="v38-player-section">
          <div class="v38-section-title"><strong>5 EN PISTA</strong><span>${instruction}</span></div>
          <div class="v38-player-grid">
            ${onCourtPlayers.map(player => `
              <button type="button" class="v38-player ${player.id === this.fastSelectedPlayerId ? "is-selected" : ""}" data-player-id="${player.id}" aria-pressed="${player.id === this.fastSelectedPlayerId}">
                <strong>#${player.jersey}</strong><span>${safeShortName(player.name)}</span>
              </button>
            `).join("")}
          </div>
        </section>

        <section class="v38-actions-section">
          <div class="v38-section-title"><strong>ACCIÓN RÁPIDA</strong><span>Las jugadas habituales no abren ventanas.</span></div>
          <div class="v38-actions-grid">
            ${Object.entries(FAST_ACTIONS).map(([key, action]) => `
              <button type="button" class="${actionButtonClass(action)} v38-fast-action tone-${action.tone} ${key === this.fastPendingActionKey ? "is-armed" : ""}" data-fast-action="${key}" title="${action.title}" aria-pressed="${key === this.fastPendingActionKey}">
                <strong>${action.label}</strong><span>${action.title}</span>
              </button>
            `).join("")}
          </div>
        </section>

        <section class="v38-opponent-section">
          <div class="v38-section-title"><strong>RIVAL · 1 TOQUE</strong><span>Marcador y acciones esenciales.</span></div>
          <div class="v38-opponent-grid">
            <button type="button" class="btn-opp-action" data-type="pts" data-val="1">+1</button>
            <button type="button" class="btn-opp-action" data-type="pts" data-val="2">+2</button>
            <button type="button" class="btn-opp-action" data-type="pts" data-val="3">+3</button>
            <button type="button" class="btn-opp-action subtle" data-type="dreb" data-val="0">RD</button>
            <button type="button" class="btn-opp-action subtle" data-type="oreb" data-val="0">RO</button>
            <button type="button" class="btn-opp-action subtle" data-type="tov" data-val="0">PER</button>
          </div>
        </section>

        <section class="v38-feed-section">
          <div class="v38-section-title"><strong>ÚLTIMAS JUGADAS</strong><button type="button" id="v38-open-pbp">Ver todas</button></div>
          <div class="v38-feed">${this._lastEventsMarkup()}</div>
        </section>

        <details class="v38-advanced">
          <summary>🎯 Añadir localización de tiro (opcional)</summary>
          <div class="v38-advanced-grid">
            <button type="button" class="btn-action-shot v38-advanced-shot" data-shot="T2" data-made="true">2 anotado + zona</button>
            <button type="button" class="btn-action-shot v38-advanced-shot" data-shot="T2" data-made="false">2 fallado + zona</button>
            <button type="button" class="btn-action-shot v38-advanced-shot" data-shot="T3" data-made="true">3 anotado + zona</button>
            <button type="button" class="btn-action-shot v38-advanced-shot" data-shot="T3" data-made="false">3 fallado + zona</button>
          </div>
        </details>

        <div class="v38-finish-row">
          <button type="button" id="btn-hud-finish">🏁 Finalizar y revisar acta</button>
        </div>
      </div>
    `;

    this._bindV38HUDEvents();
    this._renderModalLayer();
    this._updateClockDom();
  }

  _bindV38HUDEvents() {
    this.container.querySelector("#v38-clock-toggle")?.addEventListener("click", event => {
      event.preventDefault();
      this._toggleClock();
    });

    this.container.querySelectorAll(".v38-clock-adjust").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        this._adjustClock(Number(button.dataset.seconds || 0));
      });
    });

    this.container.querySelectorAll(".btn-period-hud").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        this._setPeriod(button.dataset.period);
      });
    });

    this.container.querySelector("#btn-add-ot")?.addEventListener("click", event => {
      event.preventDefault();
      this._stopClock();
      const count = this.periodsList.filter(period => period.startsWith("OT")).length + 1;
      const overtime = `OT${count}`;
      this.periodsList.push(overtime);
      this._setPeriod(overtime);
    });

    this.container.querySelectorAll(".v38-player").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        this._togglePlayer(button.dataset.playerId);
      });
    });

    this.container.querySelectorAll(".v38-fast-action").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        this._chooseAction(button.dataset.fastAction);
      });
    });

    this.container.querySelectorAll(".btn-opp-action").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        this._recordOpponentAction(button.dataset.type, Number(button.dataset.val || 0));
      });
    });

    this.container.querySelector("#btn-hud-undo")?.addEventListener("click", event => {
      event.preventDefault();
      if (!this.playByPlayEvents.length) return;
      const last = this.playByPlayEvents.pop();
      this.undoneEventsStack.push(last);
      this._recalculateScoreFromEvents();
      this.fastSelectedPlayerId = null;
      this.fastPendingActionKey = null;
      this._haptic();
      this._scheduleLiveSync();
      this._renderHUD();
    });

    this.container.querySelector("#btn-hud-redo")?.addEventListener("click", event => {
      event.preventDefault();
      if (!this.undoneEventsStack.length) return;
      const restored = this.undoneEventsStack.pop();
      this.playByPlayEvents.push(restored);
      this._recalculateScoreFromEvents();
      this._haptic();
      this._scheduleLiveSync();
      this._renderHUD();
    });

    this.container.querySelector("#btn-hud-subs")?.addEventListener("click", event => {
      event.preventDefault();
      this._stopClock();
      this.pendingSubOnCourt = [...this.onCourtPlayerIds];
      this.activeModal = "substitutions";
      this._renderHUD();
    });

    const openPbp = event => {
      event?.preventDefault?.();
      this.activeModal = "play_by_play";
      this._renderHUD();
    };
    this.container.querySelector("#btn-hud-pbp")?.addEventListener("click", openPbp);
    this.container.querySelector("#v38-open-pbp")?.addEventListener("click", openPbp);

    this.container.querySelectorAll(".v38-advanced-shot").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        this._openAdvancedShot(button.dataset.shot, button.dataset.made === "true");
      });
    });

    this.container.querySelector("#btn-hud-finish")?.addEventListener("click", async event => {
      event.preventDefault();
      this._stopClock();
      if (this.isExistingGame) {
        await this._flushLiveSync().catch(() => {});
      }
      this._closeModalLayer();
      this.currentStep = 4;
      this.render();
    });
  }
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v38-fast-pbp-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v38-fast-pbp-styles";
  style.textContent = `
    .v38-live-root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a;touch-action:manipulation}
    .v38-scorebar{position:sticky;top:0;z-index:30;display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;background:#0f172a;color:#fff;border-radius:0 0 14px 14px;padding:8px max(10px,env(safe-area-inset-right,0px)) 9px max(10px,env(safe-area-inset-left,0px));box-shadow:0 8px 22px rgba(15,23,42,.18)}
    .v38-team{display:flex;gap:7px;align-items:center;min-width:0;font-size:11px;font-weight:800;text-transform:uppercase}.v38-team span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v38-team strong{font-size:28px;line-height:1}.v38-team-away{justify-content:flex-end;text-align:right}.v38-team-home strong{color:#38bdf8}.v38-team-away strong{color:#fb923c}
    .v38-clock-wrap{text-align:center;min-width:96px}.v38-clock{font:900 26px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.03em}.v38-period{font-size:10px;font-weight:900;color:#cbd5e1;margin-top:2px}.v38-clock-main{border:0;background:transparent!important;color:#fff!important;padding:0!important;min-height:22px!important;font-size:10px!important;font-weight:800!important}
    .v38-toolbar,.v38-period-strip{display:flex;gap:6px;align-items:center;overflow-x:auto;padding:8px 10px;background:#fff;border-bottom:1px solid #e2e8f0;scrollbar-width:none}.v38-toolbar::-webkit-scrollbar,.v38-period-strip::-webkit-scrollbar{display:none}.v38-toolbar button,.v38-period-strip button{flex:0 0 auto;min-height:42px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#334155;padding:7px 10px;font-weight:850;font-size:11px}.v38-toolbar button:disabled{opacity:.4}.v38-sync{margin-left:auto;flex:0 0 auto;font-size:10px;font-weight:800;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:999px;padding:5px 8px}.v38-sync[data-state="queued"],.v38-sync[data-state="error"]{color:#92400e;background:#fffbeb;border-color:#fde68a}
    .v38-period-strip{padding-top:6px;padding-bottom:6px;background:#f8fafc}.v38-period-strip .btn-period-hud.is-active{background:#f97316;color:#fff;border-color:#f97316}.v38-period-strip #btn-add-ot{background:#0f172a;color:#fff;border-color:#0f172a}.v38-period-strip .v38-clock-adjust{background:#eef2ff;color:#3730a3;border-color:#c7d2fe}
    .v38-player-section,.v38-actions-section,.v38-opponent-section,.v38-feed-section,.v38-advanced{margin:10px;background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:10px;box-shadow:0 2px 8px rgba(15,23,42,.03)}
    .v38-section-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px;font-size:10px;color:#64748b}.v38-section-title strong{color:#0f172a;font-size:11px;letter-spacing:.03em}.v38-section-title span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v38-section-title button{border:0;background:transparent;color:#1d4ed8;font-size:10px;font-weight:800}
    .v38-player-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.v38-player{min-width:0;min-height:58px;border:2px solid #bfdbfe;border-radius:10px;background:#eff6ff;color:#1e3a8a;padding:5px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center}.v38-player strong{font-size:17px;line-height:1}.v38-player span{font-size:10px;font-weight:800;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v38-player.is-selected{background:#1d4ed8;color:#fff;border-color:#1d4ed8;box-shadow:0 0 0 3px #bfdbfe}
    .v38-actions-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.v38-fast-action{min-height:58px;border:0;border-radius:11px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-weight:900}.v38-fast-action strong{font-size:18px;line-height:1}.v38-fast-action span{font-size:9px;margin-top:4px;line-height:1.05}.v38-fast-action.tone-made{background:#16a34a}.v38-fast-action.tone-miss{background:#dc2626}.v38-fast-action.tone-skill{background:#4f46e5}.v38-fast-action.tone-warn{background:#ea580c}.v38-fast-action.tone-neutral{background:#0284c7}.v38-fast-action.is-armed{outline:4px solid #facc15;outline-offset:1px;transform:translateY(-1px)}
    .v38-opponent-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}.v38-opponent-grid .btn-opp-action{min-height:48px;border:0;border-radius:9px;background:#c2410c;color:#fff;font-weight:900;font-size:15px}.v38-opponent-grid .btn-opp-action.subtle{background:#ffedd5;color:#9a3412;border:1px solid #fdba74}
    .v38-feed{border-top:1px solid #f1f5f9}.v38-feed-row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:7px 2px;border-bottom:1px solid #f1f5f9;font-size:10px}.v38-feed-row.is-opponent{background:#fff7ed}.v38-feed-clock{color:#64748b;font-weight:800}.v38-feed-action{font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v38-feed-player{color:#1e3a8a}.v38-empty-feed{padding:12px;text-align:center;font-size:11px;color:#94a3b8}
    .v38-advanced summary{cursor:pointer;font-size:11px;font-weight:850;color:#475569}.v38-advanced-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:9px}.v38-advanced-grid button{min-height:46px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc;color:#334155;font-weight:800}
    .v38-finish-row{padding:10px}.v38-finish-row button{width:100%;min-height:52px;border:0;border-radius:11px;background:#0f172a;color:#fff;font-weight:900}
    @media (min-width:720px){.v38-live-root{padding:12px 16px 70px}.v38-scorebar{border-radius:14px;top:8px;padding:11px 18px}.v38-player-section,.v38-actions-section,.v38-opponent-section,.v38-feed-section,.v38-advanced{margin:12px 0}.v38-actions-grid{grid-template-columns:repeat(7,minmax(0,1fr))}.v38-fast-action{min-height:66px}.v38-opponent-grid{max-width:680px}}
    @media (max-width:370px){.v38-team span{display:none}.v38-player strong{font-size:15px}.v38-player span{font-size:9px}.v38-actions-grid{gap:5px}.v38-fast-action{min-height:54px}}
  `;
  document.head.appendChild(style);
}

export default LiveScoreHUDViewV38;
