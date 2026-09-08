/**
 * @fileoverview V42 recovered live scorer focused on game-day usability.
 * @description Keeps the resilient V38 live-sync engine and the external
 * lifecycle/writer-lease security wrappers, while deliberately dropping the
 * V39/V40/V41 presentation layers that introduced palette tabs, fixed viewport
 * assumptions and oversized action tiles. Two/three-point shots require court
 * location for both teams. Play-by-play mutations recalculate running scores
 * and are immediately persisted through the existing secure capture boundary.
 */

import { LiveScoreHUDViewV38 } from "./LiveScoreHUDViewV38.js";

const TEAM_SHOTS = Object.freeze({
  fg2_made: Object.freeze({ shotType: "T2", made: true, points: 2 }),
  fg2_attempted: Object.freeze({ shotType: "T2", made: false, points: 0 }),
  fg3_made: Object.freeze({ shotType: "T3", made: true, points: 3 }),
  fg3_attempted: Object.freeze({ shotType: "T3", made: false, points: 0 })
});

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function eventId() {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class LiveScoreHUDViewV42 extends LiveScoreHUDViewV38 {
  constructor(authController = null, gameId = null) {
    super(authController, gameId);
    this.pendingOpponentShot = null;
  }

  /**
   * V42 intentionally starts from V38, not V41. V38 owns the resilient live
   * state/sync engine; V42 restores a normal document flow and a direct scorer.
   */
  _renderHUD() {
    this._normalizeRunningScores();
    super._renderHUD();

    const root = this.container?.querySelector?.(".v38-live-root");
    if (!root) return;
    root.classList.add("v42-recovered-root");
    root.dataset.v42Scorer = "true";

    const teamTitle = root.querySelector(".v38-actions-section .v38-section-title");
    if (teamTitle) {
      teamTitle.innerHTML = "<strong>MI EQUIPO</strong><span>2P/3P: toca la zona del tiro.</span>";
    }

    const opponentTitle = root.querySelector(".v38-opponent-section .v38-section-title");
    if (opponentTitle) {
      opponentTitle.innerHTML = "<strong>RIVAL</strong><span>2P/3P: toca la zona del tiro.</span>";
    }

    // V38 exposed location as an optional secondary tool. In V42 location is
    // part of the primary 2P/3P flow, so the duplicate advanced panel is removed.
    root.querySelector(".v38-advanced")?.remove();
  }

  _chooseAction(actionKey) {
    const shot = TEAM_SHOTS[actionKey];
    if (!shot) {
      super._chooseAction(actionKey);
      return;
    }

    const selectedPlayer = this.roster.find(player => String(player.id) === String(this.fastSelectedPlayerId)) || null;
    this.pendingAction = {
      type: "shot",
      actionKey,
      shotType: shot.shotType,
      made: shot.made,
      points: shot.points,
      playerId: selectedPlayer?.id || null,
      playerName: selectedPlayer?.name || null,
      coord_x: null,
      coord_y: null
    };
    this.fastPendingActionKey = null;
    this.activeModal = "court_shot";
    this._haptic();
    this._renderHUD();
  }

  _recordOpponentAction(type, value = 0) {
    const points = type === "pts" ? Number(value || 0) : 0;
    if (type === "pts" && (points === 2 || points === 3)) {
      this.pendingOpponentShot = {
        points,
        coord_x: null,
        coord_y: null
      };
      this.activeModal = "opponent_court_shot";
      this._haptic();
      this._renderHUD();
      return;
    }
    super._recordOpponentAction(type, value);
  }

  _commitTeamShot(playerId, playerName) {
    const pending = this.pendingAction;
    if (!pending || !TEAM_SHOTS[pending.actionKey]) return;
    const id = String(playerId || pending.playerId || "");
    const player = this.roster.find(item => String(item.id) === id);
    if (!player || !this.onCourtPlayerIds.includes(player.id)) return;

    if (pending.points > 0) this.teamScore += Number(pending.points || 0);
    this.playByPlayEvents.push({
      id: eventId(),
      isOpponent: false,
      period: this.currentPeriod,
      timeRemaining: this.timeRemaining,
      game_clock: this._clockText(),
      minute: this._eventMinute(),
      action: pending.actionKey,
      action_type: pending.actionKey,
      event_type: pending.actionKey,
      actionLabel: this._getActionLabelSpanish(pending.actionKey),
      points: Number(pending.points || 0),
      teamScore: this.teamScore,
      opponentScore: this.opponentScore,
      playerId: player.id,
      player_id: player.id,
      playerName: playerName || player.name,
      coord_x: Number(pending.coord_x),
      coord_y: Number(pending.coord_y),
      made: Boolean(pending.made),
      onCourt: [...this.onCourtPlayerIds]
    });

    this.undoneEventsStack = [];
    this.fastSelectedPlayerId = null;
    this.fastPendingActionKey = null;
    this.pendingAction = null;
    this._normalizeRunningScores();
    this._haptic();
    this._scheduleLiveSync();
    this._closeModalLayer();
    this._renderHUD();
  }

  _commitOpponentShot() {
    const pending = this.pendingOpponentShot;
    if (!pending || ![2, 3].includes(Number(pending.points))) return;
    const points = Number(pending.points);
    this.opponentScore += points;
    this.playByPlayEvents.push({
      id: eventId(),
      isOpponent: true,
      period: this.currentPeriod,
      timeRemaining: this.timeRemaining,
      game_clock: this._clockText(),
      minute: this._eventMinute(),
      action: "opp_pts",
      action_type: "opp_pts",
      event_type: "opp_pts",
      actionLabel: `Rival +${points}`,
      points,
      teamScore: this.teamScore,
      opponentScore: this.opponentScore,
      playerName: "Rival",
      player_id: null,
      coord_x: Number(pending.coord_x),
      coord_y: Number(pending.coord_y),
      made: true,
      onCourt: [...this.onCourtPlayerIds]
    });

    this.undoneEventsStack = [];
    this.pendingOpponentShot = null;
    this._normalizeRunningScores();
    this._haptic();
    this._scheduleLiveSync();
    this._closeModalLayer();
    this._renderHUD();
  }

  _normalizeRunningScores() {
    // Some historical/imported games can have an authoritative stored score but
    // no granular PBP. Rendering that state must not silently turn it into 0-0.
    // Mutation paths call the base recalculator first, so deleting the final live
    // event still correctly leaves a 0-0 score when the capture itself is empty.
    if (!this.playByPlayEvents.length) return;

    let team = 0;
    let opponent = 0;
    this.playByPlayEvents.forEach(event => {
      const points = Number(event?.points || 0);
      if (event?.isOpponent) opponent += points;
      else team += points;
      event.teamScore = team;
      event.opponentScore = opponent;
    });
    this.teamScore = team;
    this.opponentScore = opponent;
  }

  _recalculateScoreFromEvents() {
    super._recalculateScoreFromEvents();
    this._normalizeRunningScores();
  }

  _getModalContent() {
    if (this.activeModal === "opponent_court_shot") {
      const points = Number(this.pendingOpponentShot?.points || 0);
      return `
        <div class="hud-modal-overlay v42-shot-overlay">
          <div class="hud-modal-content v42-shot-modal">
            <div class="v42-modal-heading">
              <div><strong>📍 Rival +${points}</strong><span>Toca dónde se produjo el lanzamiento.</span></div>
              <button type="button" class="btn-close-modal" aria-label="Cerrar">✕</button>
            </div>
            <div class="v42-court" id="v42-opponent-court" role="button" aria-label="Pista para seleccionar la localización del tiro rival">
              <svg viewBox="0 0 500 470" aria-hidden="true">
                <rect x="0" y="0" width="500" height="470" fill="none" stroke="#fff" stroke-width="4"/>
                <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.15)" stroke="#fff" stroke-width="3"/>
                <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
                <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#fff" stroke-width="3"/>
              </svg>
            </div>
            <p class="v42-modal-help">La jugada no se registra hasta tocar la pista.</p>
          </div>
        </div>`;
    }

    if (this.activeModal === "play_by_play") {
      const rows = [...this.playByPlayEvents].reverse();
      return `
        <div class="hud-modal-overlay v42-pbp-overlay">
          <div class="hud-modal-content v42-pbp-modal">
            <div class="v42-modal-heading">
              <div><strong>📋 Jugadas</strong><span>${rows.length} registradas</span></div>
              <button type="button" class="btn-close-modal" aria-label="Cerrar">✕</button>
            </div>
            <div class="v42-pbp-list">
              ${rows.length ? rows.map(event => `
                <article class="v42-pbp-row ${event.isOpponent ? "is-opponent" : ""}">
                  <div class="v42-pbp-meta">
                    <strong>${escapeHtml(event.period || "")}</strong>
                    <span>${escapeHtml(event.game_clock || this._secondsToClock(event.timeRemaining ?? 0))}</span>
                    <b>${Number(event.teamScore || 0)}–${Number(event.opponentScore || 0)}</b>
                  </div>
                  <div class="v42-pbp-main">
                    <strong>${escapeHtml(event.actionLabel || this._getActionLabelSpanish(event.action))}</strong>
                    <span>${escapeHtml(event.playerName || "Rival")}</span>
                  </div>
                  <button type="button" class="btn-del-pbp-event v42-pbp-delete" data-id="${escapeHtml(event.id)}" aria-label="Anular jugada">Anular</button>
                </article>
              `).join("") : '<div class="v42-pbp-empty">No hay jugadas registradas.</div>'}
            </div>
          </div>
        </div>`;
    }

    return super._getModalContent();
  }

  _bindModalDynamicEvents() {
    super._bindModalDynamicEvents();
    const portal = document.getElementById("hud-dynamic-modal-portal");
    if (!portal) return;

    if (this.activeModal === "court_shot") {
      const court = portal.querySelector("#modal-court-clickarea");
      if (court) {
        court.onclick = event => {
          const rect = court.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          if (!this.pendingAction) return;
          this.pendingAction.coord_x = Number(x.toFixed(1));
          this.pendingAction.coord_y = Number(y.toFixed(1));

          if (this.pendingAction.playerId) {
            this._commitTeamShot(this.pendingAction.playerId, this.pendingAction.playerName);
            return;
          }
          const picker = portal.querySelector("#shot-player-picker");
          if (picker) picker.style.display = "block";
        };
      }

      portal.querySelectorAll(".btn-select-shot-player").forEach(button => {
        button.onclick = event => {
          event.preventDefault();
          this._commitTeamShot(button.dataset.id, button.dataset.name);
        };
      });
    }

    if (this.activeModal === "opponent_court_shot") {
      const court = portal.querySelector("#v42-opponent-court");
      if (court) {
        court.onclick = event => {
          const rect = court.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          if (!this.pendingOpponentShot) return;
          this.pendingOpponentShot.coord_x = Number(x.toFixed(1));
          this.pendingOpponentShot.coord_y = Number(y.toFixed(1));
          this._commitOpponentShot();
        };
      }
    }

    if (this.activeModal === "play_by_play") {
      portal.querySelectorAll(".btn-del-pbp-event").forEach(button => {
        button.onclick = event => {
          event.preventDefault();
          const id = String(button.dataset.id || "");
          this.playByPlayEvents = this.playByPlayEvents.filter(item => String(item.id) !== id);
          this.undoneEventsStack = [];
          this._recalculateScoreFromEvents();
          this._scheduleLiveSync();
          this.activeModal = "play_by_play";
          this._haptic();
          this._renderHUD();
        };
      });
    }
  }
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v42-recovered-scorer-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v42-recovered-scorer-styles";
  style.textContent = `
    .v42-recovered-root{position:static!important;height:auto!important;min-height:0!important;overflow:visible!important;padding-bottom:calc(100px + env(safe-area-inset-bottom))!important}
    .v42-recovered-root .v38-actions-section,.v42-recovered-root .v38-opponent-section{position:static!important;inset:auto!important;height:auto!important;overflow:visible!important}
    .v42-recovered-root .v38-actions-grid{height:auto!important;grid-template-rows:none!important;align-content:initial!important}
    .v42-recovered-root .v38-fast-action{height:auto!important;min-height:52px!important}
    .v42-recovered-root .v38-opponent-grid{height:auto!important;grid-template-rows:none!important}
    .v42-recovered-root .v38-advanced{display:none!important}
    .v42-recovered-root .v38-section-title span{white-space:normal!important;text-align:right}

    .v42-modal-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.v42-modal-heading>div{display:flex;flex-direction:column;gap:2px}.v42-modal-heading strong{font-size:16px;color:#0f172a}.v42-modal-heading span{font-size:11px;color:#64748b}.v42-modal-heading>button{border:0;background:transparent;font-size:22px;line-height:1;min-width:36px;min-height:36px;color:#0f172a}
    .v42-shot-modal{width:min(500px,calc(100vw - 18px))!important;max-width:500px!important}.v42-court{position:relative;width:100%;aspect-ratio:50/47;background:#d97736;border:2px solid #fff;border-radius:10px;overflow:hidden;cursor:crosshair;touch-action:manipulation}.v42-court svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.v42-modal-help{margin:8px 0 0;font-size:11px;color:#64748b;text-align:center}
    .v42-pbp-modal{width:min(620px,calc(100vw - 16px))!important;max-width:620px!important;max-height:min(82dvh,720px)!important;display:flex!important;flex-direction:column!important}.v42-pbp-list{display:flex;flex-direction:column;gap:7px;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:1px}.v42-pbp-row{display:grid;grid-template-columns:82px minmax(0,1fr) auto;gap:9px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:9px;background:#fff}.v42-pbp-row.is-opponent{background:#fff7ed;border-color:#fed7aa}.v42-pbp-meta{display:grid;grid-template-columns:auto auto;gap:1px 6px;font-size:10px;color:#64748b}.v42-pbp-meta>b{grid-column:1/-1;color:#0f172a;font-size:14px}.v42-pbp-main{min-width:0;display:flex;flex-direction:column;gap:2px}.v42-pbp-main strong{font-size:12px;color:#0f172a;white-space:normal}.v42-pbp-main span{font-size:11px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v42-pbp-delete{min-height:40px;border:1px solid #fca5a5;border-radius:8px;background:#fff1f2;color:#b91c1c;font-weight:850;padding:6px 9px}.v42-pbp-empty{padding:24px;text-align:center;color:#94a3b8}

    @media(max-width:760px){
      .v42-recovered-root{padding:4px 6px calc(96px + env(safe-area-inset-bottom))!important;display:block!important}
      .v42-recovered-root .v38-scorebar{position:sticky!important;top:0!important;margin:0 0 5px!important;min-height:64px!important;border-radius:10px!important;padding:6px 8px!important}
      .v42-recovered-root .v38-team strong{font-size:24px!important}.v42-recovered-root .v38-clock{font-size:21px!important}
      .v42-recovered-root .v38-toolbar{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;padding:5px 0!important;background:transparent!important;border:0!important;overflow:visible!important}
      .v42-recovered-root .v38-toolbar>button{min-width:0!important;min-height:38px!important;padding:4px!important;font-size:9px!important}.v42-recovered-root .v38-toolbar .v38-sync{grid-column:1/-1;margin:0!important;text-align:center!important}
      .v42-recovered-root .v38-period-strip{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;padding:4px 0!important;background:transparent!important;border:0!important;overflow:visible!important}.v42-recovered-root .v38-period-strip button{min-width:0!important;min-height:36px!important;padding:3px!important}.v42-recovered-root .v38-period-strip #btn-add-ot,.v42-recovered-root .v38-clock-adjust{display:none!important}
      .v42-recovered-root .v38-player-section,.v42-recovered-root .v38-actions-section,.v42-recovered-root .v38-opponent-section,.v42-recovered-root .v38-feed-section{margin:6px 0!important;padding:7px!important;border-radius:10px!important}
      .v42-recovered-root .v38-player-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important}.v42-recovered-root .v38-player{min-height:50px!important;padding:3px 2px!important}.v42-recovered-root .v38-player strong{font-size:15px!important}.v42-recovered-root .v38-player span{font-size:8px!important}
      .v42-recovered-root .v38-actions-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important}.v42-recovered-root .v38-fast-action{min-height:50px!important;padding:3px 2px!important;border-radius:8px!important}.v42-recovered-root .v38-fast-action strong{font-size:16px!important}.v42-recovered-root .v38-fast-action span{font-size:7px!important;margin-top:2px!important}
      .v42-recovered-root .v38-opponent-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important}.v42-recovered-root .v38-opponent-grid .btn-opp-action{min-height:43px!important;font-size:13px!important}
      .v42-recovered-root .v38-feed-section{display:none!important}
      .hud-modal-content{width:calc(100vw - 16px)!important;max-width:calc(100vw - 16px)!important;box-sizing:border-box!important;max-height:84dvh!important;overflow:auto!important}
      .v42-pbp-row{grid-template-columns:68px minmax(0,1fr) auto;padding:8px 7px;gap:7px}.v42-pbp-delete{padding:5px 7px;font-size:10px}
    }

    @media(max-width:380px){
      .v42-recovered-root .v38-fast-action span{display:none!important}.v42-recovered-root .v38-fast-action{min-height:46px!important}
      .v42-recovered-root .v38-section-title span{font-size:8px!important}
    }

    @media(max-width:1024px) and (orientation:landscape){
      .v42-recovered-root{max-width:100%!important;padding-bottom:32px!important}.v42-recovered-root .v38-player-section{margin-top:4px!important}.v42-recovered-root .v38-actions-grid{grid-template-columns:repeat(7,minmax(0,1fr))!important}.v42-recovered-root .v38-fast-action{min-height:46px!important}.v42-recovered-root .v38-opponent-grid{grid-template-columns:repeat(6,minmax(0,1fr))!important}.v42-recovered-root .v38-opponent-grid .btn-opp-action{min-height:42px!important}
    }
  `;
  document.head.appendChild(style);
}

export default LiveScoreHUDViewV42;
