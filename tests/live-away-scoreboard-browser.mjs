/** Real DOM regression for the existing scorer, without writing to Supabase. */
import assert from "node:assert/strict";
import { chromium, webkit } from "@playwright/test";

const browserName = process.env.QA_BROWSER === "webkit" ? "webkit" : "chromium";
const browser = await ({ chromium, webkit })[browserName].launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async () => {
    const { LiveScoreHUDViewV44 } = await import("/views/LiveScoreHUDViewV44.js");
    document.body.innerHTML = '<main id="dashboard-content-area"></main>';
    const view = new LiveScoreHUDViewV44(null, null);
    view.container = document.querySelector("#dashboard-content-area");
    view.roster = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i + 1}`, name: `Jugador ${i + 1}`, jersey: String(i + 1),
      isConvoked: true, isStarter: true
    }));
    view.onCourtPlayerIds = view.roster.map(player => player.id);
    view.config = { ...view.config, venue: "Visitante", opponent: "CB Coll", periodSeconds: 600 };
    view.periodsList = ["Q1", "Q2", "Q3", "Q4"];
    view.currentPeriod = "Q1";
    view.timeRemaining = 500;
    view.currentStep = 2;
    view._scheduleLiveSync = () => {};
    view._haptic = () => {};
    const own = [2, 2, 2, 3].map((points, i) => ({
      id: `team-${i}`, player_id: "p1", playerId: "p1", playerName: "Jugador 1",
      action: points === 3 ? "fg3_made" : "fg2_made",
      action_type: points === 3 ? "fg3_made" : "fg2_made",
      period: "Q1", isOpponent: false, points, made: true
    }));
    const rival = [2, 2, 3].map((points, i) => ({
      id: `rival-${i}`, player_id: null, playerName: "Rival",
      action: "opp_pts", action_type: "opp_pts", period: "Q1", isOpponent: true, points
    }));
    view.playByPlayEvents = [...own, ...rival];
    view._renderHUD();
    const read = () => ({
      home: view.container.querySelector(".v38-team-home")?.textContent?.trim(),
      away: view.container.querySelector(".v38-team-away")?.textContent?.trim(),
      storedTeam: view.teamScore, storedOpponent: view.opponentScore,
      payloadTeam: view._buildLivePayload().teamScore,
      payloadOpponent: view._buildLivePayload().opponentScore,
      eventCount: view.playByPlayEvents.length
    });
    const away = read();
    view.config.venue = "Local";
    view._renderHUD();
    const home = read();
    view.config.venue = "Visitante";
    view.playByPlayEvents.push({ ...own[0], id: "team-added", points: 2 });
    view._renderHUD();
    const next = read();
    view._renderPostGameActa();
    const finalHeader = view.container.querySelector("h1")?.parentElement?.querySelector("span")?.textContent || "";
    const finalPoints = [...view.container.querySelectorAll("tfoot td")][2]?.textContent?.trim();
    return { away, home, next, finalHeader, finalPoints };
  });

  assert.match(result.away.home, /CB Coll\s*7/i);
  assert.match(result.away.away, /9\s*JMJ Manyanet/i);
  assert.equal(result.away.storedTeam, 9);
  assert.equal(result.away.storedOpponent, 7);
  assert.equal(result.away.payloadTeam, 9);
  assert.equal(result.away.payloadOpponent, 7);
  assert.equal(result.away.eventCount, 7);
  assert.match(result.home.home, /JMJ Manyanet\s*9/i);
  assert.match(result.home.away, /7\s*CB Coll/i);
  assert.match(result.next.home, /CB Coll\s*7/i);
  assert.match(result.next.away, /11\s*JMJ Manyanet/i);
  assert.equal(result.next.payloadTeam, 11);
  assert.equal(result.next.payloadOpponent, 7);
  assert.equal(result.next.eventCount, 8);
  assert.match(result.finalHeader, /CB Coll 7 – 11 Mi equipo/);
  assert.equal(result.finalPoints, "11");
  console.log(`Away scoreboard, recovered PBP, canonical save and final acta: OK (${browserName})`);
} finally {
  await browser.close();
}
