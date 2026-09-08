/**
 * @fileoverview V44 live scorer integrity + explicit active-player attribution.
 * @description Keeps the recovered V42 scorer, V43 lease protection and court
 * location flow while making PBP -> BoxScore projection deterministic. Team
 * actions are attributed only after an explicit choice among the five players
 * currently on court, with an always-visible confirmation after registration.
 */

import { LiveScoreHUDViewV42Safe } from "./LiveScoreHUDViewV42Safe.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
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

function statNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class LiveScoreHUDViewV44 extends LiveScoreHUDViewV42Safe {
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
   * V38 deliberately sent stats:null. V44 projects the same PBP that drives the
   * live scorer into the exact player_game_stats payload accepted by the secure
   * V28/V21 capture boundary. No direct table write is introduced here.
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
   * On-court cards are status, not hidden preselection state. A previous tap can
   * therefore never receive a later rebound, assist, foul or turnover silently.
   */
  _togglePlayer() {
    this.fastSelectedPlayerId = null;
    this.fastPendingActionKey = null;
    this._setActionConfirmation(
      "Elige la acción; después confirmarás una de las 5 jugadoras en pista.",
      "hint"
    );
    this._renderHUD();
  }

  /** Every own-team action ends with an explicit active-player confirmation. */
  _chooseAction(actionKey) {
    const key = String(actionKey || "");
    this.fastSelectedPlayerId = null;
    this.fastPendingActionKey = null;

    if (TEAM_SHOT_ACTIONS.has(key)) {
      // V42 opens the court first. With no hidden preselection, its existing
      // five-player picker becomes a mandatory final attribution step.
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
    return (this.roster || [])
      .filter(player => ids.has(String(player.id)))
      .slice(0, 5);
  }

  _actionPickerMarkup() {
    const actionKey = this.pendingPlayerActionKey;
    const players = this._activePlayers();
    const actionLabel = this._getActionLabelSpanish(actionKey);
    const validFive = players.length === 5;

    return `
      <div class="hud-modal-overlay v44-player-picker-overlay" role="dialog" aria-modal="true" aria-label="Elegir jugadora activa">
        <div class="hud-modal-content v44-player-picker-modal">
          <div class="v44-picker-heading">
            <div>
              <span>REGISTRAR</span>
              <strong>${escapeHtml(actionLabel)}</strong>
              <small>¿Quién realizó la acción?</small>
            </div>
            <button type="button" class="btn-close-modal" aria-label="Cancelar atribución">✕</button>
          </div>
          <div class="v44-active-player-grid" role="group" aria-label="Jugadoras actualmente en pista">
            ${players.map(player => `
              <button type="button"
                class="v44-active-player ${validFive ? "" : "is-disabled"}"
                data-v44-player-action-id="${escapeHtml(player.id)}"
                data-v44-player-name="${escapeHtml(player.name)}"
                aria-label="#${escapeHtml(player.jersey)} ${escapeHtml(player.name)}"
                ${validFive ? "" : "disabled"}>
                <strong>#${escapeHtml(player.jersey)}</strong>
                <span>${escapeHtml(shortName(player.name))}</span>
              </button>
            `).join("")}
          </div>
          ${validFive
            ? '<p class="v44-picker-help">Sólo aparecen las 5 jugadoras que están en pista.</p>'
            : `<p class="v44-picker-help is-warning">Hay ${players.length} jugadoras activas. Corrige el quinteto en “Cambios” antes de registrar la acción.</p>`}
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
    return `<div id="v44-action-confirmation" class="v44-action-confirmation tone-${escapeHtml(item.tone)}" role="status" aria-live="polite">${escapeHtml(item.text)}</div>`;
  }

  _scheduleConfirmationClear() {
    if (this.actionConfirmationTimer) globalThis.clearTimeout?.(this.actionConfirmationTimer);
    if (!this.lastActionConfirmation?.text) return;
    this.actionConfirmationTimer = globalThis.setTimeout?.(() => {
      this.lastActionConfirmation = null;
      const node = this.container?.querySelector?.("#v44-action-confirmation");
      if (node) node.remove();
    }, 1900) || null;
  }

  _renderHUD() {
    super._renderHUD();
    const root = this.container?.querySelector?.(".v38-live-root");
    if (!root) return;
    root.classList.add("v44-live-root");
    root.dataset.v44LiveCapture = "true";

    const teamTitle = root.querySelector(".v38-actions-section .v38-section-title");
    if (teamTitle) {
      teamTitle.innerHTML = "<strong>ACCIONES · MI EQUIPO</strong><span>Acción → confirma jugadora activa</span>";
    }

    const playerTitle = root.querySelector(".v38-player-section .v38-section-title");
    if (playerTitle) {
      playerTitle.innerHTML = "<strong>5 EN PISTA</strong><span>Estas 5 serán las únicas opciones al atribuir una acción.</span>";
    }

    root.querySelectorAll(".v38-player").forEach(button => {
      button.classList.add("v44-on-court-status");
      button.setAttribute("aria-label", `${button.textContent?.trim() || "Jugadora"} · en pista`);
      button.title = "Jugadora en pista. Toca una acción para atribuirla.";
    });

    if (this.lastActionConfirmation?.text) {
      root.insertAdjacentHTML("afterbegin", this._confirmationMarkup());
      this._scheduleConfirmationClear();
    }
  }

  _recordPlayerAction(playerId, actionKey) {
    const player = this.roster.find(item => String(item.id) === String(playerId));
    const action = this._getActionLabelSpanish(actionKey);
    this.pendingPlayerActionKey = null;
    this.activeModal = null;
    this._closeModalLayer();
    this._setActionConfirmation(
      `✓ ${action} · #${player?.jersey || "–"} ${shortName(player?.name)}`
    );
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

  /**
   * Final acta and continuous live sync must use the same projected counters.
   * Minutes remain owned by the acta/minute engine, while statistical counters
   * are replaced by the baseline-aware PBP projection before the save handler is
   * bound. This also protects historical games with partial PBP.
   */
  _applyProjectedStatsToActaMap(playerStatsMap) {
    const projected = projectLivePlayerStats({
      roster: this.roster,
      events: this.playByPlayEvents,
      baselines: this.playerStatBaselines
    });

    for (const row of projected) {
      const st = playerStatsMap.get(String(row.player_id));
      if (!st) continue;
      st.pts = statNumber(row.points);
      st.t2m = statNumber(row.fg2_made);
      st.t2a = statNumber(row.fg2_attempted);
      st.t3m = statNumber(row.fg3_made);
      st.t3a = statNumber(row.fg3_attempted);
      st.ftm = statNumber(row.ft_made);
      st.fta = statNumber(row.ft_attempted);
      st.oreb = statNumber(row.off_reb);
      st.dreb = statNumber(row.def_reb);
      st.reb = st.oreb + st.dreb;
      st.ast = statNumber(row.assists);
      st.stl = statNumber(row.steals);
      st.blk = statNumber(row.blocks_made ?? row.blocks);
      st.tov = statNumber(row.turnovers);
      st.fouls = statNumber(row.fouls_committed);
      st.foulsDrawn = statNumber(row.fouls_drawn);
    }
  }

  _refreshActaProjectionUi(playerStatsMap) {
    let totals = {
      min: 0, pts: 0, t2m: 0, t2a: 0, t3m: 0, t3a: 0,
      ftm: 0, fta: 0, reb: 0, ast: 0, fouls: 0, pir: 0
    };

    this.container?.querySelectorAll?.("tr[data-player-id]").forEach(row => {
      const playerId = String(row.getAttribute("data-player-id") || "");
      const st = playerStatsMap.get(playerId);
      if (!st) return;
      const cells = row.querySelectorAll("td");
      const pir = BoxScoreCalculator.calculatePlayerBoxScore({
        points: st.pts,
        fg2_made: st.t2m,
        fg2_attempted: st.t2a,
        fg3_made: st.t3m,
        fg3_attempted: st.t3a,
        ft_made: st.ftm,
        ft_attempted: st.fta,
        off_reb: st.oreb,
        def_reb: st.dreb,
        assists: st.ast,
        steals: st.stl,
        blocks_made: st.blk,
        turnovers: st.tov,
        fouls_committed: st.fouls,
        fouls_drawn: st.foulsDrawn
      }).pir || 0;

      if (cells[2]) cells[2].textContent = String(st.pts);
      if (cells[3]) cells[3].textContent = `${st.t2m}/${st.t2a}`;
      if (cells[4]) cells[4].textContent = `${st.t3m}/${st.t3a}`;
      if (cells[5]) cells[5].textContent = `${st.ftm}/${st.fta}`;
      if (cells[6]) cells[6].textContent = String(st.reb);
      if (cells[7]) cells[7].textContent = String(st.ast);
      if (cells[8]) cells[8].textContent = String(st.fouls);
      if (cells[9]) cells[9].textContent = String(pir);

      totals.min += statNumber(st.min);
      totals.pts += statNumber(st.pts);
      totals.t2m += statNumber(st.t2m);
      totals.t2a += statNumber(st.t2a);
      totals.t3m += statNumber(st.t3m);
      totals.t3a += statNumber(st.t3a);
      totals.ftm += statNumber(st.ftm);
      totals.fta += statNumber(st.fta);
      totals.reb += statNumber(st.reb);
      totals.ast += statNumber(st.ast);
      totals.fouls += statNumber(st.fouls);
      totals.pir += statNumber(pir);
    });

    const footer = this.container?.querySelector?.("tfoot tr");
    const cells = footer?.querySelectorAll?.("td") || [];
    if (cells[1]) cells[1].textContent = String(totals.min);
    if (cells[2]) cells[2].textContent = String(totals.pts);
    if (cells[3]) cells[3].textContent = `${totals.t2m}/${totals.t2a}`;
    if (cells[4]) cells[4].textContent = `${totals.t3m}/${totals.t3a}`;
    if (cells[5]) cells[5].textContent = `${totals.ftm}/${totals.fta}`;
    if (cells[6]) cells[6].textContent = String(totals.reb);
    if (cells[7]) cells[7].textContent = String(totals.ast);
    if (cells[8]) cells[8].textContent = String(totals.fouls);
    if (cells[9]) cells[9].textContent = String(totals.pir);
  }

  _bindActaEvents(playerStatsMap, expectedSumMinutes, totalGameMinutes) {
    this._applyProjectedStatsToActaMap(playerStatsMap);
    super._bindActaEvents(playerStatsMap, expectedSumMinutes, totalGameMinutes);
    this._refreshActaProjectionUi(playerStatsMap);
  }

  _bindModalDynamicEvents() {
    super._bindModalDynamicEvents();
    if (this.activeModal !== "active_player_action") return;

    const portal = document.getElementById("hud-dynamic-modal-portal");
    if (!portal) return;

    portal.querySelector(".btn-close-modal")?.addEventListener("click", () => {
      this.pendingPlayerActionKey = null;
    });

    portal.querySelectorAll("[data-v44-player-action-id]").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const actionKey = this.pendingPlayerActionKey;
        if (!actionKey || button.disabled) return;
        this._recordPlayerAction(button.dataset.v44PlayerActionId, actionKey);
      };
    });
  }
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v44-live-capture-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v44-live-capture-styles";
  style.textContent = `
    .v44-live-root .v38-player.v44-on-court-status{box-shadow:none!important;background:#f8fafc!important;border-color:#cbd5e1!important;color:#334155!important}
    .v44-action-confirmation{position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:999998;width:min(520px,calc(100vw - 24px));box-sizing:border-box;padding:11px 14px;border-radius:12px;font-size:13px;font-weight:900;text-align:center;box-shadow:0 10px 28px rgba(15,23,42,.22)}
    .v44-action-confirmation.tone-success{background:#dcfce7;color:#166534;border:1px solid #86efac}
    .v44-action-confirmation.tone-hint{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}
    .v44-player-picker-overlay{align-items:flex-end!important;padding:10px!important}
    .v44-player-picker-modal{width:min(520px,100%)!important;max-width:520px!important;border-radius:18px!important;padding:14px!important;margin:0 auto max(6px,env(safe-area-inset-bottom))!important}
    .v44-picker-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.v44-picker-heading>div{display:flex;flex-direction:column;gap:2px}.v44-picker-heading span{font-size:10px;font-weight:900;letter-spacing:.08em;color:#64748b}.v44-picker-heading strong{font-size:18px;color:#0f172a}.v44-picker-heading small{font-size:12px;color:#64748b}.v44-picker-heading>button{border:0;background:transparent;min-width:44px;min-height:44px;font-size:22px;color:#0f172a}
    .v44-active-player-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.v44-active-player{min-height:82px;border:2px solid #bfdbfe;border-radius:12px;background:#eff6ff;color:#172554;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 3px;font:inherit;touch-action:manipulation}.v44-active-player strong{font-size:20px;line-height:1;color:#1e3a8a}.v44-active-player span{font-size:11px;font-weight:850;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v44-active-player:active{transform:scale(.97);background:#dbeafe}.v44-active-player.is-disabled{opacity:.45}
    .v44-picker-help{margin:10px 0 0;text-align:center;color:#64748b;font-size:11px}.v44-picker-help.is-warning{color:#9a3412;font-weight:800}
    @media(min-width:720px){.v44-action-confirmation{bottom:24px}}
    @media(max-width:430px){.v44-player-picker-modal{padding:12px!important}.v44-active-player-grid{gap:5px}.v44-active-player{min-height:76px}.v44-active-player strong{font-size:18px}.v44-active-player span{font-size:10px}.v44-action-confirmation{font-size:12px}}
  `;
  document.head.appendChild(style);
}

export default LiveScoreHUDViewV44;
