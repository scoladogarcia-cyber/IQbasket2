import { chromium, webkit } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173";
const browserName = String(process.env.QA_BROWSER || "chromium").toLowerCase();
const browserType = browserName === "webkit" ? webkit : chromium;

function ok(value, message) {
  if (!value) throw new Error(message);
}

const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await installBrowserNetworkStubs(page);
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

try {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  const portrait = await page.evaluate(async () => {
    const { LiveScoreHUDViewV42 } = await import("/views/LiveScoreHUDViewV42.js");
    const view = new LiveScoreHUDViewV42(null, null);
    view.container = document.body;
    view.roster = [
      { id: "p1", jersey: "5", name: "Anna Cordero", isConvoked: true, isStarter: true },
      { id: "p2", jersey: "10", name: "Noa Fornells", isConvoked: true, isStarter: true },
      { id: "p3", jersey: "16", name: "June M", isConvoked: true, isStarter: true },
      { id: "p4", jersey: "19", name: "Paula C", isConvoked: true, isStarter: true },
      { id: "p5", jersey: "23", name: "Arlet M", isConvoked: true, isStarter: true }
    ];
    view.onCourtPlayerIds = ["p1", "p2", "p3", "p4", "p5"];
    view.config = { ...view.config, venue: "Local", opponent: "TEST3", periodSeconds: 600 };
    view.periodsList = ["Q1", "Q2", "Q3", "Q4"];
    view.currentPeriod = "Q1";
    view.timeRemaining = 600;
    let syncCalls = 0;
    view._scheduleLiveSync = () => { syncCalls += 1; };
    view._haptic = () => {};
    view._renderHUD();

    const root = document.querySelector(".v42-recovered-root");
    const rootStyle = getComputedStyle(root);
    const actionButtons = [...document.querySelectorAll(".v38-fast-action")];
    const maxActionHeight = Math.max(...actionButtons.map(node => node.getBoundingClientRect().height));
    const hasPaletteTabs = Boolean(document.querySelector("[data-v39-palette]"));

    // Team shot: player -> +2 -> mandatory court -> committed event with coordinates.
    document.querySelector('.v38-player[data-player-id="p2"]')?.click();
    document.querySelector('.v38-fast-action[data-fast-action="fg2_made"]')?.click();
    const teamCourt = document.querySelector("#modal-court-clickarea");
    const teamCourtVisible = Boolean(teamCourt);
    if (teamCourt) {
      const rect = teamCourt.getBoundingClientRect();
      teamCourt.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        clientX: rect.left + rect.width * 0.58,
        clientY: rect.top + rect.height * 0.42
      }));
    }
    const teamShot = view.playByPlayEvents.at(-1);

    // Opponent +3 must also require a court location before recording.
    document.querySelector('.btn-opp-action[data-type="pts"][data-val="3"]')?.click();
    const rivalCourt = document.querySelector("#v42-opponent-court");
    const rivalCourtVisible = Boolean(rivalCourt);
    if (rivalCourt) {
      const rect = rivalCourt.getBoundingClientRect();
      rivalCourt.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        clientX: rect.left + rect.width * 0.44,
        clientY: rect.top + rect.height * 0.36
      }));
    }
    const rivalShot = view.playByPlayEvents.at(-1);

    // Reproduce the reported PBP bug: delete an earlier +2 while a later +3
    // remains. The remaining event's running score must be rewritten from 5-0
    // to 3-0 and the deletion must be synced immediately.
    view.playByPlayEvents = [
      { id: "e1", isOpponent: false, period: "Q1", game_clock: "09:40", timeRemaining: 580, action: "fg2_made", actionLabel: "Canasta de 2", playerName: "Noa", points: 2 },
      { id: "e2", isOpponent: false, period: "Q1", game_clock: "09:10", timeRemaining: 550, action: "fg3_made", actionLabel: "Triple", playerName: "Noa", points: 3 }
    ];
    view._recalculateScoreFromEvents();
    view.activeModal = "play_by_play";
    view._renderHUD();
    document.querySelector('.btn-del-pbp-event[data-id="e1"]')?.click();
    const remaining = view.playByPlayEvents[0];
    const pbpText = document.querySelector(".v42-pbp-list")?.textContent || "";

    return {
      rootPosition: rootStyle.position,
      rootOverflowY: rootStyle.overflowY,
      maxActionHeight,
      hasPaletteTabs,
      teamCourtVisible,
      teamShotPoints: teamShot?.points,
      teamShotPlayer: teamShot?.player_id,
      teamShotHasCoords: Number.isFinite(teamShot?.coord_x) && Number.isFinite(teamShot?.coord_y),
      rivalCourtVisible,
      rivalShotPoints: rivalShot?.points,
      rivalShotOpponent: Boolean(rivalShot?.isOpponent),
      rivalShotHasCoords: Number.isFinite(rivalShot?.coord_x) && Number.isFinite(rivalShot?.coord_y),
      scoreAfterDelete: view.teamScore,
      remainingRunningScore: remaining?.teamScore,
      eventCountAfterDelete: view.playByPlayEvents.length,
      syncCalls,
      pbpShowsThreeZero: pbpText.includes("3–0"),
      bodyScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth
    };
  });

  ok(portrait.rootPosition !== "fixed", "V42 must not lock the scorer to a fixed viewport");
  ok(portrait.rootOverflowY !== "hidden", "V42 must not block vertical reachability");
  ok(portrait.maxActionHeight <= 80, "action buttons became oversized again");
  ok(!portrait.hasPaletteTabs, "Mi equipo/Rival palette tabs returned");
  ok(portrait.teamCourtVisible, "team 2P/3P does not open mandatory court location");
  ok(portrait.teamShotPoints === 2 && portrait.teamShotPlayer === "p2", "team shot was not assigned correctly");
  ok(portrait.teamShotHasCoords, "team shot coordinates were not recorded");
  ok(portrait.rivalCourtVisible, "opponent 2P/3P does not open court location");
  ok(portrait.rivalShotPoints === 3 && portrait.rivalShotOpponent, "opponent shot was not recorded correctly");
  ok(portrait.rivalShotHasCoords, "opponent shot coordinates were not recorded");
  ok(portrait.eventCountAfterDelete === 1, "PBP annul did not remove exactly one event");
  ok(portrait.scoreAfterDelete === 3, "score did not recalculate after PBP annul");
  ok(portrait.remainingRunningScore === 3, "remaining PBP event kept a stale running score");
  ok(portrait.pbpShowsThreeZero, "PBP UI did not refresh the corrected running score");
  ok(portrait.syncCalls >= 3, "shot/delete mutations were not sent through live sync");
  ok(portrait.bodyScrollWidth <= portrait.viewportWidth + 1, "portrait scorer generates horizontal overflow");

  await page.setViewportSize({ width: 844, height: 390 });
  const landscape = await page.evaluate(() => {
    const root = document.querySelector(".v42-recovered-root");
    const actions = document.querySelector(".v38-actions-grid");
    return {
      rootPosition: root ? getComputedStyle(root).position : null,
      columns: actions ? getComputedStyle(actions).gridTemplateColumns.split(" ").filter(Boolean).length : 0,
      bodyScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth
    };
  });

  ok(landscape.rootPosition !== "fixed", "landscape scorer must remain normal document flow");
  ok(landscape.columns >= 7, "landscape action grid is not compact enough");
  ok(landscape.bodyScrollWidth <= landscape.viewportWidth + 1, "landscape scorer generates horizontal overflow");
  ok(pageErrors.length === 0, `pageerror: ${pageErrors.join(" | ")}`);

  console.log(JSON.stringify({ browser: browserName, portrait, landscape, result: "PASS" }));
  console.log("LIVE_SCORER_V42_MOBILE_RECOVERY_OK");
} finally {
  await browser.close();
}
