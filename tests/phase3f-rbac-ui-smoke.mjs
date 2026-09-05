import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.PHASE3E_BASE_URL || "http://127.0.0.1:4173";
const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TEAM_B = "22222222-2222-4222-8222-222222222222";
const TS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SEASON = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const cases = [
  { role: "SUPERADMIN", manage: true, request: true, approve: true },
  { role: "ADMIN", manage: true, request: true, approve: false },
  { role: "ENTRENADOR", manage: true, request: true, approve: false },
  { role: "ANALISTA", manage: false, request: false, approve: false },
  { role: "VISOR", manage: false, request: false, approve: false },
  { role: "JUGADOR", manage: false, request: false, approve: false }
];

async function renderRole(page, spec) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ spec, TEAM_A, TEAM_B, TS_A, TS_B, SEASON }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const app = window.iqApp;

    app.isAuthenticated = true;
    app.translationsLoaded = true;
    app.teamId = TEAM_A;
    app.currentRoute = "settings";
    app.permissionService.setCurrentUser({
      id: "70000000-0000-4000-8000-000000000001",
      email: spec.role === "SUPERADMIN"
        ? "scolado@nechigroup.com"
        : `${spec.role.toLowerCase()}@example.test`,
      role: spec.role,
      global_role: spec.role === "SUPERADMIN" ? "SUPERADMIN" : null,
      assigned_team_ids: [TEAM_A],
      allowed_team_season_ids: [TS_A]
    });

    DataStore.clubs = [{ id: "club-1", name: "Club Demo" }];
    DataStore.teams = [
      { id: TEAM_A, club_id: "club-1", name: "Equipo A", category: "U15" },
      { id: TEAM_B, club_id: "club-1", name: "Equipo B", category: "U15" }
    ];
    DataStore.players = [{
      id: "10000000-0000-4000-8000-000000000001",
      team_id: TEAM_A,
      first_name: "Jugador",
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
    DataStore.isLoaded = true;
    DataStore.setPermissionService(app.permissionService);
    DataStore.setActiveTeamAndSeason(TEAM_A, "2025/2026");

    const view = await app.lazyViews.get("settings");
    view.activeTab = "players";
    view.seasonsList = DataStore.seasons;
    view.joinRequests = [];
    view.transferRequestCapabilities = {
      ready: true,
      persistent_requests: true,
      market_directory: true,
      market_profile_scope: "MINIMAL_SEASONAL_V1"
    };
    view.transfers = [{
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      playerId: "90000000-0000-4000-8000-000000000001",
      playerName: "Candidato Externo",
      fromTeamSeasonId: TS_B,
      toTeamSeasonId: TS_A,
      originTeamId: TEAM_B,
      targetTeamId: TEAM_A,
      globalSeasonId: SEASON,
      status: "PENDING",
      requestedAt: "2026-02-01T10:00:00Z"
    }];

    view._fetchSeasons = async () => {};
    view._fetchJoinRequests = async () => {};
    view._refreshTransferRequests = async () => view.transfers;
    view.rosterManagementService.loadForTeam = async () => ({
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
      activePlayers: DataStore.players,
      seasonParticipants: DataStore.players,
      historicalPlayers: [],
      availablePlayers: [],
      memberships: [],
      stints: []
    });
    view.transferRequestService.getCapabilities = async () => view.transferRequestCapabilities;
    view.transferRequestService.listMarket = async () => [{
      id: "90000000-0000-4000-8000-000000000001",
      playerId: "90000000-0000-4000-8000-000000000001",
      first_name: "Candidato",
      last_name: "Externo",
      playerName: "Candidato Externo",
      jersey: 10,
      primary_position: "Alero",
      team_id: TEAM_B,
      team_name: "Equipo B",
      from_team_season_id: TS_B,
      global_season_id: SEASON,
      source_stint_from: "2025-09-01",
      pending_to_target: false
    }];

    document.getElementById("app").innerHTML = '<main id="dashboard-content-area"></main>';
    await view.render("dashboard-content-area");
  }, { spec, TEAM_A, TEAM_B, TS_A, TS_B, SEASON });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const spec of cases) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installBrowserNetworkStubs(page);
    await renderRole(page, spec);

    const state = await page.evaluate(() => ({
      addForm: Boolean(document.querySelector("#form-add-player")),
      removeButtons: document.querySelectorAll(".btn-remove-player-season").length,
      marketButton: Boolean(document.querySelector("#btn-open-market-modal")),
      approveButtons: document.querySelectorAll(".btn-approve-transfer").length,
      rejectButtons: document.querySelectorAll(".btn-reject-transfer").length
    }));

    const actual = {
      manage: state.addForm && state.removeButtons > 0,
      request: state.marketButton,
      approve: state.approveButtons > 0 && state.rejectButtons > 0
    };

    if (actual.manage !== spec.manage
        || actual.request !== spec.request
        || actual.approve !== spec.approve) {
      throw new Error(`RBAC UI mismatch ${spec.role}: expected=${JSON.stringify(spec)} actual=${JSON.stringify(actual)} state=${JSON.stringify(state)}`);
    }

    console.log(JSON.stringify({
      role: spec.role,
      manageRosterVisible: actual.manage,
      requestTransferVisible: actual.request,
      approveTransferVisible: actual.approve,
      result: "PASS"
    }));

    await page.close();
  }

  console.log("PHASE3F_RBAC_UI_OK");
} finally {
  await browser.close();
}
