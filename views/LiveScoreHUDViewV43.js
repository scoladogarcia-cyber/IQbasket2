/**
 * @fileoverview V43 live scorer integrity + explicit attribution UX.
 * @description Keeps the recovered V42 scorer and its court-location flow, but
 * removes ambiguous player preselection. A team action is attributed only after
 * an explicit choice among the five players currently on court. The same PBP is
 * projected into player_game_stats on every secure live sync, so the BoxScore
 * and live scorer share one deterministic source of truth.
 */

import { LiveScoreHUDViewV42Safe } from "./LiveScoreHUDViewV42Safe.js";
import {
  buildPlayerStatBaselines,
  projectLivePlayerStats
} from "../domain/games/LiveCaptureStatsProjector.js";

const TEAM_SHOT_ACTIONS = new Set([
  "fg2_made",
  "fg2_attempted",
  "fg3_made",
  "fg3_attempted"
]);

const PLAYER_PICKER_ACTIONS = new Set([
  "ft_made",
  "ft_attempted",
  "off_reb",
  "def_reb",
  "assists",
  "steals",
  "blocks_made",
  "blocks_received",
  "turnovers",
  "fouls_committed",
  "fouls_drawn"
]);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortName(name = "") {
  const value = String(name || "Jugador").trim();
  return value.split(/\s+/)[0] || "Jugador";
}

export class LiveScoreHUDViewV43 extends LiveScoreHUDViewV42Safe {
  constructor(authController = null, gameId = null) {
    super(authController, gameId);
    this.playerStatBaselines = new Map();
    this.playerStatBaselinesInitialized = false;
    this.pendingPlayerActionKey = null;
    this.lastActionConfirmation = null;
    this.actionConfirmationTimer = null;
  }

  async _loadExistingGameSnapshot() {
    await super._loadExistingGameSnapshot();
    if (this.playerStatBaselinesInitialized) return;

    this.playerStatBaselines = buildPlayerStatBaselines(
      this.gameSnapshot?.stats || [],
      this.playByPlayEvents || []
    );
    this.playerStatBaselinesInitialized = true;
  }

  /**
   * V38 intentionally saved stats:null. V43 projects the current PBP to the
   * exact player_game_stats payload accepted by the authoritative capture RPC.
   */
  _buildLivePayload() {
    const payload = super._buildLivePayload();
    return {
      ...payload,
      stats: projectLivePlayerStats({
        roster: this.roster,
        events: this.playByPlayEvents,
        baselines: this.playerStatBaselines
      })
    };
  }

  /**
   * The five on-court cards are status, not hidden preselection state. This
   * prevents an accidental earlier tap from silently receiving a later stat.
   */
  _togglePlayer() {
    this.fastSelectedPlayerId = null;
    this.fastPendingActionKey = null;
    this._setActionConfirmation("Elige primero la acción; después confirmarás la jugadora.", "hint");
    this._renderHUD();
  }

  /** Every own-team action ends with an explicit active-player confirmation. */
  _chooseAction(actionKey) {
    const key = String(actionKey || "");
    this.fastSelectedPlayerId = null;
    this.fastPendingActionKey = null;

    if (TEAM_SHOT_ACTIONS.has(key)) {
      // V42 opens the court. Because no player is preselected, the existing
      // on-court picker becomes mandatory after choosing the shot location.
      super._chooseAction(key);
      return;
    }

    if (!PLAYER_PICKER_ACTIONS.has(key)) {
      super._chooseAction(key);
      return;
    }

    this.pendingPlayerActionKey = key;
    this.activeModal = "active_player_action";
    this._haptic();
    this._renderHUD();
  }

  _activePlayers() {
    const ids = new Set((this.onCourtPlayerIds || []).map(String));
    return (this.roster || []).filter(player => ids.has(String(player.id))).slice(0, 5);
  }

