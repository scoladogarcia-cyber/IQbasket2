import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.PHASE3E_BASE_URL || "http://127.0.0.1:4173";
const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SEASON = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

async function installLifecycleFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ TEAM_A, TS_A, SEASON }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const app = window.iqApp;

    localStorage.setItem("iq_active_team_id", TEAM_A);
    localStorage.setItem("iq_active_season", "2025/2026");

    app.isAuthenticated = true;
    app.translationsLoaded = true;
    app.teamId = TEAM_A;
    app.currentRoute = "settings";
    app.permissionService.setCurrentUser({
      id: "afdf727e-8aa4-43b2-8ee4-bfc63a715a51",
      email: "scolado@nechigroup.com",
      role: "SUPERADMIN",
      global_role: "SUPERADMIN",
      assigned_team_ids: [TEAM_A]
    });

    DataStore.clubs = [{ id: "club-1", name: "Club Demo" }];
    DataStore.teams = [{
      id: TEAM_A,
      club_id: "club-1",
      name: "Equipo A",
      category: "U15",
      competition: "Liga"
    }];
    DataStore.seasons = [{
      id: SEASON,
      global_season_id: SEASON,
      globalSeasonId: SEASON,
      team_season_id: TS_A,
      teamSeasonId: TS_A,
      team_id: TEAM_A,
      teamId: TEAM_A,
      name: "2025/2026",
      code: "2025_2026",
      start_date: "2025-09-01",
      end_date: "2026-06-30",
      status: "ACTIVE",
      source: "v3"
    }];
    DataStore.legacySeasons = [];
    DataStore.playerGameStats = [];
    DataStore.gameEvents = [];
    DataStore.isLoaded = true;
    DataStore.setPermissionService(app.permissionService);
    DataStore.setActiveTeamAndSeason(TEAM_A, "2025/2026");

    window.__lifecycle = {
      nextId: 100,
      createCalls: [],
      removeCalls: [],
      reactivateCalls: [],
      active: [
        {
          id: "10000000-0000-4000-8000-000000000010",
          team_id: TEAM_A,
          first_name: "Heredado",
          last_name: "SinParticipar",
          jersey: 4,
          primary_position: "Base",
          status: "Activo",
          rosterInherited: true,
          rosterActiveNow: true,
          rosterCurrentFrom: null,
          rosterStints: []
        },
        {
          id: "10000000-0000-4000-8000-000000000011",
          team_id: TEAM_A,
          first_name: "Participante",
          last_name: "Activo",
          jersey: 8,
          primary_position: "Escolta",
          status: "Activo",
          rosterInherited: false,
          rosterActiveNow: true,
          rosterCurrentFrom: "2025-09-01",
          rosterStints: [{ valid_from: "2025-09-01", valid_until: null }]
        }
      ],
      historical: [
        {
          id: "10000000-0000-4000-8000-000000000012",
          team_id: TEAM_A,
          first_name: "Historico",
          last_name: "Reincorporable",
          jersey: 13,
          primary_position: "Alero",
          status: "Activo",
          rosterInherited: false,
          rosterActiveNow: false,
          rosterCurrentFrom: null,
          rosterFirstFrom: "2025-09-01",
          rosterLastUntil: "2026-01-15",
          rosterStints: [{ valid_from: "2025-09-01", valid_until: "2026-01-15" }]
        }
      ],
      available: []
    };

    function allPlayers() {
      return [
        ...window.__lifecycle.active,
        ...window.__lifecycle.historical,
        ...window.__lifecycle.available
      ];
    }

    function snapshot() {
      const state = window.__lifecycle;
      return {
        capabilities: {
          ready: true,
          supports_seed_exclusion: true,
          supports_multiple_stints: true
        },
        context: {
          id: SEASON,
          global_season_id: SEASON,
          globalSeasonId: SEASON,
          team_season_id: TS_A,
          teamSeasonId: TS_A,
          team_id: TEAM_A,
          teamId: TEAM_A,
          name: "2025/2026",
          start_date: "2025-09-01",
          end_date: "2026-06-30",
          status: "ACTIVE",
          source: "v3"
        },
        teamSeasonId: TS_A,
        referenceDate: "2026-06-30",
        persisted: true,
        memberships: [],
        stints: [],
        activePlayers: state.active.map(p => ({ ...p })),
        seasonParticipants: [...state.active, ...state.historical].map(p => ({ ...p })),
        historicalPlayers: state.historical.map(p => ({ ...p })),
        availablePlayers: state.available.map(p => ({ ...p }))
      };
    }

    DataStore.players = allPlayers();
    DataStore.init = async () => {
      DataStore.players = allPlayers();
      DataStore.isLoaded = true;
    };

    const view = await app.lazyViews.get("settings");
    view.activeTab = "players";
    view.seasonsList = DataStore.seasons;
    view.joinRequests = [];
    view.transfers = [];
    view.transferRequestCapabilities = {
      ready: true,
      persistent_requests: true,
      market_directory: true,
      market_profile_scope: "MINIMAL_SEASONAL_V1"
    };

    view._fetchSeasons = async () => {};
    view._fetchJoinRequests = async () => { view.joinRequests = []; };
    view._refreshTransferRequests = async () => {
      view.transfers = [];
      return [];
    };
    view.rosterManagementService.loadForTeam = async () => snapshot();
    view.rosterManagementService.getCapabilities = async () => snapshot().capabilities;

    view.rosterManagementService.createPlayer = async args => {
      const state = window.__lifecycle;
      state.createCalls.push({ ...args });
      const id = `10000000-0000-4000-8000-${String(state.nextId++).padStart(12, "0")}`;
      state.active.push({
        id,
        team_id: TEAM_A,
        first_name: args.firstName,
        last_name: args.lastName,
        jersey: args.jersey,
        primary_position: args.primaryPosition,
        status: "Activo",
        rosterInherited: false,
        rosterActiveNow: true,
        rosterCurrentFrom: args.effectiveDate,
        rosterFirstFrom: args.effectiveDate,
        rosterLastUntil: null,
        rosterStints: [{ valid_from: args.effectiveDate, valid_until: null }]
      });
      return { player_id: id, mode: "CREATED" };
    };

    view.rosterManagementService.removePlayer = async args => {
      const state = window.__lifecycle;
      state.removeCalls.push({ ...args });
      const index = state.active.findIndex(p => String(p.id) === String(args.playerId));
      if (index < 0) throw new Error("TEST_PLAYER_NOT_ACTIVE");

      const [player] = state.active.splice(index, 1);
      if (player.rosterInherited && (!player.rosterStints || player.rosterStints.length === 0)) {
        state.available.push({
          ...player,
          rosterInherited: false,
          rosterActiveNow: false,
          rosterCurrentFrom: null,
          rosterFirstFrom: null,
          rosterLastUntil: null,
          rosterStints: []
        });
        return { mode: "EXCLUDED_FROM_SEASON" };
      }

      const stints = (player.rosterStints || []).map(stint => ({ ...stint }));
      const open = [...stints].reverse().find(stint => !stint.valid_until);
      if (open) open.valid_until = args.lastEligibleDate;

      state.historical.push({
        ...player,
        rosterInherited: false,
        rosterActiveNow: false,
        rosterCurrentFrom: null,
        rosterLastUntil: args.lastEligibleDate,
        rosterStints: stints
      });
      return { mode: "CLOSED_TEMPORAL_STINT" };
    };

    view.rosterManagementService.reactivatePlayer = async args => {
      const state = window.__lifecycle;
      state.reactivateCalls.push({ ...args });

      let source = state.historical;
      let index = source.findIndex(p => String(p.id) === String(args.playerId));
      if (index < 0) {
        source = state.available;
        index = source.findIndex(p => String(p.id) === String(args.playerId));
      }
      if (index < 0) throw new Error("TEST_PLAYER_NOT_REACTIVATABLE");

      const [player] = source.splice(index, 1);
      const stints = (player.rosterStints || []).map(stint => ({ ...stint }));
      stints.push({ valid_from: args.firstEligibleDate, valid_until: null });

      state.active.push({
        ...player,
        rosterInherited: false,
        rosterActiveNow: true,
        rosterCurrentFrom: args.firstEligibleDate,
        rosterLastUntil: null,
        rosterStints: stints
      });
      return { mode: "OPENED_TEMPORAL_STINT" };
    };

    view.transferRequestService.getCapabilities = async () => view.transferRequestCapabilities;
    view.transferRequestService.listMarket = async () => [];

    document.getElementById("app").innerHTML = '<main id="dashboard-content-area"></main>';
    await view.render("dashboard-content-area");
  }, { TEAM_A, TS_A, SEASON });
}

