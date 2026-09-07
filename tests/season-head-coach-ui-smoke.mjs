import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.GLOBAL_UI_QA_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TS_2025 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const TS_2026 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

function assertCondition(condition, viewport, message) {
  if (!condition) throw new Error(`[${viewport}] ${message}`);
}

async function installFixture(page, role = "SUPERADMIN") {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ TEAM_ID, TS_2025, TS_2026, role }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { LayoutView } = await import("/views/LayoutView.js");
    const app = window.iqApp;

    const team = {
      id: TEAM_ID,
      club_id: "club-a",
      clubName: "JMJ Manyanet Sant Andreu",
      name: "JMJ Manyanet Sant Andreu",
      category: "Cadete",
      competition: "Liga",
      coach_name: "Teo Raichman",
      color: "#ea580c"
    };

    const seasons = [
      {
        id: TS_2025,
        global_season_id: TS_2025,
        team_season_id: TS_2025,
        teamSeasonId: TS_2025,
        team_id: TEAM_ID,
        teamId: TEAM_ID,
        name: "2025/2026",
        start_date: "2025-09-01",
        end_date: "2026-06-30",
        status: "ACTIVE",
        source: "v3"
      },
      {
        id: TS_2026,
        global_season_id: TS_2026,
        team_season_id: TS_2026,
        teamSeasonId: TS_2026,
        team_id: TEAM_ID,
        teamId: TEAM_ID,
        name: "2026/2027",
        start_date: "2026-09-01",
        end_date: "2027-06-30",
        status: "ACTIVE",
        source: "v3"
      }
    ];

    const staffAssignments = [
      {
        id: "staff-2025",
        team_season_id: TS_2025,
        team_id: TEAM_ID,
        season_name: "2025/2026",
        staff_role: "HEAD_COACH",
        external_name: "Teo Raichman",
        status: "ACTIVE"
      },
      {
        id: "staff-2026",
        team_season_id: TS_2026,
        team_id: TEAM_ID,
        season_name: "2026/2027",
        staff_role: "HEAD_COACH",
        external_name: "Miriam",
        status: "ACTIVE"
      }
    ];

    app.isAuthenticated = true;
    app.translationsLoaded = true;
    app.teamId = TEAM_ID;
    app.currentRoute = "settings";
    app.permissionService.setCurrentUser({
      id: role === "SUPERADMIN" ? "superadmin-user" : "guest-user",
      email: role === "SUPERADMIN" ? "scolado@nechigroup.com" : "test@test.com",
      role,
      global_role: role === "SUPERADMIN" ? "SUPERADMIN" : "INVITADO",
      assigned_team_ids: [TEAM_ID],
      allowedTeamIds: [TEAM_ID],
      allowed_team_season_ids: [TS_2025, TS_2026],
      allowedTeamSeasonIds: [TS_2025, TS_2026],
      contextualMemberships: [
        {
          team_id: TEAM_ID,
          teamId: TEAM_ID,
          team_season_id: TS_2025,
          teamSeasonId: TS_2025,
          function_role: role,
          role,
          status: "ACTIVE"
        },
        {
          team_id: TEAM_ID,
          teamId: TEAM_ID,
          team_season_id: TS_2026,
          teamSeasonId: TS_2026,
          function_role: role,
          role,
          status: "ACTIVE"
        }
      ]
    });

    DataStore.clubs = [{ id: "club-a", name: "JMJ Manyanet Sant Andreu" }];
    DataStore.teams = [team];
    DataStore.players = [];
    DataStore.seasons = seasons;
    DataStore.legacySeasons = [];
    DataStore.staffAssignments = staffAssignments;
    DataStore.rosterMemberships = [];
    DataStore.rosterStints = [];
    DataStore.games = [];
    DataStore.playerGameStats = [];
    DataStore.gamePeriodScores = [];
    DataStore.gameEvents = [];
    DataStore.isLoaded = true;
    DataStore.setPermissionService(app.permissionService);
    DataStore.setActiveTeamAndSeason(TEAM_ID, "2025/2026");

    localStorage.setItem("iq_user_email", role === "SUPERADMIN" ? "scolado@nechigroup.com" : "test@test.com");
    localStorage.setItem("iq_user_role", role);
    localStorage.setItem("iq_active_team_id", TEAM_ID);
    localStorage.setItem("iq_active_season", "2025/2026");

    document.getElementById("app").innerHTML = LayoutView.wrap(
      '<div id="dashboard-content-area"></div>',
      "settings",
      role
    );
    LayoutView.bindMobileDrawerEvents();

    const view = await app.lazyViews.get("settings");
    view.activeTab = "club";
    view.clubSubView = "edit-team";
    view.selectedTeamForEdit = team;
    view.seasonsList = seasons;
    view.teamDirectory = [team];
    view.profilesList = [];
    view.joinRequests = [];
    view.transfers = [];
    view._fetchSeasons = async () => {};
    view._fetchJoinRequests = async () => {};
    view._fetchProfiles = async () => {};
    view._fetchTeamDirectory = async () => [team];
    view._refreshCurrentAuthorizationProfile = async () => {};
    view._refreshTransferRequests = async () => [];
    view.rosterManagementService.loadForTeam = async () => ({
      capabilities: { ready: true },
      context: seasons[0],
      teamSeasonId: TS_2025,
      referenceDate: "2026-02-01",
      persisted: true,
      memberships: [],
      stints: [],
      activePlayers: [],
      seasonParticipants: [],
      historicalPlayers: [],
      availablePlayers: []
    });

    window.__seasonCoachTest = { view, DataStore, role };
    await view.render("dashboard-content-area");
  }, { TEAM_ID, TS_2025, TS_2026, role });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const input = document.querySelector("#edit-team-coach");
    const label = input?.closest(".form-group")?.querySelector("label")?.textContent || "";
    const form = document.querySelector("#form-edit-team");
    return {
      coach: input?.value || "",
      label: label.trim(),
      disabled: Boolean(input?.disabled),
      hasSave: Boolean(form?.querySelector('button[type="submit"]')),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
}

