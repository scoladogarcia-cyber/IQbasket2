/**
 * @fileoverview V40 immersive mobile live scorer.
 * @description Converts the V39 fast-capture engine into a true game-day
 * surface: the app chrome is covered, five on-court players remain in one row,
 * the stat pad stays visible, and secondary tools move behind an explicit menu.
 * Event semantics, live sync, writer lease and undo/redo remain inherited.
 */

import { LiveScoreHUDViewV39 } from "./LiveScoreHUDViewV39.js";

const ACTION_ORDER = Object.freeze([
  "fg2_made",
  "fg3_made",
  "ft_made",
  "assists",
  "fg2_attempted",
  "fg3_attempted",
  "ft_attempted",
  "def_reb",
  "off_reb",
  "steals",
  "turnovers",
  "blocks_made",
  "fouls_committed",
  "fouls_drawn"
]);

export class LiveScoreHUDViewV40 extends LiveScoreHUDViewV39 {
  constructor(authController = null, gameId = null) {
    super(authController, gameId);
    this.v40MoreOpen = false;
  }

  _renderHUD() {
    super._renderHUD();
    const root = this.container?.querySelector?.(".v39-live-root");
    if (!root) return;

    root.classList.add("v40-scorer-root");
    root.dataset.v40Scorer = "true";
    this._composeV40Scorer(root);
  }

