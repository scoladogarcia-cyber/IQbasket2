import assert from "node:assert/strict";
import { chromium, webkit } from "@playwright/test";

const baseUrl = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173/";
const browserName = process.env.QA_BROWSER || "chromium";
const browserType = browserName === "webkit" ? webkit : chromium;
const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

const result = await page.evaluate(async () => {
  const { LiveScoreHUDViewV44 } = await import("/views/LiveScoreHUDViewV44.js");

  document.body.innerHTML = "";
  const container = document.createElement("main");
  container.id = "dashboard-content-area";
  document.body.appendChild(container);

  const players = Array.from({ length: 6 }, (_, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + 1}`,
    name: `Jugadora ${index + 1}`,
    jersey: String(index + 4),
    isConvoked: true,
    isStarter: index < 5
  }));

  const view = new LiveScoreHUDViewV44(null, null);
  view.container = container;
  view.roster = players;
  view.onCourtPlayerIds = players.slice(0, 5).map(player => player.id);
  view.currentPeriod = "Q1";
  view.timeRemaining = 532;
  view.currentStep = 2;
  view._renderHUD();

  const assistButton = container.querySelector('[data-fast-action="assists"]');
  assistButton?.click();
  await new Promise(resolve => setTimeout(resolve, 0));

  const picker = document.querySelector(".v44-player-picker-modal");
  const activeButtons = [...document.querySelectorAll("[data-v44-player-action-id]")];
  const benchVisible = activeButtons.some(button => button.dataset.v44PlayerActionId === players[5].id);
  const allEnabled = activeButtons.every(button => button.disabled === false);

  activeButtons[2]?.click();
  await new Promise(resolve => setTimeout(resolve, 0));

  const event = view.playByPlayEvents.at(-1) || null;
  const projected = view._buildLivePayload().stats;
  const selectedStats = projected.find(row => row.player_id === players[2].id) || null;
  const toast = document.querySelector("#v44-action-confirmation");
  const toastStyle = toast ? getComputedStyle(toast) : null;
  const feedHasPlayer = container.textContent.includes("Jugadora 3");

  // Repeat with a rebound to prove action-first attribution does not depend on
  // scrolling to or preselecting the on-court cards.
  container.querySelector('[data-fast-action="def_reb"]')?.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  const reboundButtons = [...document.querySelectorAll("[data-v44-player-action-id]")];
  reboundButtons[0]?.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  const reboundStats = view._buildLivePayload().stats.find(row => row.player_id === players[0].id) || null;

  return {
    pickerVisible: Boolean(picker),
    activeCount: activeButtons.length,
    benchVisible,
    allEnabled,
    eventAction: event?.action_type || event?.action || null,
    eventPlayerId: event?.player_id || event?.playerId || null,
    assists: selectedStats?.assists ?? null,
    toastVisible: Boolean(toast),
    toastPosition: toastStyle?.position || null,
    toastText: toast?.textContent || "",
    feedHasPlayer,
    reboundCount: reboundStats?.def_reb ?? null
  };
});

assert.equal(result.pickerVisible, true);
assert.equal(result.activeCount, 5, "El selector debe contener exactamente las cinco jugadoras en pista.");
assert.equal(result.benchVisible, false, "El banquillo no debe aparecer en el selector de atribución.");
assert.equal(result.allEnabled, true);
assert.equal(result.eventAction, "assists");
assert.equal(result.eventPlayerId, "00000000-0000-4000-8000-000000000003");
assert.equal(result.assists, 1, "La asistencia debe formar parte del payload de BoxScore en vivo.");
assert.equal(result.toastVisible, true);
assert.equal(result.toastPosition, "fixed", "La confirmación debe verse aunque el usuario esté desplazado.");
assert.match(result.toastText, /Asistencia/);
assert.equal(result.feedHasPlayer, true);
assert.equal(result.reboundCount, 1, "El rebote también debe proyectarse al BoxScore.");

await browser.close();
console.log(`V44 live BoxScore + active-player attribution browser smoke OK (${browserName})`);