  _actionPickerMarkup() {
    const actionKey = this.pendingPlayerActionKey;
    const players = this._activePlayers();
    const actionLabel = this._getActionLabelSpanish(actionKey);

    return `
      <div class="hud-modal-overlay v43-player-picker-overlay" role="dialog" aria-modal="true" aria-label="Elegir jugadora activa">
        <div class="hud-modal-content v43-player-picker-modal">
          <div class="v43-picker-heading">
            <div>
              <span>REGISTRAR</span>
              <strong>${escapeHtml(actionLabel)}</strong>
              <small>¿Quién realizó la acción?</small>
            </div>
            <button type="button" class="btn-close-modal" aria-label="Cancelar">✕</button>
          </div>
          <div class="v43-active-player-grid" role="list">
            ${players.map(player => `
              <button type="button" class="v43-active-player" data-v43-player-action-id="${escapeHtml(player.id)}" data-v43-player-name="${escapeHtml(player.name)}" role="listitem">
                <strong>#${escapeHtml(player.jersey)}</strong>
                <span>${escapeHtml(shortName(player.name))}</span>
              </button>
            `).join("")}
          </div>
          ${players.length === 5
            ? '<p class="v43-picker-help">Sólo aparecen las 5 jugadoras que están en pista.</p>'
            : `<p class="v43-picker-help is-warning">Hay ${players.length} jugadoras activas. Revisa el quinteto antes de continuar.</p>`}
        </div>
      </div>`;
  }

  _getModalContent() {
    if (this.activeModal === "active_player_action") {
      return this._actionPickerMarkup();
    }
    return super._getModalContent();
  }

  _setActionConfirmation(text, tone = "success") {
    this.lastActionConfirmation = {
      text: String(text || ""),
      tone,
      at: Date.now()
    };
  }

  _confirmationMarkup() {
    const item = this.lastActionConfirmation;
    if (!item?.text) return "";
    return `<div id="v43-action-confirmation" class="v43-action-confirmation tone-${escapeHtml(item.tone)}" role="status" aria-live="polite">${escapeHtml(item.text)}</div>`;
  }

  _scheduleConfirmationClear() {
    if (this.actionConfirmationTimer) globalThis.clearTimeout?.(this.actionConfirmationTimer);
    if (!this.lastActionConfirmation?.text) return;
    this.actionConfirmationTimer = globalThis.setTimeout?.(() => {
      this.lastActionConfirmation = null;
      const node = this.container?.querySelector?.("#v43-action-confirmation");
      if (node) node.remove();
    }, 1800) || null;
  }

  _renderHUD() {
    super._renderHUD();
    const root = this.container?.querySelector?.(".v38-live-root");
    if (!root) return;
    root.classList.add("v43-live-root");
    root.dataset.v43LiveCapture = "true";

    const teamTitle = root.querySelector(".v38-actions-section .v38-section-title");
    if (teamTitle) {
      teamTitle.innerHTML = "<strong>ACCIONES · MI EQUIPO</strong><span>Acción → confirma jugadora activa</span>";
    }

    const playerTitle = root.querySelector(".v38-player-section .v38-section-title");
    if (playerTitle) {
      playerTitle.innerHTML = "<strong>5 EN PISTA</strong><span>El quinteto activo se usa para atribuir cada acción.</span>";
    }

    root.querySelectorAll(".v38-player").forEach(button => {
      button.classList.add("v43-on-court-status");
      button.setAttribute("aria-label", `${button.textContent?.trim() || "Jugadora"} · en pista`);
      button.title = "Jugadora en pista. Toca una acción para atribuirla.";
    });

    const scorebar = root.querySelector(".v38-scorebar");
    if (scorebar && this.lastActionConfirmation?.text) {
      scorebar.insertAdjacentHTML("afterend", this._confirmationMarkup());
      this._scheduleConfirmationClear();
    }
  }

