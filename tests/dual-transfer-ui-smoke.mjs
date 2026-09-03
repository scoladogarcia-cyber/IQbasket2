import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.DUAL_TRANSFER_BASE_URL || "http://127.0.0.1:4173";
const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TEAM_B = "22222222-2222-4222-8222-222222222222";
const TS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SEASON = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const REQUEST_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

async function installFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ TEAM_A, TEAM_B, TS_A, TS_B, SEASON, REQUEST_ID }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const app = window.iqApp;

    const teams = [
      { id: TEAM_A, club_id: "club-1", name: "Equipo A", category: "U15", competition: "Liga" },
      { id: TEAM_B, club_id: "club-2", name: "Equipo B", category: "U15", competition: "Liga" }
    ];

    localStorage.setItem("iq_active_team_id", TEAM_A);
    localStorage.setItem("iq_active_season", "2025/2026");

    app.isAuthenticated = true;
    app.translationsLoaded = true;
    app.teamId = TEAM_A;
    app.permissionService.setCurrentUser({
      id: "afdf727e-8aa4-43b2-8ee4-bfc63a715a51",
      email: "scolado@nechigroup.com",
      role: "SUPERADMIN",
      global_role: "SUPERADMIN",
      assigned_team_ids: [TEAM_A, TEAM_B]
    });

    DataStore.clubs = [
      { id: "club-1", name: "Club A" },
      { id: "club-2", name: "Club B" }
    ];
    DataStore.teams = teams;
    DataStore.players = [{
      id: "10000000-0000-4000-8000-000000000001",
      team_id: TEAM_A,
      first_name: "Víctor",
      last_name: "Activo",
      jersey: 7,
      primary_position: "Base",
      status: "Activo"
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
    DataStore.games = [];
    DataStore.isLoaded = true;
    DataStore.setPermissionService(app.permissionService);
    DataStore.setActiveTeamAndSeason(TEAM_A, "2025/2026");
    DataStore.init = async () => { DataStore.isLoaded = true; };

    const settings = app.views.settings;
    settings.activeTab = "players";
    settings.seasonsList = DataStore.seasons;
    settings.teamDirectory = teams;
    settings.profilesList = [];
    settings.joinRequests = [];
    settings.transferRequestCapabilities = {
      ready: true,
      persistent_requests: true,
      market_directory: true,
      dual_review: true,
      workflow_version: "DUAL_REVIEW_V2"
    };
    settings.marketTransferStartDate = "2026-02-01";
    settings._fetchSeasons = async () => {};
    settings._fetchJoinRequests = async () => { settings.joinRequests = []; };
    settings._refreshTransferRequests = async () => {
      settings.transfers = [];
      return [];
    };
    settings.rosterManagementService.loadForTeam = async () => ({
      capabilities: {
        ready: true,
        supports_seed_exclusion: true,
        supports_multiple_stints: true
      },
      context: {
        id: SEASON,
        global_season_id: SEASON,
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
      referenceDate: "2026-02-01",
      persisted: true,
      memberships: [],
      stints: [],
      activePlayers: DataStore.players,
      seasonParticipants: DataStore.players,
      historicalPlayers: [],
      availablePlayers: []
    });
    settings.transferRequestService.getCapabilities = async () => settings.transferRequestCapabilities;
    settings.transferRequestService.listMarket = async () => [{
      id: "90000000-0000-4000-8000-000000000001",
      playerId: "90000000-0000-4000-8000-000000000001",
      first_name: "Paula",
      last_name: "Mercado",
      playerName: "Paula Mercado",
      jersey: 12,
      primary_position: "Escolta",
      team_id: TEAM_B,
      team_name: "Equipo B",
      from_team_season_id: TS_B,
      global_season_id: SEASON,
      source_stint_from: "2025-09-01",
      pending_to_target: false
    }];

    window.__dualRequestCalls = [];
    settings.transferRequestService.requestTransfer = async args => {
      window.__dualRequestCalls.push(args);
      return { request_id: REQUEST_ID, workflow_version: "DUAL_REVIEW_V2" };
    };

    const approval = app.views.approvals;
    window.__dualReviewCalls = [];
    window.__dualFinalizeCalls = [];
    approval.service.reviewTransfer = async (...args) => {
      window.__dualReviewCalls.push(args);
      return { ok: true };
    };
    approval.service.finalizeTransfer = async item => {
      window.__dualFinalizeCalls.push(item.id);
      return { ok: true };
    };
    approval.service.load = async () => ({
      items: [{
        id: REQUEST_ID,
        type: "TRANSFER",
        status: "PENDING",
        createdAt: "2026-02-01T10:00:00Z",
        playerName: "Paula Mercado",
        title: "Paula Mercado",
        originTeamName: "Equipo B",
        targetTeamName: "Equipo A",
        originTeamId: TEAM_B,
        targetTeamId: TEAM_A,
        fromTeamSeasonId: TS_B,
        toTeamSeasonId: TS_A,
        dualWorkflow: true,
        requestedFirstDateTo: "2026-02-01",
        sourceDecision: "PENDING",
        sourceDate: null,
        destinationDecision: "APPROVED",
        destinationDate: "2026-02-01",
        readyForFinalization: false,
        canSourceReview: true,
        canDestinationReview: false,
        canFinalize: false,
        canApprove: false,
        canReject: false
      }],
      errors: [],
      pendingCount: 1,
      resolvedCount: 0
    });

    document.getElementById("app").innerHTML = '<main id="dashboard-content-area"></main>';
  }, { TEAM_A, TEAM_B, TS_A, TS_B, SEASON, REQUEST_ID });
}

