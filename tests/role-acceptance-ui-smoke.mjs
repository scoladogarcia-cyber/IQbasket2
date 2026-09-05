import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.ROLE_ACCEPTANCE_BASE_URL || "http://127.0.0.1:4173";
const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TEAM_B = "22222222-2222-4222-8222-222222222222";
const TS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SEASON = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const roleCases = [
  {
    role: "SUPERADMIN",
    email: "scolado@nechigroup.com",
    canManageClub: true,
    canManageTeams: true,
    canManageRoster: true,
    expectedTeamOptions: 2,
    settingsTabs: ["club", "players", "users", "seasons", "requests", "translations", "simulation"]
  },
  {
    role: "ADMIN",
    email: "admin@example.test",
    canManageClub: true,
    canManageTeams: true,
    canManageRoster: true,
    expectedTeamOptions: 1,
    settingsTabs: ["club", "players", "users", "seasons"]
  },
  {
    role: "ENTRENADOR",
    email: "coach@example.test",
    canManageClub: false,
    canManageTeams: false,
    canManageRoster: true,
    expectedTeamOptions: 1,
    settingsTabs: ["club", "players", "seasons", "requests"]
  },
  {
    role: "INVITADO",
    email: "test@test.com",
    canManageClub: false,
    canManageTeams: false,
    canManageRoster: false,
    expectedTeamOptions: 1,
    settingsTabs: ["club", "players", "seasons", "requests"]
  }
];