async function acceptAlert(page, action) {
  const handler = async dialog => {
    if (dialog.type() === "alert") await dialog.accept();
    else await dialog.dismiss();
  };
  page.on("dialog", handler);
  try {
    await action();
  } finally {
    page.off("dialog", handler);
  }
}

async function confirmAndPrompt(page, value, action) {
  const messages = [];
  const handler = async dialog => {
    messages.push({ type: dialog.type(), message: dialog.message() });
    if (dialog.type() === "confirm") {
      await dialog.accept();
      return;
    }
    if (dialog.type() === "prompt") {
      await dialog.accept(value);
      return;
    }
    await dialog.accept();
  };
  page.on("dialog", handler);
  try {
    await action();
  } finally {
    page.off("dialog", handler);
  }
  return messages;
}

async function promptThenCaptureAlert(page, value, action) {
  let alertMessage = "";
  const handler = async dialog => {
    if (dialog.type() === "prompt") {
      await dialog.accept(value);
      return;
    }
    if (dialog.type() === "alert") {
      alertMessage = dialog.message();
      await dialog.accept();
      return;
    }
    await dialog.accept();
  };
  page.on("dialog", handler);
  try {
    await action();
    await page.waitForTimeout(100);
  } finally {
    page.off("dialog", handler);
  }
  return alertMessage;
}

