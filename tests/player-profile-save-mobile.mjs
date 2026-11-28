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
    const { Permission } = await import("/security/PermissionService.js");
    const { PlayerStatsView } = await import("/views/PlayerStatsView.js");
    const player = { id: "player-test", team_id: "team-test", first_name: "Alex", last_name: "Example",
      jersey: 4, height_cm: 176, weight_kg: 88, joined_at: "2026-08-02T14:00:00Z" };
    DataStore.players = [player];
    DataStore.rosterMemberships = [{ id: "membership-test", player_id: player.id, team_season_id: "season-test", jersey: 9, primary_position: "Ala-pívot", status: "ACTIVE" }];
    DataStore.getActiveTeamId = () => player.team_id;
    DataStore.getActiveTeamSeasonId = () => "season-test";
    DataStore.getSeasonParticipantPlayers = () => [DataStore._applyRosterMembership(DataStore.players[0], DataStore.rosterMemberships[0])];
    DataStore._assertPermission = () => {};
    window.profileWrites = [];
    window.rosterWrites = [];
    supabase.rpc = async (name, args) => {
      window.rosterWrites.push({ name, args });
      return { data: { ...DataStore.rosterMemberships[0], primary_position: args.p_primary_position }, error: null };
    };
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
    const auth = {
      canPreview: (permission, scope) => [Permission.EDIT_PLAYER_MASTER, Permission.MANAGE_ROSTER].includes(permission) &&
        scope?.teamSeasonId === "season-test" && scope.playerId === player.id
    };
    const view = new PlayerStatsView(supabase, auth);
    window.addEventListener("hashchange", () => {
      const playerId = location.hash.match(/^#\/player\/(.+)$/)?.[1];
      void view.render(container.id, playerId, player.team_id);
    });
    window.openReadOnlyProfile = () => new PlayerStatsView(supabase, { canPreview: () => false })
      .render(container.id, player.id, player.team_id);
    await view.render(container.id, null, player.team_id);
  });
  await page.locator(".player-card").tap();
  await page.waitForURL("**/#/player/player-test");
  const edit = page.locator("#btn-edit-tab");
  await edit.tap();
  const form = page.locator("#form-edit-player");
  assert.equal(await form.evaluate(node => document.activeElement === node), true);
  await form.locator("h3").first().waitFor({ state: "visible" });
  assert.ok((await form.boundingBox()).y < 150, JSON.stringify(await form.boundingBox()));
  assert.equal(await form.locator('[name="jersey"]').isDisabled(), true);
  await form.locator('[name="weight_kg"]').fill("89");
  await edit.tap();
  assert.equal(await form.locator('[name="weight_kg"]').inputValue(), "89");
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
  const position = form.locator('[name="primary_position"]');
  assert.equal(await position.inputValue(), "Ala-Pívot");
  assert.equal(await page.evaluate(() => window.rosterWrites.length), 0);
  await position.selectOption("Escolta");
  await form.locator(".btn-sec-pos[data-pos='Base']").tap();
  await form.locator('[type="submit"]').tap();
  await form.waitFor({ state: "detached" });
  assert.deepEqual(await page.evaluate(() => window.rosterWrites), [{
    name: "iq_v3_set_roster_member",
    args: { p_team_season_id: "season-test", p_player_id: "player-test", p_status: "ACTIVE",
      p_jersey: 9, p_primary_position: "Escolta", p_effective_date: null }
  }]);
  assert.deepEqual(await page.evaluate(() => window.profileWrites.at(-1).updates), { secondary_positions: ["Base"] });
  await edit.tap();
  assert.equal(await position.inputValue(), "Escolta");
  assert.equal(await form.locator(".btn-sec-pos[data-pos='Base']").evaluate(button => button.classList.contains("active")), true);
  await page.evaluate(() => window.openReadOnlyProfile());
  assert.equal(await edit.count(), 0);
  assert.equal(await page.locator("#btn-edit-tab-disabled").isVisible(), true);
  assert.equal(await form.count(), 0);
  console.log("PASS mobile player profile save, retry and season roster isolation");
} finally {
  await browser.close();
}