async function installFixture(page, spec) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ spec, TEAM_A, TEAM_B, TS_A, SEASON }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { LayoutView } = await import("/views/LayoutView.js");
    const app = window.iqApp;

    app.isAuthenticated = true;
    app.translationsLoaded = true;
    app.teamId = TEAM_A;
    app.currentRoute = "settings";
    app.permissionService.setCurrentUser({
      id: `70000000-0000-4000-8000-${spec.role === "SUPERADMIN" ? "000000000001" : spec.role === "ADMIN" ? "000000000002" : spec.role === "ENTRENADOR" ? "000000000003" : "000000000004"}`,
      email: spec.email,
      role: spec.role,
      global_role: spec.role === "SUPERADMIN" ? "SUPERADMIN" : null,
      club_id: spec.role === "ADMIN" ? "club-a" : null,
      assigned_team_ids: [TEAM_A],
      allowed_team_season_ids: [TS_A]
    });

    DataStore.clubs = [
      { id: "club-a", name: "Club A", phone: "930000001", address: "Dirección A" },
      { id: "club-b", name: "Club B", phone: "930000002", address: "Dirección B" }
    ];
    DataStore.teams = [
      { id: TEAM_A, club_id: "club-a", name: "Equipo A", category: "U15", competition: "Liga", coach_name: "Coach A" },
      { id: TEAM_B, club_id: "club-b", name: "Equipo B", category: "U16", competition: "Liga", coach_name: "Coach B" }
    ];
    DataStore.players = [{
      id: "10000000-0000-4000-8000-000000000001",
      team_id: TEAM_A,
      first_name: "Víctor",
      last_name: "Activo",
      jersey: 7,
      primary_position: "Base",
      status: "Activo",
      rosterActiveNow: true,
      rosterCurrentFrom: "2025-09-01",
      rosterStints: [{ valid_from: "2025-09-01", valid_until: null }]
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
    DataStore.staffAssignments = [];
    DataStore.rosterMemberships = [];
    DataStore.rosterStints = [];
    DataStore.games = [];
    DataStore.playerGameStats = [];
    DataStore.gamePeriodScores = [];
    DataStore.gameEvents = [];
    DataStore.isLoaded = true;
    DataStore.setPermissionService(app.permissionService);
    DataStore.setActiveTeamAndSeason(TEAM_A, "2025/2026");
    DataStore._filterAuthorizedData();

    const view = await app.lazyViews.get("settings");
    view.activeTab = "club";
    view.clubSubView = "list";
    view.seasonsList = DataStore.seasons;
    view.teamDirectory = DataStore.getTeams();
    view.profilesList = [];
    view.joinRequests = [];
    view.transfers = [];
    view.transferRequestCapabilities = {
      ready: true,
      persistent_requests: true,
      market_directory: true,
      dual_review: true
    };
    view._fetchSeasons = async () => {};
    view._fetchJoinRequests = async () => {};
    view._fetchProfiles = async () => {};
    view._fetchTeamDirectory = async () => {
      view.teamDirectory = DataStore.getTeams();
      return view.teamDirectory;
    };
    view._refreshCurrentAuthorizationProfile = async () => {};
    view._refreshTransferRequests = async () => {
      view.transfers = [];
      return [];
    };
    view.transferRequestService.getCapabilities = async () => view.transferRequestCapabilities;
    view.transferRequestService.listMarket = async () => [];
    view.rosterManagementService.loadForTeam = async () => ({
      capabilities: {
        ready: true,
        supports_seed_exclusion: true,
        supports_multiple_stints: true
      },
      context: DataStore.seasons[0],
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

    localStorage.setItem("iq_user_email", spec.email);
    localStorage.setItem("iq_user_role", spec.role);
    localStorage.setItem("iq_active_team_id", TEAM_A);
    localStorage.setItem("iq_active_season", "2025/2026");

    document.getElementById("app").innerHTML = LayoutView.wrap(
      '<div id="dashboard-content-area"></div>',
      "settings",
      spec.role
    );
    LayoutView.bindMobileDrawerEvents();
    await view.render("dashboard-content-area");
  }, { spec, TEAM_A, TEAM_B, TS_A, SEASON });

  await page.waitForTimeout(80);
}

async function inspectRole(browser, spec, viewportName, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await installFixture(page, spec);

  const initial = await page.evaluate(() => {
    const view = window.iqApp.views.settings;
    const tabs = [...document.querySelectorAll(".config-tabs .tab-btn")]
      .map(button => button.getAttribute("data-tab"));
    const teamSelect = document.querySelector("#mobile-select-team") || document.querySelector("#sidebar-select-team");
    const teamOptions = [...(teamSelect?.querySelectorAll("option") || [])]
      .filter(option => !option.disabled)
      .map(option => ({ value: option.value, text: option.textContent.trim() }));
    const clubButton = document.querySelector(".btn-edit-club");
    const teamButton = document.querySelector(".btn-edit-team");
    return {
      activeTab: view.activeTab,
      tabs,
      teamOptions,
      clubAction: clubButton?.textContent.trim() || "",
      teamAction: teamButton?.textContent.trim() || "",
      hasCreateClub: Boolean(document.querySelector("#form-create-club")),
      hasCreateTeam: Boolean(document.querySelector("#form-create-team")),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });

  if (initial.activeTab !== "club") {
    throw new Error(`[${viewportName}][${spec.role}] Configuración expulsó la pestaña Club: ${JSON.stringify(initial)}`);
  }

  for (const tab of spec.settingsTabs) {
    if (!initial.tabs.includes(tab)) {
      throw new Error(`[${viewportName}][${spec.role}] Falta pestaña permitida ${tab}: ${JSON.stringify(initial.tabs)}`);
    }
  }

  for (const forbidden of ["users", "translations", "simulation"]) {
    if (!spec.settingsTabs.includes(forbidden) && initial.tabs.includes(forbidden)) {
      throw new Error(`[${viewportName}][${spec.role}] Se expone pestaña no autorizada ${forbidden}`);
    }
  }

  if (initial.teamOptions.length !== spec.expectedTeamOptions) {
    throw new Error(`[${viewportName}][${spec.role}] Selector expone equipos fuera de alcance: ${JSON.stringify(initial.teamOptions)}`);
  }

  if (initial.overflow) {
    throw new Error(`[${viewportName}][${spec.role}] Overflow horizontal en Configuración`);
  }

  const expectedClubLabel = spec.canManageClub ? "Editar Club" : "Ver Club";
  const expectedTeamLabel = spec.canManageTeams ? "Configurar" : "Ver Equipo";
  if (!initial.clubAction.includes(expectedClubLabel) || !initial.teamAction.includes(expectedTeamLabel)) {
    throw new Error(`[${viewportName}][${spec.role}] Acciones de club/equipo incoherentes: ${JSON.stringify(initial)}`);
  }

  if (initial.hasCreateClub !== (spec.role === "SUPERADMIN")) {
    throw new Error(`[${viewportName}][${spec.role}] Visibilidad Crear Club incorrecta`);
  }
  if (initial.hasCreateTeam !== spec.canManageTeams) {
    throw new Error(`[${viewportName}][${spec.role}] Visibilidad Crear Equipo incorrecta`);
  }

  await page.click(".btn-edit-team");
  await page.waitForSelector("#form-edit-team", { state: "visible" });
  const teamDetail = await page.evaluate(() => {
    const form = document.querySelector("#form-edit-team");
    const editableInputs = [...form.querySelectorAll("input, select")]
      .filter(element => !element.disabled && element.type !== "hidden");
    return {
      editableCount: editableInputs.length,
      hasSave: Boolean(form.querySelector('button[type="submit"]')),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });

  if (spec.canManageTeams) {
    if (!teamDetail.hasSave || teamDetail.editableCount === 0) {
      throw new Error(`[${viewportName}][${spec.role}] Team detail debería ser editable: ${JSON.stringify(teamDetail)}`);
    }
  } else if (teamDetail.hasSave || teamDetail.editableCount !== 0) {
    throw new Error(`[${viewportName}][${spec.role}] Team detail permite edición sin MANAGE_TEAMS: ${JSON.stringify(teamDetail)}`);
  }
  if (teamDetail.overflow) throw new Error(`[${viewportName}][${spec.role}] Overflow en detalle de equipo`);

  await page.click(".btn-back-to-list");
  await page.click(".btn-edit-club");
  await page.waitForSelector("#form-edit-club", { state: "visible" });
  const clubDetail = await page.evaluate(() => {
    const form = document.querySelector("#form-edit-club");
    const editableInputs = [...form.querySelectorAll("input, select")]
      .filter(element => !element.disabled && element.type !== "hidden");
    return {
      editableCount: editableInputs.length,
      hasSave: Boolean(form.querySelector('button[type="submit"]'))
    };
  });

  if (spec.canManageClub) {
    if (!clubDetail.hasSave || clubDetail.editableCount === 0) {
      throw new Error(`[${viewportName}][${spec.role}] Club detail debería ser editable`);
    }
  } else if (clubDetail.hasSave || clubDetail.editableCount !== 0) {
    throw new Error(`[${viewportName}][${spec.role}] Club detail permite edición sin MANAGE_CLUBS: ${JSON.stringify(clubDetail)}`);
  }

  await page.click(".btn-back-to-list");
  await page.click('.tab-btn[data-tab="players"]');
  await page.waitForSelector(".players-grid", { state: "visible" });

  const roster = await page.evaluate(() => ({
    addForm: Boolean(document.querySelector("#form-add-player")),
    editButtons: document.querySelectorAll(".btn-edit-player-modal").length,
    removeButtons: document.querySelectorAll(".btn-remove-player-season").length,
    marketButton: Boolean(document.querySelector("#btn-open-market-modal"))
  }));

  if (spec.canManageRoster) {
    if (!roster.addForm || roster.editButtons === 0 || roster.removeButtons === 0) {
      throw new Error(`[${viewportName}][${spec.role}] Faltan acciones de roster permitidas: ${JSON.stringify(roster)}`);
    }
  } else if (roster.addForm || roster.editButtons > 0 || roster.removeButtons > 0 || roster.marketButton) {
    throw new Error(`[${viewportName}][${spec.role}] INVITADO/read-only expone mutaciones de roster: ${JSON.stringify(roster)}`);
  }

  if (viewport.width <= 390) {
    await page.click("#btn-mobile-more-toggle");
    await page.waitForSelector("#mobile-more-drawer", { state: "visible" });

    // El bottom sheet entra con una transición. Validamos su geometría estable,
    // no un frame intermedio del translateY.
    try {
      await page.waitForFunction(() => {
        const content = document.querySelector("#mobile-more-drawer .mobile-drawer-content");
        if (!content) return false;
        const rect = content.getBoundingClientRect();
        return rect.top >= -1 && rect.bottom <= window.innerHeight + 1;
      }, null, { timeout: 1500 });
    } catch {
      // La comprobación detallada inferior devolverá la geometría diagnóstica.
    }

    const mobile = await page.evaluate(() => {
      const drawer = document.querySelector("#mobile-more-drawer");
      const content = drawer?.querySelector(".mobile-drawer-content");
      const logout = document.querySelector("#btn-mobile-logout");
      const logoutRect = logout?.getBoundingClientRect();
      const contentRect = content?.getBoundingClientRect();
      return {
        logoutVisible: Boolean(logoutRect && logoutRect.width > 0 && logoutRect.height > 0),
        drawerScrollable: Boolean(content && ["auto", "scroll"].includes(getComputedStyle(content).overflowY)),
        drawerWithinViewport: Boolean(
          contentRect
          && contentRect.top >= -1
          && contentRect.bottom <= window.innerHeight + 1
        ),
        geometry: contentRect ? {
          top: contentRect.top,
          bottom: contentRect.bottom,
          height: contentRect.height,
          innerHeight: window.innerHeight,
          cssMaxHeight: getComputedStyle(content).maxHeight,
          cssBottom: getComputedStyle(content).bottom,
          position: getComputedStyle(content).position
        } : null,
        globalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });

    if (!mobile.logoutVisible || !mobile.drawerScrollable || !mobile.drawerWithinViewport || mobile.globalOverflow) {
      throw new Error(`[${viewportName}][${spec.role}] Drawer móvil no cumple aceptación: ${JSON.stringify(mobile)}`);
    }
  }

  if (pageErrors.length) {
    throw new Error(`[${viewportName}][${spec.role}] pageerror: ${pageErrors.join(" | ")}`);
  }

  console.log(JSON.stringify({
    role: spec.role,
    viewport: viewportName,
    teamOptions: initial.teamOptions.length,
    settingsTabs: initial.tabs,
    clubEditable: spec.canManageClub,
    teamEditable: spec.canManageTeams,
    rosterEditable: spec.canManageRoster,
    result: "PASS"
  }));

  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const spec of roleCases) {
    await inspectRole(browser, spec, "desktop-1440x900", { width: 1440, height: 900 });
    await inspectRole(browser, spec, "iphone-390x844", { width: 390, height: 844 });
  }
  console.log("ROLE_ACCEPTANCE_UI_OK");
} finally {
  await browser.close();
}
