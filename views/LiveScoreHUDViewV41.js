/**
 * @fileoverview V41 resilient mobile live scorer viewport.
 * @description Fixes the V40 implicit-grid collision with the asynchronous
 * single-writer lease panel, adds a safe internal scroll fallback and provides
 * a dedicated landscape layout for mobile Safari/Chromium. Sporting event
 * semantics remain fully inherited from V40.
 */

import { LiveScoreHUDViewV40 } from "./LiveScoreHUDViewV40.js";

const LEASE_PANEL_SELECTOR = "[data-live-writer-lease-panel]";

export class LiveScoreHUDViewV41 extends LiveScoreHUDViewV40 {
  constructor(authController = null, gameId = null) {
    super(authController, gameId);
    this.v41LeaseObserver = null;
  }

  _renderHUD() {
    super._renderHUD();
    const root = this.container?.querySelector?.(".v40-scorer-root");
    if (!root) return;

    root.classList.add("v41-scorer-root");
    root.dataset.v41Scorer = "true";
    this._watchWriterLease(root);
  }

  /**
   * The writer lease is attached after the HUD render by the lazy-view
   * decorator. Observe only that presentation boundary so async lease refreshes
   * cannot alter the scorer grid implicitly.
   */
  _watchWriterLease(root) {
    this.v41LeaseObserver?.disconnect?.();

    const syncState = () => this._syncWriterLeaseState(root);
    syncState();

    if (typeof MutationObserver === "undefined") return;
    this.v41LeaseObserver = new MutationObserver(syncState);
    this.v41LeaseObserver.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  _syncWriterLeaseState(root) {
    const panel = root.querySelector(LEASE_PANEL_SELECTOR);
    if (!panel) {
      root.dataset.liveWriterState = "pending";
      return;
    }

    let state = "loading";
    if (panel.querySelector("[data-live-writer-handoff-create]")) state = "owned";
    else if (panel.querySelector("[data-live-writer-handoff-input]")) state = "blocked";
    else if (panel.querySelector("[data-live-writer-resume]")) state = "released";
    else if (panel.querySelector("[role='alert']")) state = "error";
    else {
      const status = String(panel.querySelector("#live-writer-lease-status")?.textContent || "").toLowerCase();
      if (status.includes("compatible")) state = "legacy";
      else if (status.includes("verificando")) state = "loading";
    }

    root.dataset.liveWriterState = state;
    panel.dataset.v41LeaseState = state;
  }
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v41-scorer-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v41-scorer-styles";
  style.textContent = `
    @media(max-width:1024px){
      .v41-scorer-root.v39-live-root{
        position:fixed!important;
        inset:0!important;
        z-index:10000!important;
        width:100vw!important;
        height:100dvh!important;
        min-height:0!important;
        max-width:none!important;
        margin:0!important;
        padding:max(4px,env(safe-area-inset-top)) 8px max(6px,env(safe-area-inset-bottom))!important;
        box-sizing:border-box!important;
        background:#f1f5f9!important;
        display:grid!important;
        grid-template-columns:minmax(0,1fr)!important;
        grid-template-rows:34px 24px 62px 38px 36px 72px minmax(0,1fr)!important;
        grid-template-areas:"top" "lease" "score" "tools" "period" "players" "actions"!important;
        gap:4px!important;
        overflow:hidden!important;
        overscroll-behavior:contain!important;
      }

      .v41-scorer-root>.v40-scorer-topbar{grid-area:top!important;min-height:0!important;margin:0!important;padding:0 2px!important}
      .v41-scorer-root>[data-live-writer-lease-panel]{
        grid-area:lease!important;
        position:static!important;
        min-width:0!important;
        width:auto!important;
        height:24px!important;
        min-height:0!important;
        max-height:24px!important;
        margin:0!important;
        padding:2px 7px!important;
        border-radius:7px!important;
        box-sizing:border-box!important;
        overflow:hidden!important;
        font-size:8.5px!important;
        line-height:18px!important;
      }
      .v41-scorer-root>[data-live-writer-lease-panel] #live-writer-lease-status{
        min-width:0!important;
        margin:0!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        white-space:nowrap!important;
      }
      .v41-scorer-root:not(.v40-more-open)>[data-live-writer-lease-panel] [data-live-writer-handoff-create],
      .v41-scorer-root:not(.v40-more-open)>[data-live-writer-lease-panel] [data-live-writer-release],
      .v41-scorer-root:not(.v40-more-open)>[data-live-writer-lease-panel] [data-live-writer-handoff-output]{display:none!important}
      .v41-scorer-root:not(.v40-more-open)>[data-live-writer-lease-panel]>div{display:block!important;min-width:0!important}

      .v41-scorer-root>.v38-scorebar{grid-area:score!important;position:static!important;min-height:0!important;height:62px!important;margin:0!important;padding:4px 8px!important}
      .v41-scorer-root>.v38-toolbar{grid-area:tools!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
      .v41-scorer-root>.v38-period-strip{grid-area:period!important;min-height:0!important;margin:0!important;padding:2px 3px!important;overflow:hidden!important}
      .v41-scorer-root>.v38-player-section{grid-area:players!important;min-height:0!important;height:auto!important;margin:0!important;padding:4px 6px!important;overflow:hidden!important}
      .v41-scorer-root>.v38-actions-section{
        grid-area:actions!important;
        position:static!important;
        min-height:0!important;
        height:auto!important;
        align-self:stretch!important;
        margin:0!important;
        padding:5px 6px!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        -webkit-overflow-scrolling:touch!important;
        overscroll-behavior:contain!important;
      }
      .v41-scorer-root .v38-actions-section .v38-section-title{min-height:28px!important;margin-bottom:4px!important}
      .v41-scorer-root .v39-palette-tabs button{min-height:28px!important}
      .v41-scorer-root .v38-actions-grid{
        height:calc(100% - 32px)!important;
        min-height:204px!important;
        grid-template-rows:repeat(4,minmax(48px,1fr))!important;
        gap:4px!important;
      }
      .v41-scorer-root .v38-fast-action{min-height:48px!important}
      .v41-scorer-root .v39-opponent-palette{
        height:calc(100% - 32px)!important;
        min-height:112px!important;
        grid-template-rows:repeat(2,minmax(52px,1fr))!important;
      }

      /* Safety states must remain actionable even while sporting controls are disabled. */
      .v41-scorer-root[data-live-writer-state="blocked"]>[data-live-writer-lease-panel],
      .v41-scorer-root[data-live-writer-state="released"]>[data-live-writer-lease-panel],
      .v41-scorer-root[data-live-writer-state="error"]>[data-live-writer-lease-panel]{
        position:fixed!important;
        top:max(42px,calc(env(safe-area-inset-top) + 38px))!important;
        left:8px!important;
        right:8px!important;
        z-index:10004!important;
        width:auto!important;
        height:auto!important;
        max-height:min(52dvh,360px)!important;
        padding:10px 12px!important;
        overflow:auto!important;
        line-height:1.35!important;
        font-size:11px!important;
        box-shadow:0 10px 32px rgba(15,23,42,.24)!important;
      }
      .v41-scorer-root[data-live-writer-state="blocked"]>[data-live-writer-lease-panel] #live-writer-lease-status,
      .v41-scorer-root[data-live-writer-state="released"]>[data-live-writer-lease-panel] #live-writer-lease-status,
      .v41-scorer-root[data-live-writer-state="error"]>[data-live-writer-lease-panel] #live-writer-lease-status{white-space:normal!important;overflow:visible!important}

      /* More mode deliberately restores the complete lease and secondary tools. */
      .v41-scorer-root.v40-more-open.v39-live-root{
        display:block!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        padding-bottom:max(80px,calc(env(safe-area-inset-bottom) + 60px))!important;
      }
      .v41-scorer-root.v40-more-open>[data-live-writer-lease-panel]{
        position:static!important;
        width:auto!important;
        height:auto!important;
        max-height:none!important;
        margin:0 0 7px!important;
        padding:10px 12px!important;
        overflow:visible!important;
        font-size:11px!important;
        line-height:1.4!important;
      }
      .v41-scorer-root.v40-more-open>[data-live-writer-lease-panel] #live-writer-lease-status{white-space:normal!important;overflow:visible!important}
      .v41-scorer-root.v40-more-open>.v38-scorebar,
      .v41-scorer-root.v40-more-open>.v38-toolbar,
      .v41-scorer-root.v40-more-open>.v38-period-strip,
      .v41-scorer-root.v40-more-open>.v38-player-section,
      .v41-scorer-root.v40-more-open>.v38-actions-section{height:auto!important;min-height:0!important;margin-bottom:7px!important}
      .v41-scorer-root.v40-more-open>.v38-actions-section{overflow:visible!important}
      .v41-scorer-root.v40-more-open .v38-actions-grid{height:auto!important;min-height:230px!important}
    }

    @media(max-width:1024px) and (orientation:landscape){
      .v41-scorer-root.v39-live-root{
        grid-template-columns:minmax(300px,42%) minmax(0,1fr)!important;
        grid-template-rows:32px 22px 58px 36px 32px minmax(62px,1fr)!important;
        grid-template-areas:
          "top top"
          "lease lease"
          "score actions"
          "tools actions"
          "period actions"
          "players actions"!important;
        gap:4px 6px!important;
      }
      .v41-scorer-root>.v38-scorebar{height:58px!important;padding:3px 7px!important}
      .v41-scorer-root .v38-team strong{font-size:22px!important}
      .v41-scorer-root .v38-clock{font-size:20px!important}
      .v41-scorer-root>.v38-toolbar>button{min-height:34px!important;font-size:9px!important}
      .v41-scorer-root>.v38-period-strip button{min-height:28px!important}
      .v41-scorer-root>.v38-player-section{padding:3px 5px!important}
      .v41-scorer-root .v38-player-section .v38-section-title{margin-bottom:2px!important}
      .v41-scorer-root .v38-player{min-height:42px!important;height:42px!important;padding:2px!important}
      .v41-scorer-root .v38-player strong{font-size:13px!important}
      .v41-scorer-root .v38-player span{font-size:7px!important}
      .v41-scorer-root>.v38-actions-section{padding:5px!important}
      .v41-scorer-root .v38-actions-grid{min-height:188px!important;grid-template-rows:repeat(4,minmax(44px,1fr))!important}
      .v41-scorer-root .v38-fast-action{min-height:44px!important}
    }

    @media(max-width:1024px) and (max-height:620px) and (orientation:portrait){
      .v41-scorer-root.v39-live-root{grid-template-rows:30px 22px 54px 34px 30px 62px minmax(0,1fr)!important;gap:3px!important}
      .v41-scorer-root>.v38-scorebar{height:54px!important}
      .v41-scorer-root .v38-player{min-height:40px!important;height:40px!important}
      .v41-scorer-root .v38-actions-grid{min-height:184px!important;grid-template-rows:repeat(4,minmax(43px,1fr))!important}
      .v41-scorer-root .v38-fast-action{min-height:43px!important}
    }
  `;
  document.head.appendChild(style);
}

export default LiveScoreHUDViewV41;
