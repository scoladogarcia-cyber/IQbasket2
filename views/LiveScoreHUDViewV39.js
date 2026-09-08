/**
 * @fileoverview V39 one-hand mobile scorer layout.
 * @description Keeps every V38 event, sync and undo handler unchanged, but
 * rearranges the rendered DOM so score, lineup and the active action palette
 * remain reachable without scrolling during normal play.
 */

import { LiveScoreHUDViewV38 } from "./LiveScoreHUDViewV38.js";

export class LiveScoreHUDViewV39 extends LiveScoreHUDViewV38 {
  constructor(authController = null, gameId = null) {
    super(authController, gameId);
    this.v39PaletteMode = "team";
  }

  _renderHUD() {
    super._renderHUD();
    const root = this.container?.querySelector?.(".v38-live-root");
    if (!root) return;
    root.classList.add("v39-live-root");
    root.dataset.v39Scorer = "true";
    this._composeCompactPalette(root);
  }

  _composeCompactPalette(root) {
    const actionSection = root.querySelector(".v38-actions-section");
    const opponentSection = root.querySelector(".v38-opponent-section");
    const opponentGrid = opponentSection?.querySelector?.(".v38-opponent-grid");
    if (!actionSection || !opponentGrid) return;

    const title = actionSection.querySelector(".v38-section-title");
    if (title) {
      title.innerHTML = `
        <div class="v39-palette-tabs" role="tablist" aria-label="Equipo que registra la acción">
          <button type="button" data-v39-palette="team" role="tab">Mi equipo</button>
          <button type="button" data-v39-palette="opponent" role="tab">Rival</button>
        </div>
        <span class="v39-fast-hint">jugadora ↔ acción</span>`;
    }

    opponentGrid.classList.add("v39-opponent-palette");
    actionSection.appendChild(opponentGrid);
    if (opponentSection) opponentSection.remove();

    actionSection.querySelectorAll("[data-v39-palette]").forEach(button => {
      button.addEventListener("click", () => {
        this.v39PaletteMode = button.dataset.v39Palette === "opponent" ? "opponent" : "team";
        this._applyPaletteMode(actionSection);
        this._haptic();
      });
    });
    this._applyPaletteMode(actionSection);
  }

  _applyPaletteMode(actionSection) {
    const teamGrid = actionSection.querySelector(".v38-actions-grid");
    const opponentGrid = actionSection.querySelector(".v39-opponent-palette");
    const opponent = this.v39PaletteMode === "opponent";
    if (teamGrid) teamGrid.hidden = opponent;
    if (opponentGrid) opponentGrid.hidden = !opponent;
    actionSection.querySelectorAll("[data-v39-palette]").forEach(button => {
      const active = (button.dataset.v39Palette === "opponent") === opponent;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v39-scorer-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v39-scorer-styles";
  style.textContent = `
    .v39-live-root{padding-bottom:105px!important;display:grid;gap:8px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .v39-live-root .v38-scorebar{position:sticky;top:0;z-index:8;min-height:72px;padding:8px 10px;border-radius:0 0 14px 14px;box-shadow:0 6px 18px rgba(15,23,42,.18)}
    .v39-live-root .v38-team{gap:4px}.v39-live-root .v38-team span{font-size:10px;max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v39-live-root .v38-team strong{font-size:28px}.v39-live-root .v38-clock-wrap{gap:2px}.v39-live-root .v38-clock{font-size:24px;line-height:1}.v39-live-root .v38-period{font-size:10px}.v39-live-root .v38-clock-main{min-height:30px!important;padding:3px 9px!important;font-size:10px!important}
    .v39-live-root .v38-toolbar{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:0}.v39-live-root .v38-toolbar>button{min-height:42px;padding:5px 4px;font-size:10px;line-height:1.1}.v39-live-root .v38-sync{grid-column:1/-1;text-align:center;min-height:18px;font-size:9px;padding:2px 6px}
    .v39-live-root .v38-period-strip{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:6px;border-radius:10px}.v39-live-root .v38-period-strip button{min-width:0!important;min-height:36px!important;padding:3px!important;font-size:10px!important}.v39-live-root .v38-clock-adjust{display:none!important}
    .v39-live-root .v38-player-section{padding:9px 10px;border-radius:12px}.v39-live-root .v38-section-title{margin-bottom:6px}.v39-live-root .v38-section-title>strong{font-size:11px}.v39-live-root .v38-section-title>span{font-size:9px}.v39-live-root .v38-player-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.v39-live-root .v38-player{min-height:45px!important;padding:5px 7px!important;border-radius:9px!important;gap:5px!important}.v39-live-root .v38-player strong{font-size:15px!important}.v39-live-root .v38-player span{font-size:10px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v39-live-root .v38-actions-section{position:sticky;bottom:calc(76px + env(safe-area-inset-bottom));z-index:9;padding:8px 9px 9px!important;margin:0!important;border-radius:14px 14px 10px 10px!important;box-shadow:0 -8px 28px rgba(15,23,42,.20);background:#fff!important;border:1px solid #cbd5e1!important}.v39-live-root .v38-actions-section .v38-section-title{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px}.v39-palette-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;flex:1}.v39-palette-tabs button{min-height:34px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;color:#475569;font-size:10px;font-weight:900}.v39-palette-tabs button.is-active{background:#0f172a;color:#fff;border-color:#0f172a}.v39-fast-hint{font-size:8px!important;color:#94a3b8!important;white-space:nowrap}
    .v39-live-root .v38-actions-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important}.v39-live-root .v38-fast-action{min-height:46px!important;padding:4px 2px!important;border-radius:8px!important}.v39-live-root .v38-fast-action strong{font-size:14px!important}.v39-live-root .v38-fast-action span{font-size:7px!important;line-height:1.05!important;margin-top:1px!important}.v39-opponent-palette{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}.v39-opponent-palette .btn-opp-action{min-height:52px!important;font-size:15px!important;border-radius:9px!important}
    .v39-live-root .v38-feed-section{padding:9px 10px;border-radius:12px}.v39-live-root .v38-feed-row{padding:5px 0;font-size:9px}.v39-live-root .v38-advanced{font-size:10px}.v39-live-root .v38-finish-row{padding-bottom:10px}.v39-live-root #btn-hud-finish{min-height:46px!important}
    @media(max-width:760px){
      .v39-live-root{padding-bottom:360px!important}
      .v39-live-root .v38-actions-section{position:fixed;left:12px;right:12px;bottom:calc(78px + env(safe-area-inset-bottom));width:auto;max-width:720px;margin:0 auto!important;z-index:40}
    }
    @media(max-width:390px){.v39-live-root .v38-player-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v39-live-root .v38-actions-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}.v39-live-root .v38-fast-action span{display:none}.v39-live-root .v38-fast-action{min-height:42px!important}.v39-live-root .v38-scorebar{padding-left:6px;padding-right:6px}.v39-live-root .v38-team span{max-width:72px}}
  `;
  document.head.appendChild(style);
}

export default LiveScoreHUDViewV39;