async function switchSeason(page, seasonName) {
  await page.evaluate(async ({ TEAM_ID, seasonName }) => {
    const state = window.__seasonCoachTest;
    state.DataStore.setActiveTeamAndSeason(TEAM_ID, seasonName);
    localStorage.setItem("iq_active_season", seasonName);
    state.view.clubSubView = "edit-team";
    await state.view.render("dashboard-content-area");
  }, { TEAM_ID, seasonName });
  await page.waitForSelector("#edit-team-coach", { state: "visible" });
}

async function runCase(browser, viewportName, viewport, role) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await installFixture(page, role);
  await page.waitForSelector("#edit-team-coach", { state: "visible" });

  const first = await snapshot(page);
  assertCondition(first.coach === "Teo Raichman", viewportName, `${role}: 2025/2026 muestra entrenador incorrecto: ${JSON.stringify(first)}`);
  assertCondition(first.label.includes("2025/2026"), viewportName, `${role}: etiqueta no identifica 2025/2026`);
  assertCondition(!first.overflow, viewportName, `${role}: overflow en editor de equipo 2025/2026`);

  await switchSeason(page, "2026/2027");
  const second = await snapshot(page);
  assertCondition(second.coach === "Miriam", viewportName, `${role}: 2026/2027 reutiliza entrenador de otra temporada: ${JSON.stringify(second)}`);
  assertCondition(second.label.includes("2026/2027"), viewportName, `${role}: etiqueta no identifica 2026/2027`);
  assertCondition(!second.overflow, viewportName, `${role}: overflow en editor de equipo 2026/2027`);

  if (role === "SUPERADMIN") {
    assertCondition(!second.disabled, viewportName, "SUPERADMIN no puede editar entrenador de la temporada activa");
    assertCondition(second.hasSave, viewportName, "SUPERADMIN no tiene Guardar cambios de equipo");
  } else {
    assertCondition(second.disabled, viewportName, "INVITADO puede editar entrenador por temporada");
    assertCondition(!second.hasSave, viewportName, "INVITADO expone botón de guardado");
  }

  assertCondition(pageErrors.length === 0, viewportName, `${role}: pageerror: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({ viewport: viewportName, role, first, second, result: "PASS" }));
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const [name, viewport] of [
    ["desktop-1440x900", { width: 1440, height: 900 }],
    ["iphone-390x844", { width: 390, height: 844 }]
  ]) {
    await runCase(browser, name, viewport, "SUPERADMIN");
    await runCase(browser, name, viewport, "INVITADO");
  }
  console.log("SEASON_HEAD_COACH_UI_OK");
} finally {
  await browser.close();
}
