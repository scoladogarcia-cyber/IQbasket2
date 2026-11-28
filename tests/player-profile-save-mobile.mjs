import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await installBrowserNetworkStubs(page);
  await page.goto(process.env.PLAYER_PROFILE_BASE_URL || "http://127.0.0.1:4173/");
  await page.evaluate(async () => {
    const { DataStore } = await import("/services/DataStore.js");
    const { supabase } = await import("/config/database.config.js");
    const { PlayerStatsView } = await import("/views/PlayerStatsView.js");
    const player = { id: "player-test", team_id: "team-test", first_name: "Alex", last_name: "Example",
      jersey: 4, height_cm: 176, weight_kg: 88, joined_at: "2026-08-02T14:00:00Z" };
    DataStore.players = [player];
    DataStore.rosterMemberships = [{ id: "membership-test", player_id: player.id, team_season_id: "season-test", jersey: 9 }];
    DataStore.getActiveTeamId = () => player.team_id;
    DataStore.getActiveTeamSeasonId = () => "season-test";
    DataStore.getSeasonParticipantPlayers = () => [DataStore._applyRosterMembership(DataStore.players[0], DataStore.rosterMemberships[0])];
    DataStore._assertPermission = () => {};
    window.profileWrites = [];
    supabase.from = table => ({
      update: updates => ({
        eq: (_field, id) => ({
          select: () => ({
            maybeSingle: async () => {
              window.profileWrites.push({ table, id, updates });
              return { error: null, data: window.profileWrites.length === 1 ? null : { id } };
            }
          })
        })
      })
    });
    const container = document.createElement("div");
    container.id = "profile-test";
    document.body.replaceChildren(container);
    const view = new PlayerStatsView(supabase, { canPreview: () => true });
    view.activeTab = "editar";
    await view.render(container.id, player.id, player.team_id);
  });
  const form = page.locator("#form-edit-player");
  assert.equal(await form.locator('[name="jersey"]').isDisabled(), true);
  await form.locator('[name="weight_kg"]').fill("89");
  await form.locator('[type="submit"]').tap();
  await page.locator("#player-save-error").waitFor({ state: "visible" });
  assert.equal(await form.locator('[name="weight_kg"]').inputValue(), "89");
  await form.locator('[type="submit"]').tap();
  await form.waitFor({ state: "detached" });
  const writes = await page.evaluate(() => window.profileWrites);
  assert.deepEqual(writes, Array.from({ length: 2 }, () => ({
    table: "players", id: "player-test", updates: { weight_kg: 89 }
  })));
  await page.locator("#btn-edit-tab").tap();
  assert.equal(await form.locator('[name="weight_kg"]').inputValue(), "89");
  assert.equal(await form.locator('[name="jersey"]').inputValue(), "9");
  console.log("PASS mobile player profile save, retry and season roster isolation");
} finally {
  await browser.close();
}