async function runLifecycle(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await installLifecycleFixture(page);

  // 1. Initial state.
  const initialText = await page.locator("body").innerText();
  if (!initialText.includes("Heredado SinParticipar")
      || !initialText.includes("Participante Activo")
      || !initialText.includes("Historico Reincorporable")) {
    throw new Error(`[${name}] Estado inicial de plantilla incompleto`);
  }

  // 2. Create player with a concrete effective date.
  await page.fill("#add-p-name", "Nuevo");
  await page.fill("#add-p-lastname", "Temporal");
  await page.fill("#add-p-number", "21");
  await page.selectOption("#add-p-position", "Base");
  await page.fill("#add-p-effective-date", "2026-02-10");

  await acceptAlert(page, async () => {
    await page.locator("#form-add-player").scrollIntoViewIfNeeded();
    await page.locator("#form-add-player").evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => window.__lifecycle.createCalls.length === 1);
  });

  const createCall = await page.evaluate(() => window.__lifecycle.createCalls[0]);
  if (createCall.teamSeasonId !== TS_A
      || createCall.firstName !== "Nuevo"
      || createCall.lastName !== "Temporal"
      || createCall.jersey !== 21
      || createCall.effectiveDate !== "2026-02-10") {
    throw new Error(`[${name}] Alta envía parámetros incorrectos: ${JSON.stringify(createCall)}`);
  }
  if (!(await page.locator("body").innerText()).includes("Nuevo Temporal")) {
    throw new Error(`[${name}] El jugador creado no aparece activo tras rerender`);
  }

  // 3. Exclude inherited player with no participation. It must go to available,
  // not historical.
  const inheritedCard = page.locator(".player-card").filter({ hasText: "Heredado SinParticipar" });
  const inheritedDialogs = await confirmAndPrompt(page, "2025-09-01", async () => {
    await inheritedCard.locator(".btn-remove-player-season").click();
    await page.waitForFunction(() => window.__lifecycle.removeCalls.length === 1);
  });
  if (!inheritedDialogs.some(item => item.type === "confirm")
      || !inheritedDialogs.some(item => item.type === "prompt")) {
    throw new Error(`[${name}] La exclusión heredada no solicita confirmación/fecha`);
  }

  const inheritedState = await page.evaluate(() => ({
    active: window.__lifecycle.active.some(p => p.first_name === "Heredado"),
    historical: window.__lifecycle.historical.some(p => p.first_name === "Heredado"),
    available: window.__lifecycle.available.some(p => p.first_name === "Heredado")
  }));
  if (inheritedState.active || inheritedState.historical || !inheritedState.available) {
    throw new Error(`[${name}] Exclusión heredada crea historial falso: ${JSON.stringify(inheritedState)}`);
  }

  // 4. Close a real participant stint.
  const participantCard = page.locator(".player-card").filter({ hasText: "Participante Activo" });
  await confirmAndPrompt(page, "2026-02-15", async () => {
    await participantCard.locator(".btn-remove-player-season").click();
    await page.waitForFunction(() => window.__lifecycle.removeCalls.length === 2);
  });

  const participantState = await page.evaluate(() => {
    const p = window.__lifecycle.historical.find(item => item.first_name === "Participante");
    return p ? {
      active: window.__lifecycle.active.some(item => item.first_name === "Participante"),
      last: p.rosterLastUntil,
      stints: p.rosterStints
    } : null;
  });
  if (!participantState
      || participantState.active
      || participantState.last !== "2026-02-15"
      || participantState.stints?.[0]?.valid_until !== "2026-02-15") {
    throw new Error(`[${name}] Baja temporal incorrecta: ${JSON.stringify(participantState)}`);
  }

  const bodyAfterRemoval = await page.locator("body").innerText();
  if (!bodyAfterRemoval.includes("2025-09-01 → 2026-02-15")) {
    throw new Error(`[${name}] El histórico no muestra el intervalo cerrado`);
  }

  // 5. Invalid rejoin date is blocked before service call.
  const participantHistoricalCard = page.locator(".player-card").filter({ hasText: "Participante Activo" });
  const beforeInvalidRejoin = await page.evaluate(() => window.__lifecycle.reactivateCalls.length);
  const invalidAlert = await promptThenCaptureAlert(page, "2026-02-15", async () => {
    await participantHistoricalCard.locator(".btn-reactivate-player-season").click();
  });
  const afterInvalidRejoin = await page.evaluate(() => window.__lifecycle.reactivateCalls.length);
  if (afterInvalidRejoin !== beforeInvalidRejoin
      || !invalidAlert.includes("posterior al último periodo cerrado")) {
    throw new Error(`[${name}] Reincorporación solapada no queda bloqueada en UI`);
  }

  // 6. Valid rejoin opens a second stint and returns the player to active roster.
  const rejoinMessages = await confirmAndPrompt(page, "2026-02-20", async () => {
    await participantHistoricalCard.locator(".btn-reactivate-player-season").click();
    await page.waitForFunction(() => window.__lifecycle.reactivateCalls.length === 1);
  });
  // confirmAndPrompt accepts prompt; no confirm is expected in this flow.
  if (!rejoinMessages.some(item => item.type === "prompt")) {
    throw new Error(`[${name}] Reincorporación no solicita primer día elegible`);
  }

  const rejoined = await page.evaluate(() => {
    const p = window.__lifecycle.active.find(item => item.first_name === "Participante");
    return p ? {
      currentFrom: p.rosterCurrentFrom,
      stintCount: p.rosterStints.length,
      firstUntil: p.rosterStints[0]?.valid_until,
      secondFrom: p.rosterStints[1]?.valid_from,
      secondUntil: p.rosterStints[1]?.valid_until
    } : null;
  });
  if (!rejoined
      || rejoined.currentFrom !== "2026-02-20"
      || rejoined.stintCount !== 2
      || rejoined.firstUntil !== "2026-02-15"
      || rejoined.secondFrom !== "2026-02-20"
      || rejoined.secondUntil !== null) {
    throw new Error(`[${name}] Reincorporación no crea segundo periodo correctamente: ${JSON.stringify(rejoined)}`);
  }

  const activeAfterRejoin = await page.locator("body").innerText();
  if (!activeAfterRejoin.includes("Elegible desde 2026-02-20")) {
    throw new Error(`[${name}] La UI no muestra la fecha de la reincorporación`);
  }

  // 7. Re-add the previously excluded inherited player: it becomes a genuine
  // active stint from the chosen date.
  const excludedCard = page.locator(".player-card").filter({ hasText: "Heredado SinParticipar" });
  await confirmAndPrompt(page, "2026-03-01", async () => {
    await excludedCard.locator(".btn-reactivate-player-season").click();
    await page.waitForFunction(() => window.__lifecycle.reactivateCalls.length === 2);
  });

  const restoredInherited = await page.evaluate(() => {
    const p = window.__lifecycle.active.find(item => item.first_name === "Heredado");
    return p ? {
      currentFrom: p.rosterCurrentFrom,
      stintCount: p.rosterStints.length,
      firstFrom: p.rosterStints[0]?.valid_from
    } : null;
  });
  if (!restoredInherited
      || restoredInherited.currentFrom !== "2026-03-01"
      || restoredInherited.stintCount !== 1
      || restoredInherited.firstFrom !== "2026-03-01") {
    throw new Error(`[${name}] Alta posterior de heredado excluido incorrecta: ${JSON.stringify(restoredInherited)}`);
  }

  // 8. Mobile safety: edit modal must stay inside viewport and close button visible.
  const editCard = page.locator(".player-card").filter({ hasText: "Nuevo Temporal" });
  await editCard.locator(".btn-edit-player-modal").click();
  const modalGeometry = await page.evaluate(() => {
    const modal = document.querySelector("#modal-edit-player");
    const card = modal?.querySelector(".iq-modal-card");
    const close = document.querySelector("#btn-close-edit-player-modal");
    const rect = card?.getBoundingClientRect();
    const closeRect = close?.getBoundingClientRect();
    return {
      visible: Boolean(modal && getComputedStyle(modal).display !== "none"),
      cardWithinViewport: Boolean(rect)
        && rect.left >= -1
        && rect.right <= window.innerWidth + 1
        && rect.top >= -1
        && rect.bottom <= window.innerHeight + 1,
      closeWithinViewport: Boolean(closeRect)
        && closeRect.left >= 0
        && closeRect.right <= window.innerWidth
        && closeRect.top >= 0
        && closeRect.bottom <= window.innerHeight,
      overlayScrollable: Boolean(modal && ["auto", "scroll"].includes(getComputedStyle(modal).overflowY))
    };
  });
  if (!modalGeometry.visible
      || !modalGeometry.cardWithinViewport
      || !modalGeometry.closeWithinViewport
      || !modalGeometry.overlayScrollable) {
    throw new Error(`[${name}] Modal de edición no es seguro en viewport: ${JSON.stringify(modalGeometry)}`);
  }
  await page.evaluate(() => {
    document.querySelector("#btn-close-edit-player-modal")?.click();
  });
  await page.waitForFunction(() => {
    const modal = document.querySelector("#modal-edit-player");
    return !modal || getComputedStyle(modal).display === "none";
  });

  if (pageErrors.length) {
    throw new Error(`[${name}] pageerror: ${pageErrors.join(" | ")}`);
  }

  const summary = await page.evaluate(() => ({
    createCalls: window.__lifecycle.createCalls,
    removeCalls: window.__lifecycle.removeCalls,
    reactivateCalls: window.__lifecycle.reactivateCalls,
    active: window.__lifecycle.active.map(p => ({
      name: `${p.first_name} ${p.last_name}`,
      from: p.rosterCurrentFrom,
      stints: p.rosterStints
    })),
    historical: window.__lifecycle.historical.map(p => ({
      name: `${p.first_name} ${p.last_name}`,
      last: p.rosterLastUntil,
      stints: p.rosterStints
    })),
    available: window.__lifecycle.available.map(p => `${p.first_name} ${p.last_name}`)
  }));

  console.log(JSON.stringify({
    viewport: name,
    modalGeometry,
    summary,
    result: "PASS"
  }));

  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runLifecycle(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await runLifecycle(browser, "iphone-390x844", { width: 390, height: 844 });
  console.log("PHASE3E_ROSTER_LIFECYCLE_UI_OK");
} finally {
  await browser.close();
}