  _composeV40Scorer(root) {
    const scorebar = root.querySelector(".v38-scorebar");
    if (!scorebar) return;

    const topbar = document.createElement("div");
    topbar.className = "v40-scorer-topbar";
    topbar.innerHTML = `
      <button type="button" id="v40-exit-scorer" aria-label="Volver a partidos">‹ <span>Partidos</span></button>
      <div class="v40-scorer-title">
        <strong>ANOTACIÓN</strong>
        <span>EN DIRECTO</span>
      </div>
      <button type="button" id="v40-more-scorer" aria-label="Más opciones" aria-expanded="${this.v40MoreOpen}">•••</button>
    `;
    scorebar.before(topbar);

    const sync = root.querySelector("#v38-sync-status");
    if (sync) {
      sync.classList.add("v40-sync-chip");
      topbar.querySelector(".v40-scorer-title")?.appendChild(sync);
    }

    const toolbar = root.querySelector(".v38-toolbar");
    const compactButtons = [
      ["#btn-hud-undo", "↶", "Deshacer última jugada"],
      ["#btn-hud-redo", "↷", "Rehacer última jugada"],
      ["#btn-hud-subs", "⇄ Cambios", "Cambios"],
      ["#btn-hud-pbp", `☷ ${this.playByPlayEvents.length}`, "Ver jugadas"]
    ];
    compactButtons.forEach(([selector, label, aria]) => {
      const button = toolbar?.querySelector?.(selector);
      if (!button) return;
      button.textContent = label;
      button.setAttribute("aria-label", aria);
      button.title = aria;
    });

    const playerTitle = root.querySelector(".v38-player-section .v38-section-title strong");
    if (playerTitle) playerTitle.textContent = "5 EN PISTA";

    const actionGrid = root.querySelector(".v38-actions-grid");
    if (actionGrid) {
      const buttons = new Map(
        [...actionGrid.querySelectorAll("[data-fast-action]")]
          .map(button => [button.dataset.fastAction, button])
      );
      ACTION_ORDER.forEach(key => {
        const button = buttons.get(key);
        if (button) actionGrid.appendChild(button);
      });
    }

    const feed = root.querySelector(".v38-feed-section");
    const advanced = root.querySelector(".v38-advanced");
    const finish = root.querySelector(".v38-finish-row");
    [feed, advanced, finish].forEach(node => node?.classList.add("v40-secondary-panel"));
    root.classList.toggle("v40-more-open", this.v40MoreOpen);

    topbar.querySelector("#v40-more-scorer")?.addEventListener("click", event => {
      event.preventDefault();
      this.v40MoreOpen = !this.v40MoreOpen;
      root.classList.toggle("v40-more-open", this.v40MoreOpen);
      event.currentTarget.setAttribute("aria-expanded", String(this.v40MoreOpen));
      this._haptic();
    });

    topbar.querySelector("#v40-exit-scorer")?.addEventListener("click", async event => {
      event.preventDefault();
      this._stopClock();
      if (this.isExistingGame) {
        await this._flushLiveSync().catch(() => {});
      }
      if (typeof window !== "undefined") window.location.hash = "#/partidos";
    });
  }
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v40-scorer-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v40-scorer-styles";
  style.textContent = `
    .v40-scorer-root .v40-scorer-topbar{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .v40-scorer-topbar>button{border:0;background:transparent;color:#0f172a;font-weight:900;min-height:36px;padding:4px 6px}
    .v40-scorer-title{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;flex:1;font-size:10px;letter-spacing:.04em}.v40-scorer-title>strong{font-size:11px}.v40-scorer-title>span{color:#dc2626;font-weight:900}
    .v40-sync-chip{margin:0!important;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px!important;padding:3px 6px!important}
    .v40-scorer-root .v40-secondary-panel{display:none!important}
    .v40-scorer-root.v40-more-open .v40-secondary-panel{display:block!important}

    @media(max-width:900px){
      .v40-scorer-root.v39-live-root{
        position:fixed!important;inset:0!important;z-index:10000!important;width:100vw!important;height:100dvh!important;max-width:none!important;margin:0!important;
        padding:max(4px,env(safe-area-inset-top)) 8px max(6px,env(safe-area-inset-bottom))!important;box-sizing:border-box!important;background:#f1f5f9!important;
        display:grid!important;grid-template-rows:38px 68px 40px 38px 78px minmax(0,1fr)!important;gap:5px!important;overflow:hidden!important;overscroll-behavior:none!important;
      }
      .v40-scorer-root .v40-scorer-topbar{min-height:38px;padding:0 2px}
      .v40-scorer-root .v40-scorer-topbar>button{font-size:11px;min-width:48px}.v40-scorer-root .v40-scorer-topbar>button span{font-size:10px}
      .v40-scorer-root .v38-scorebar{position:static!important;top:auto!important;min-height:68px!important;margin:0!important;padding:6px 8px!important;border-radius:12px!important;box-shadow:0 4px 14px rgba(15,23,42,.16)!important}
      .v40-scorer-root .v38-team{gap:3px!important}.v40-scorer-root .v38-team span{font-size:9px!important;max-width:84px!important}.v40-scorer-root .v38-team strong{font-size:27px!important}
      .v40-scorer-root .v38-clock-wrap{min-width:86px!important}.v40-scorer-root .v38-clock{font-size:23px!important}.v40-scorer-root .v38-period{font-size:9px!important}
      .v40-scorer-root .v38-toolbar{margin:0!important;padding:0!important;background:transparent!important;border:0!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;overflow:visible!important}
      .v40-scorer-root .v38-toolbar>button{min-height:40px!important;padding:3px!important;border-radius:9px!important;font-size:10px!important;background:#fff!important;border:1px solid #cbd5e1!important;color:#334155!important}
      .v40-scorer-root .v38-toolbar .v38-sync{display:none!important}
      .v40-scorer-root .v38-period-strip{margin:0!important;padding:2px 3px!important;border:0!important;border-radius:9px!important;background:#e2e8f0!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;overflow:hidden!important}
      .v40-scorer-root .v38-period-strip button{min-height:34px!important;padding:2px!important;border-radius:7px!important;font-size:10px!important}.v40-scorer-root .v38-period-strip #btn-add-ot{display:none!important}
      .v40-scorer-root .v38-player-section{margin:0!important;padding:5px 6px!important;border-radius:11px!important;box-shadow:none!important;min-height:0!important;overflow:hidden!important}
      .v40-scorer-root .v38-player-section .v38-section-title{margin:0 0 4px!important;min-height:14px!important}.v40-scorer-root .v38-player-section .v38-section-title strong{font-size:9px!important}.v40-scorer-root .v38-player-section .v38-section-title span{font-size:8px!important}
      .v40-scorer-root .v38-player-grid{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important}
      .v40-scorer-root .v38-player{min-width:0!important;min-height:52px!important;height:52px!important;padding:3px 2px!important;border-radius:8px!important;gap:1px!important}
      .v40-scorer-root .v38-player strong{font-size:15px!important}.v40-scorer-root .v38-player span{font-size:8px!important;max-width:100%!important;display:block!important}
      .v40-scorer-root .v38-actions-section{position:static!important;left:auto!important;right:auto!important;bottom:auto!important;width:auto!important;max-width:none!important;margin:0!important;padding:6px!important;border-radius:12px!important;box-shadow:0 4px 14px rgba(15,23,42,.10)!important;min-height:0!important;overflow:hidden!important;align-self:stretch!important}
      .v40-scorer-root .v38-actions-section .v38-section-title{margin-bottom:5px!important;min-height:30px!important}.v40-scorer-root .v39-fast-hint{display:none!important}
      .v40-scorer-root .v39-palette-tabs{gap:4px!important}.v40-scorer-root .v39-palette-tabs button{min-height:30px!important;font-size:9px!important}
      .v40-scorer-root .v38-actions-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-template-rows:repeat(4,minmax(40px,1fr))!important;gap:5px!important;height:calc(100% - 35px)!important;align-content:stretch!important}
      .v40-scorer-root .v38-fast-action{min-height:40px!important;height:auto!important;padding:2px!important;border-radius:8px!important;box-shadow:none!important}.v40-scorer-root .v38-fast-action strong{font-size:16px!important}.v40-scorer-root .v38-fast-action span{display:none!important}
      .v40-scorer-root .v39-opponent-palette{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:repeat(2,minmax(48px,1fr))!important;gap:6px!important;height:calc(100% - 35px)!important;align-content:center!important}.v40-scorer-root .v39-opponent-palette .btn-opp-action{min-height:48px!important;height:auto!important}
      .v40-scorer-root.v40-more-open{overflow-y:auto!important;display:block!important;padding-bottom:80px!important}.v40-scorer-root.v40-more-open>*{margin-bottom:7px!important}.v40-scorer-root.v40-more-open .v38-actions-section{min-height:250px!important}.v40-scorer-root.v40-more-open .v38-feed-section,.v40-scorer-root.v40-more-open .v38-advanced,.v40-scorer-root.v40-more-open .v38-finish-row{margin:7px 0!important}
    }

    @media(max-width:390px){
      .v40-scorer-root .v38-player-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important}
      .v40-scorer-root .v38-player{min-height:50px!important;height:50px!important}
      .v40-scorer-root .v38-player strong{font-size:14px!important}.v40-scorer-root .v38-player span{font-size:7.5px!important}
      .v40-scorer-root .v38-team span{max-width:68px!important;font-size:8px!important}
    }

    @media(max-width:900px) and (max-height:700px){
      .v40-scorer-root.v39-live-root{grid-template-rows:34px 60px 36px 34px 68px minmax(0,1fr)!important;gap:4px!important}
      .v40-scorer-root .v38-scorebar{min-height:60px!important}.v40-scorer-root .v38-team strong{font-size:23px!important}.v40-scorer-root .v38-clock{font-size:20px!important}
      .v40-scorer-root .v38-toolbar>button{min-height:36px!important}.v40-scorer-root .v38-period-strip button{min-height:30px!important}
      .v40-scorer-root .v38-player{min-height:43px!important;height:43px!important}.v40-scorer-root .v38-actions-grid{grid-template-rows:repeat(4,minmax(35px,1fr))!important}.v40-scorer-root .v38-fast-action{min-height:35px!important}
    }
  `;
  document.head.appendChild(style);
}

export default LiveScoreHUDViewV40;
