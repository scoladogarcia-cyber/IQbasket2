import { chromium } from "@playwright/test";

const BASE_URL = process.env.PHASE3E_BASE_URL || "http://127.0.0.1:4173";

const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TEAM_B = "22222222-2222-4222-8222-222222222222";
const TEAM_C = "33333333-3333-4333-8333-333333333333";
const TS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TS_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SEASON = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function candidates() {
  return Array.from({ length: 11 }, (_, index) => ({
    id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    playerId: `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    first_name: `Jugador${index + 1}`,
    last_name: index % 2 ? "Equipo B" : "Equipo C",
    playerName: `Jugador${index + 1} ${index % 2 ? "Equipo B" : "Equipo C"}`,
    jersey: index + 1,
    primary_position: index % 2 ? "Base" : "Alero",
    team_id: index % 2 ? TEAM_B : TEAM_C,
    team_name: index % 2 ? "Equipo B" : "Equipo C",
    from_team_season_id: index % 2 ? TS_B : TS_C,
    global_season_id: SEASON,
    source_stint_from: "2025-09-01",
    pending_to_target: false
  }));
}

async function installFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ TEAM_A, TEAM_B, TEAM_C, TS_A, TS_B, TS_C, SEASON, marketRows }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const app = window.iqApp;

    const fakeTeams = [
      { id: TEAM_A, club_id: "club-1", name: "Equipo A", category: "U15", competition: "Liga" },
      { id: TEAM_B, club_id: "club-1", name: "Equipo B", category: "U15", competition: "Liga" },
      { id: TEAM_C, club_id: "club-1", name: "Equipo C", category: "U15", competition: "Liga" }
    ];

    const activePlayers = [
      {
        id: "10000000-0000-4000-8000-000000000001",
        team_id: TEAM_A,
        first_name: "Víctor",
        last_name: "Activo",
        jersey: 7,
        primary_position: "Base",
        status: "Activo",
        rosterCurrentFrom: "2025-09-01",
        rosterActiveNow: true,
        rosterStints: [{ valid_from: "2025-09-01", valid_until: null }]
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        team_id: TEAM_A,
        first_name: "Paula",
        last_name: "Activa",
        jersey: 12,
        primary_position: "Escolta",
        status: "Activo",
        rosterCurrentFrom: "2025-09-01",
        rosterActiveNow: true,
        rosterStints: [{ valid_from: "2025-09-01", valid_until: null }]
      }
    ];

    const historicalPlayers = [
      {
        id: "10000000-0000-4000-8000-000000000003",
        team_id: TEAM_A,
        first_name: "Alex",
        last_name: "Histórico",
        jersey: 9,
        primary_position: "Alero",
        status: "Activo",
        rosterActiveNow: false,
        rosterFirstFrom: "2025-09-01",
        rosterLastUntil: "2026-01-15",
        rosterStints: [{ valid_from: "2025-09-01", valid_until: "2026-01-15" }]
      }
    ];

    const availablePlayers = [
      {
        id: "10000000-0000-4000-8000-000000000004",
        team_id: TEAM_A,
        first_name: "Marc",
        last_name: "Disponible",
        jersey: 15,
        primary_position: "Pívot",
        status: "Activo",
        rosterActiveNow: false,
        rosterStints: []
      }
    ];

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
      assigned_team_ids: [TEAM_A, TEAM_B, TEAM_C]
    });

    DataStore.clubs = [{ id: "club-1", name: "Club Demo" }];
    DataStore.teams = fakeTeams;
    DataStore.players = [...activePlayers, ...historicalPlayers, ...availablePlayers];
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
    DataStore.rosterMemberships = [];
    DataStore.rosterStints = [];
    DataStore.playerGameStats = [];
    DataStore.gameEvents = [];
    DataStore.isLoaded = true;
    DataStore.setPermissionService(app.permissionService);
    DataStore.setActiveTeamAndSeason(TEAM_A, "2025/2026");

    const view = app.views.settings;
    view.activeTab = "players";
    view.seasonsList = DataStore.seasons;
    view.teamDirectory = fakeTeams;
    view.profilesList = [];
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
      view.transferRequestCapabilities = {
        ready: true,
        persistent_requests: true,
        market_directory: true,
        market_profile_scope: "MINIMAL_SEASONAL_V1"
      };
      view.transfers = [];
      return [];
    };
    view.rosterManagementService.loadForTeam = async () => ({
      capabilities: {
        ready: true,
        supports_seed_exclusion: true
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
      activePlayers,
      seasonParticipants: [...activePlayers, ...historicalPlayers],
      historicalPlayers,
      availablePlayers
    });
    window.__phase3eRequestCalls = [];
    window.__phase3eApproveCalls = [];
    window.__phase3eRejectCalls = [];

    view.transferRequestService.listMarket = async () => marketRows;
    view.transferRequestService.getCapabilities = async () => view.transferRequestCapabilities;
    view.transferRequestService.requestTransfer = async (args) => {
      window.__phase3eRequestCalls.push(args);
      return { id: "request-mock" };
    };
    view.transferRequestService.approveTransfer = async (args) => {
      window.__phase3eApproveCalls.push(args);
      return { id: args.requestId, status: "APPROVED" };
    };
    view.transferRequestService.rejectTransfer = async (args) => {
      window.__phase3eRejectCalls.push(args);
      return { id: args.requestId, status: "REJECTED" };
    };
    view.rosterManagementService.getCapabilities = async () => ({
      ready: true,
      supports_seed_exclusion: true,
      supports_multiple_stints: true
    });

    DataStore.init = async () => {
      DataStore.isLoaded = true;
    };

    document.getElementById("app").innerHTML = '<main id="dashboard-content-area"></main>';
    await view.render("dashboard-content-area");
  }, { TEAM_A, TEAM_B, TEAM_C, TS_A, TS_B, TS_C, SEASON, marketRows: candidates() });
}

async function checkViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  const consoleErrors = [];

  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await installFixture(page);

  const core = await page.evaluate(() => {
    const text = document.body.innerText;
    const dateInput = document.querySelector("#add-p-effective-date");
    return {
      hasRoster: text.includes("PLANTILLA 2025/2026"),
      hasHistorical: text.includes("HISTÓRICO DE PLANTILLA"),
      hasMarketButton: Boolean(document.querySelector("#btn-open-market-modal")),
      hasTemporalStatusHelp: document.body.textContent.includes("no cambia la elegibilidad por temporada"),
      minDate: dateInput?.getAttribute("min") || null,
      maxDate: dateInput?.getAttribute("max") || null,
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });

  if (!core.hasRoster) throw new Error(`[${name}] No se renderiza la plantilla 2025/2026`);
  if (!core.hasHistorical) throw new Error(`[${name}] No se renderiza el histórico`);
  if (!core.hasMarketButton) throw new Error(`[${name}] No aparece el botón de mercado`);
  if (!core.hasTemporalStatusHelp) throw new Error(`[${name}] Falta aclaración de elegibilidad temporal`);
  if (core.minDate !== "2025-09-01" || core.maxDate !== "2026-06-30") {
    throw new Error(`[${name}] Límites de fecha incorrectos: ${JSON.stringify(core)}`);
  }
  if (core.documentOverflow) throw new Error(`[${name}] Hay overflow horizontal global antes de abrir el modal`);

  await page.click("#btn-open-market-modal");
  await page.waitForFunction(() => {
    const modal = document.querySelector("#modal-market-global");
    return modal && getComputedStyle(modal).display !== "none";
  });

  const market = await page.evaluate(() => {
    const modal = document.querySelector("#modal-market-global");
    const card = modal?.querySelector(".iq-modal-card");
    const close = document.querySelector("#btn-close-market-modal");
    const rows = [...document.querySelectorAll("#market-modal-table-container tbody tr")];
    const names = rows.map(row => row.innerText);
    const rect = card?.getBoundingClientRect();
    const closeRect = close?.getBoundingClientRect();

    return {
      visible: Boolean(modal && getComputedStyle(modal).display !== "none"),
      candidateRows: rows.length,
      containsOtherTeams: names.some(value => value.includes("Equipo B") || value.includes("Equipo C")),
      containsOwnTeam: names.some(value => value.includes("Equipo A")),
      cardWithinViewport:
        Boolean(rect)
        && rect.left >= -1
        && rect.right <= window.innerWidth + 1
        && rect.top >= -1
        && rect.bottom <= window.innerHeight + 1,
      closeWithinViewport:
        Boolean(closeRect)
        && closeRect.left >= 0
        && closeRect.right <= window.innerWidth
        && closeRect.top >= 0
        && closeRect.bottom <= window.innerHeight,
      cardScrollable: Boolean(card && card.scrollHeight >= card.clientHeight),
      overlayScrollable: Boolean(modal && ["auto", "scroll"].includes(getComputedStyle(modal).overflowY)),
      globalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });

  if (!market.visible) throw new Error(`[${name}] Modal de mercado no visible`);
  if (market.candidateRows !== 10) {
    throw new Error(`[${name}] Se esperaban 10 filas en la primera página, hay ${market.candidateRows}`);
  }
  if (!market.containsOtherTeams || market.containsOwnTeam) {
    throw new Error(`[${name}] El mercado no respeta el alcance de otros equipos: ${JSON.stringify(market)}`);
  }
  if (!market.cardWithinViewport) throw new Error(`[${name}] La tarjeta del modal sale del viewport`);
  if (!market.closeWithinViewport) throw new Error(`[${name}] El botón cerrar queda fuera del viewport`);
  if (!market.overlayScrollable) throw new Error(`[${name}] El overlay no permite scroll vertical`);
  if (market.globalOverflow) throw new Error(`[${name}] El modal provoca overflow horizontal global`);

  await page.fill("#input-market-search", "Jugador11");
  await page.waitForTimeout(100);
  const filtered = await page.locator("#market-modal-table-container tbody tr").allInnerTexts();
  if (filtered.length !== 1 || !filtered[0].includes("Jugador11")) {
    throw new Error(`[${name}] Búsqueda del mercado no filtra correctamente: ${JSON.stringify(filtered)}`);
  }

  await page.fill("#input-market-search", "");
  await page.waitForFunction(() =>
    document.querySelectorAll(".btn-request-transfer").length > 0
  );

  const requestDialogs = [];
  const requestDialogHandler = async dialog => {
    requestDialogs.push(dialog.message());
    await dialog.accept();
  };
  page.on("dialog", requestDialogHandler);
  await page.evaluate(() => {
    document.querySelector(".btn-request-transfer")?.click();
  });
  await page.waitForFunction(() => window.__phase3eRequestCalls.length === 1);
  page.off("dialog", requestDialogHandler);

  const requestCall = await page.evaluate(() => window.__phase3eRequestCalls[0]);
  if (requestCall.fromTeamSeasonId !== TS_C && requestCall.fromTeamSeasonId !== TS_B) {
    throw new Error(`[${name}] Fichar no envía un team-season origen válido: ${JSON.stringify(requestCall)}`);
  }
  if (requestCall.toTeamSeasonId !== TS_A) {
    throw new Error(`[${name}] Fichar no envía el team-season destino activo: ${JSON.stringify(requestCall)}`);
  }

  await page.click("#btn-close-market-modal");
  const closed = await page.evaluate(() => getComputedStyle(document.querySelector("#modal-market-global")).display === "none");
  if (!closed) throw new Error(`[${name}] El modal no se cierra`);

  await page.evaluate(async ({ TEAM_A, TEAM_B, TS_A, TS_B, SEASON }) => {
    const app = window.iqApp;
    const view = app.views.settings;
    view.transfers = [{
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      playerId: "90000000-0000-4000-8000-000000000001",
      playerName: "Jugador1 Equipo C",
      fromTeamSeasonId: TS_B,
      toTeamSeasonId: TS_A,
      originTeamId: TEAM_B,
      targetTeamId: TEAM_A,
      globalSeasonId: SEASON,
      status: "PENDING",
      requestedAt: "2026-02-01T10:00:00Z"
    }];
    view._refreshTransferRequests = async () => view.transfers;
    await view.render("dashboard-content-area");
  }, { TEAM_A, TEAM_B, TS_A, TS_B, SEASON });

  const approveButton = page.locator(".btn-approve-transfer");
  if (await approveButton.count() !== 1) {
    throw new Error(`[${name}] No aparece la acción de aprobación pendiente`);
  }

  let invalidSeasonAlert = false;
  const invalidApproveDialog = async dialog => {
    if (dialog.type() === "prompt" && dialog.message().includes("Último día")) {
      await dialog.accept("2026-06-30");
      return;
    }
    if (dialog.type() === "prompt" && dialog.message().includes("Primer día")) {
      await dialog.accept("2026-07-01");
      return;
    }
    if (dialog.type() === "alert") {
      if (dialog.message().includes("dentro de la temporada")) invalidSeasonAlert = true;
      await dialog.accept();
      return;
    }
    await dialog.accept();
  };
  page.on("dialog", invalidApproveDialog);
  await approveButton.click();
  await page.waitForTimeout(150);
  page.off("dialog", invalidApproveDialog);

  const invalidApproveCalls = await page.evaluate(() => window.__phase3eApproveCalls.length);
  if (invalidApproveCalls !== 0 || !invalidSeasonAlert) {
    throw new Error(`[${name}] La UI no bloquea una aprobación fuera de temporada`);
  }

  const approveDialog = async dialog => {
    if (dialog.type() === "prompt" && dialog.message().includes("Último día")) {
      await dialog.accept("2026-01-31");
      return;
    }
    if (dialog.type() === "prompt" && dialog.message().includes("Primer día")) {
      await dialog.accept("2026-02-01");
      return;
    }
    await dialog.accept();
  };
  page.on("dialog", approveDialog);
  await approveButton.click();
  await page.waitForFunction(() => window.__phase3eApproveCalls.length === 1);
  page.off("dialog", approveDialog);

  const approveCall = await page.evaluate(() => window.__phase3eApproveCalls[0]);
  if (approveCall.requestId !== "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
      || approveCall.lastDateFrom !== "2026-01-31"
      || approveCall.firstDateTo !== "2026-02-01") {
    throw new Error(`[${name}] Aprobación envía parámetros incorrectos: ${JSON.stringify(approveCall)}`);
  }

  await page.evaluate(async ({ TEAM_A, TEAM_B, TS_A, TS_B, SEASON }) => {
    const view = window.iqApp.views.settings;
    view.transfers = [{
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      playerId: "90000000-0000-4000-8000-000000000002",
      playerName: "Jugador2 Equipo B",
      fromTeamSeasonId: TS_B,
      toTeamSeasonId: TS_A,
      originTeamId: TEAM_B,
      targetTeamId: TEAM_A,
      globalSeasonId: SEASON,
      status: "PENDING",
      requestedAt: "2026-02-02T10:00:00Z"
    }];
    view._refreshTransferRequests = async () => view.transfers;
    await view.render("dashboard-content-area");
  }, { TEAM_A, TEAM_B, TS_A, TS_B, SEASON });

  const rejectDialog = async dialog => {
    if (dialog.type() === "prompt") {
      await dialog.accept("Motivo de prueba");
      return;
    }
    await dialog.accept();
  };
  page.on("dialog", rejectDialog);
  await page.click(".btn-reject-transfer");
  await page.waitForFunction(() => window.__phase3eRejectCalls.length === 1);
  page.off("dialog", rejectDialog);

  const rejectCall = await page.evaluate(() => window.__phase3eRejectCalls[0]);
  if (rejectCall.requestId !== "ffffffff-ffff-4fff-8fff-ffffffffffff"
      || rejectCall.reason !== "Motivo de prueba") {
    throw new Error(`[${name}] Rechazo envía parámetros incorrectos: ${JSON.stringify(rejectCall)}`);
  }

  const relevantConsoleErrors = consoleErrors.filter(message =>
    !/favicon|Failed to load resource.*404/i.test(message)
  );
  if (pageErrors.length) throw new Error(`[${name}] pageerror: ${pageErrors.join(" | ")}`);
  if (relevantConsoleErrors.length) throw new Error(`[${name}] console errors: ${relevantConsoleErrors.join(" | ")}`);

  console.log(JSON.stringify({
    viewport: name,
    core,
    market,
    filteredSearchRows: filtered.length,
    requestCall,
    approveCall,
    rejectCall,
    result: "PASS"
  }));

  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await checkViewport(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await checkViewport(browser, "iphone-390x844", { width: 390, height: 844 });
  console.log("PHASE3E_UI_SMOKE_OK");
} finally {
  await browser.close();
}
