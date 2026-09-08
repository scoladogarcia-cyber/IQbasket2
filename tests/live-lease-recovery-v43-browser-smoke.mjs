import assert from "node:assert/strict";
import { chromium, webkit } from "@playwright/test";

const baseUrl = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173/";
const browserName = process.env.QA_BROWSER || "chromium";
const browserType = browserName === "webkit" ? webkit : chromium;
const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

const result = await page.evaluate(async () => {
  const { LiveWriterLeaseV43Controller } = await import("/features/game-live/LiveWriterLeaseV43Controller.js");
  const gameId = "11111111-1111-4111-8111-111111111111";
  sessionStorage.clear();

  const calls = [];
  const fakeSupabase = {
    async rpc(name, args) {
      calls.push(name);
      if (name === "iq_v28_game_live_session_status") {
        return {
          data: {
            game_id: gameId,
            active: true,
            is_mine: true,
            writer_name: "Tester",
            lease_expires_at: new Date(Date.now() + 60_000).toISOString()
          },
          error: null
        };
      }
      if (name === "iq_v43_recover_own_game_live_session") {
        return {
          data: {
            game_id: gameId,
            active: true,
            is_mine: true,
            recovered: true,
            lease_token: "rotated-v43-browser-token",
            lease_expires_at: new Date(Date.now() + 90_000).toISOString()
          },
          error: null
        };
      }
      if (name === "iq_v28_heartbeat_game_live_session") {
        return {
          data: {
            game_id: gameId,
            active: true,
            is_mine: true,
            lease_expires_at: new Date(Date.now() + 90_000).toISOString()
          },
          error: null
        };
      }
      if (name === "iq_v28_release_game_live_session") {
        return { data: { game_id: gameId, active: false, released: true }, error: null };
      }
      return { data: null, error: { message: `Unexpected RPC ${name}` } };
    }
  };

  const container = document.createElement("div");
  container.innerHTML = `
    <div style="max-width: 1400px">
      <button class="btn-action-direct">+2</button>
      <button id="btn-hud-finish">Finalizar</button>
    </div>`;
  document.body.innerHTML = "";
  document.body.appendChild(container);

  const controller = new LiveWriterLeaseV43Controller(fakeSupabase);
  await controller.syncAfterRender(container, gameId);

  const blockedHasRecover = Boolean(container.querySelector("[data-live-writer-recover-own]"));
  const blockedHasHandoffInput = Boolean(container.querySelector("[data-live-writer-handoff-input]"));
  const actionInitiallyBlocked = container.querySelector(".btn-action-direct")?.disabled === true;

  container.querySelector("[data-live-writer-recover-own]")?.click();
  await new Promise(resolve => setTimeout(resolve, 50));

  const storedToken = sessionStorage.getItem(`iqbasket.gameLiveLease.${gameId}`);
  const ownsAfterRecovery = controller.ownsLease === true;
  const actionEnabledAfterRecovery = container.querySelector(".btn-action-direct")?.disabled === false;

  // Simulate the HUD replacing its own innerHTML after a recorded action.
  container.innerHTML = `
    <div style="max-width: 1400px">
      <button class="btn-action-direct">+3</button>
      <button id="btn-hud-finish">Finalizar</button>
    </div>`;
  controller.container = container;
  controller.restoreAfterHudRender();
  await new Promise(resolve => setTimeout(resolve, 0));

  const panelRestored = Boolean(container.querySelector("[data-live-writer-lease-panel]"));
  const rerenderActionEnabled = container.querySelector(".btn-action-direct")?.disabled === false;
  const recoverCalls = calls.filter(name => name === "iq_v43_recover_own_game_live_session").length;

  controller.destroy();
  return {
    blockedHasRecover,
    blockedHasHandoffInput,
    actionInitiallyBlocked,
    storedToken,
    ownsAfterRecovery,
    actionEnabledAfterRecovery,
    panelRestored,
    rerenderActionEnabled,
    recoverCalls
  };
});

assert.equal(result.blockedHasRecover, true);
assert.equal(result.blockedHasHandoffInput, false);
assert.equal(result.actionInitiallyBlocked, true);
assert.equal(result.storedToken, "rotated-v43-browser-token");
assert.equal(result.ownsAfterRecovery, true);
assert.equal(result.actionEnabledAfterRecovery, true);
assert.equal(result.panelRestored, true);
assert.equal(result.rerenderActionEnabled, true);
assert.equal(result.recoverCalls, 1);

await browser.close();
console.log(`V43 same-user lease recovery browser smoke OK (${browserName})`);