async function checkViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await installFixture(page);

  await page.evaluate(async () => {
    const app = window.iqApp;
    await app.views.settings.render("dashboard-content-area");
  });

  await page.click("#btn-open-market-modal");
  await page.waitForSelector("#market-transfer-start-date", { state: "visible" });

  const marketMetrics = await page.evaluate(() => {
    const modal = document.querySelector("#modal-market-global");
    const card = modal?.querySelector(".iq-modal-card");
    const dateInput = document.querySelector("#market-transfer-start-date");
    const button = document.querySelector(".btn-request-transfer");
    const rect = card?.getBoundingClientRect();
    const buttonRect = button?.getBoundingClientRect();
    return {
      dateVisible: Boolean(dateInput),
      dateValue: dateInput?.value || "",
      cardWithinViewport: Boolean(rect)
        && rect.left >= -1
        && rect.right <= window.innerWidth + 1
        && rect.top >= -1
        && rect.bottom <= window.innerHeight + 1,
      requestTargetHeight: buttonRect?.height || 0,
      globalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });

  if (!marketMetrics.dateVisible || marketMetrics.dateValue !== "2026-02-01") {
    throw new Error(`[${name}] Fecha V4 de mercado no visible: ${JSON.stringify(marketMetrics)}`);
  }
  if (!marketMetrics.cardWithinViewport) {
    throw new Error(`[${name}] Modal de mercado fuera del viewport`);
  }
  if (marketMetrics.globalOverflow) {
    throw new Error(`[${name}] Mercado provoca overflow horizontal`);
  }

  const dialogs = [];
  const dialogHandler = async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  };
  page.on("dialog", dialogHandler);
  await page.click(".btn-request-transfer");
  await page.waitForFunction(() => window.__dualRequestCalls.length === 1);
  page.off("dialog", dialogHandler);

  const requestCall = await page.evaluate(() => window.__dualRequestCalls[0]);
  if (requestCall.firstDateTo !== "2026-02-01"
      || requestCall.toTeamSeasonId !== TS_A
      || requestCall.fromTeamSeasonId !== TS_B) {
    throw new Error(`[${name}] Solicitud V4 incorrecta: ${JSON.stringify(requestCall)}`);
  }
  if (dialogs.some(dialog => dialog.type === "prompt")) {
    throw new Error(`[${name}] Mercado V4 abrió prompt(): ${JSON.stringify(dialogs)}`);
  }

  await page.evaluate(async () => {
    const approval = window.iqApp.views.approvals;
    document.getElementById("dashboard-content-area").innerHTML = "";
    await approval.render("dashboard-content-area");
  });
  await page.waitForSelector(".transfer-approval-card", { state: "visible" });

  const approvalMetrics = await page.evaluate(() => {
    const card = document.querySelector(".transfer-approval-card");
    const date = card?.querySelector('.transfer-review-date[data-side="SOURCE"]');
    const reason = card?.querySelector('.transfer-review-reason[data-side="SOURCE"]');
    const approve = card?.querySelector('.btn-transfer-review[data-side="SOURCE"][data-decision="APPROVED"]');
    const reject = card?.querySelector('.btn-transfer-review[data-side="SOURCE"][data-decision="REJECTED"]');
    const approveRect = approve?.getBoundingClientRect();
    return {
      cardVisible: Boolean(card),
      sourceDate: date?.value || "",
      hasReason: Boolean(reason),
      hasApprove: Boolean(approve),
      hasReject: Boolean(reject),
      approveTargetHeight: approveRect?.height || 0,
      globalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });

  if (!approvalMetrics.cardVisible
      || !approvalMetrics.hasReason
      || !approvalMetrics.hasApprove
      || !approvalMetrics.hasReject) {
    throw new Error(`[${name}] Controles duales incompletos: ${JSON.stringify(approvalMetrics)}`);
  }
  if (approvalMetrics.sourceDate !== "2026-01-31") {
    throw new Error(`[${name}] Fecha origen sugerida incorrecta: ${JSON.stringify(approvalMetrics)}`);
  }
  if (approvalMetrics.approveTargetHeight < 43) {
    throw new Error(`[${name}] Target táctil de aprobación demasiado pequeño`);
  }
  if (approvalMetrics.globalOverflow) {
    throw new Error(`[${name}] Bandeja dual provoca overflow horizontal`);
  }

  await page.fill('.transfer-review-reason[data-side="SOURCE"]', "Salida validada");
  const approvalDialogs = [];
  const approvalDialogHandler = async dialog => {
    approvalDialogs.push(dialog.type());
    await dialog.accept();
  };
  page.on("dialog", approvalDialogHandler);
  await page.click('.btn-transfer-review[data-side="SOURCE"][data-decision="APPROVED"]');
  await page.waitForFunction(() => window.__dualReviewCalls.length === 1);
  page.off("dialog", approvalDialogHandler);

  const reviewCall = await page.evaluate(() => window.__dualReviewCalls[0]);
  if (reviewCall[1] !== "SOURCE"
      || reviewCall[2] !== "APPROVED"
      || reviewCall[3] !== "2026-01-31"
      || reviewCall[4] !== "Salida validada") {
    throw new Error(`[${name}] Revisión inline incorrecta: ${JSON.stringify(reviewCall)}`);
  }
  if (approvalDialogs.includes("prompt")) {
    throw new Error(`[${name}] Revisión dual abrió prompt()`);
  }

  if (pageErrors.length) {
    throw new Error(`[${name}] pageerror: ${pageErrors.join(" | ")}`);
  }

  console.log(JSON.stringify({
    viewport: name,
    marketMetrics,
    approvalMetrics,
    requestCall,
    reviewCall,
    result: "PASS"
  }));

  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await checkViewport(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await checkViewport(browser, "iphone-390x844", { width: 390, height: 844 });
  console.log("DUAL_TRANSFER_UI_SMOKE_OK");
} finally {
  await browser.close();
}