  _recordPlayerAction(playerId, actionKey) {
    const player = this.roster.find(item => String(item.id) === String(playerId));
    const action = this._getActionLabelSpanish(actionKey);
    this.pendingPlayerActionKey = null;
    this.activeModal = null;
    this._closeModalLayer();
    this._setActionConfirmation(`✓ ${action} · #${player?.jersey || "–"} ${shortName(player?.name)}`);
    super._recordPlayerAction(playerId, actionKey);
  }

  _commitTeamShot(playerId, playerName) {
    const pending = this.pendingAction ? { ...this.pendingAction } : null;
    const player = this.roster.find(item => String(item.id) === String(playerId));
    if (pending) {
      this._setActionConfirmation(
        `✓ ${this._getActionLabelSpanish(pending.actionKey)} · #${player?.jersey || "–"} ${shortName(playerName || player?.name)}`
      );
    }
    super._commitTeamShot(playerId, playerName);
  }

  _commitOpponentShot() {
    const points = Number(this.pendingOpponentShot?.points || 0);
    if (points) this._setActionConfirmation(`✓ Rival +${points} · posición registrada`);
    super._commitOpponentShot();
  }

  _bindModalDynamicEvents() {
    super._bindModalDynamicEvents();
    if (this.activeModal !== "active_player_action") return;

    const portal = document.getElementById("hud-dynamic-modal-portal");
    if (!portal) return;
    portal.querySelectorAll("[data-v43-player-action-id]").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const actionKey = this.pendingPlayerActionKey;
        if (!actionKey) return;
        this._recordPlayerAction(button.dataset.v43PlayerActionId, actionKey);
      };
    });
  }
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v43-live-capture-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v43-live-capture-styles";
  style.textContent = `
    .v43-live-root .v38-player.v43-on-court-status{box-shadow:none!important;background:#f8fafc!important;border-color:#cbd5e1!important;color:#334155!important}
    .v43-action-confirmation{margin:8px 10px 0;padding:9px 12px;border-radius:10px;font-size:12px;font-weight:900;box-shadow:0 4px 12px rgba(15,23,42,.08)}
    .v43-action-confirmation.tone-success{background:#dcfce7;color:#166534;border:1px solid #86efac}
    .v43-action-confirmation.tone-hint{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}
    .v43-player-picker-overlay{align-items:flex-end!important;padding:10px!important}
    .v43-player-picker-modal{width:min(520px,100%)!important;max-width:520px!important;border-radius:18px!important;padding:14px!important;margin:0 auto max(6px,env(safe-area-inset-bottom))!important}
    .v43-picker-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.v43-picker-heading>div{display:flex;flex-direction:column;gap:2px}.v43-picker-heading span{font-size:10px;font-weight:900;letter-spacing:.08em;color:#64748b}.v43-picker-heading strong{font-size:18px;color:#0f172a}.v43-picker-heading small{font-size:12px;color:#64748b}.v43-picker-heading>button{border:0;background:transparent;min-width:40px;min-height:40px;font-size:22px;color:#0f172a}
    .v43-active-player-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.v43-active-player{min-height:82px;border:2px solid #bfdbfe;border-radius:12px;background:#eff6ff;color:#172554;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 3px;font:inherit}.v43-active-player strong{font-size:20px;line-height:1;color:#1e3a8a}.v43-active-player span{font-size:11px;font-weight:850;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v43-active-player:active{transform:scale(.97);background:#dbeafe}
    .v43-picker-help{margin:10px 0 0;text-align:center;color:#64748b;font-size:11px}.v43-picker-help.is-warning{color:#9a3412}
    @media(max-width:430px){.v43-player-picker-modal{padding:12px!important}.v43-active-player-grid{gap:5px}.v43-active-player{min-height:76px}.v43-active-player strong{font-size:18px}.v43-active-player span{font-size:10px}}
  `;
  document.head.appendChild(style);
}

export default LiveScoreHUDViewV43;
