import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYER_ID = "10000000-0000-4000-8000-000000000001";

const READ_ROUTES = [
  "dashboard",
  "approvals",
  "team",
  "players",
  "training",
  "nutrition/" + PLAYER_ID,
  "player360/" + PLAYER_ID,
  "games",
  "boxscore",
  "lineups",
  "advanced",
  "heatmap",
  "comparator",
  "reports",
  "family-advisor",
  "ask",
  "profile",
  "settings"
];

function assertCondition(condition, viewport, message) {
  if (!condition) throw new Error(`[${viewport}] ${message}`);
}

async function installFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ TEAM_ID, TEAM_SEASON_ID, PLAYER_ID, READ_ROUTES }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { LayoutView } = await import("/views/LayoutView.js");
    const app = window.iqApp;

    app.isAuthenticated = true;
    app.teamId = TEAM_ID;
    app.permissionService.setCurrentUser({
      id: "guest-user",
      email: "test@test.com",
      role: "INVITADO",
      global_role: "INVITADO",
      assigned_team_ids: [TEAM_ID],
      allowed_team_season_ids: [TEAM_SEASON_ID],
      contextualMemberships: []
    });

    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
    DataStore.getActiveSeasonContext = () => ({
      team_season_id: TEAM_SEASON_ID,
      team_id: TEAM_ID,
      name: "2025/2026",
      start_date: "2025-09-01",
      end_date: "2026-06-30",
      data_status: "ACTIVE"
    });
    DataStore.getActiveSeasonDisplayName = () => "2025/2026";
    DataStore.getActiveSeason = () => "2025/2026";
    DataStore.getTeams = () => [{ id: TEAM_ID, name: "Equipo Demo", category: "U15" }];
    DataStore.getSeasons = () => [{
      team_season_id: TEAM_SEASON_ID,
      team_id: TEAM_ID,
      name: "2025/2026",
      source: "v3"
    }];

    localStorage.setItem("iq_active_team_id", TEAM_ID);
    localStorage.setItem("iq_active_season", "2025/2026");

    const alerts = [];
    window.alert = message => alerts.push(String(message));

    const routeResults = [];
    for (const routePath of READ_ROUTES) {
      history.replaceState(null, "", "#/" + routePath);
      app.parseHashRoute();
      const expectedRoute = routePath.split("/")[0];
      routeResults.push({
        routePath,
        expectedRoute,
        currentRoute: app.currentRoute,
        routeId: app.routeParams?.id || null,
        redirected: app.currentRoute === "dashboard" && expectedRoute !== "dashboard"
      });
    }

    const scratch = document.createElement("div");
    scratch.innerHTML = LayoutView.wrap(
      '<div id="dashboard-content-area"></div>',
      "dashboard",
      "INVITADO"
    );

    const desktopLinks = [...scratch.querySelectorAll(".nav-link[data-route-key]")]
      .map(link => ({
        key: link.getAttribute("data-route-key"),
        href: link.getAttribute("href") || "",
        disabled: link.classList.contains("disabled-link")
      }));

    const mobileLinks = [...scratch.querySelectorAll(".drawer-item[data-route-key]")]
      .map(link => ({
        key: link.getAttribute("data-route-key"),
        href: link.getAttribute("href") || "",
        disabled: link.classList.contains("disabled-link")
      }));

    window.__invitedRouteMatrix = {
      routeResults,
      desktopLinks,
      mobileLinks,
      alerts,
      playerId: PLAYER_ID
    };
  }, { TEAM_ID, TEAM_SEASON_ID, PLAYER_ID, READ_ROUTES });
}

async function runViewport(browser, viewportName, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);

  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await installFixture(page);
  const matrix = await page.evaluate(() => window.__invitedRouteMatrix);

  for (const result of matrix.routeResults) {
    assertCondition(
      !result.redirected && result.currentRoute === result.expectedRoute,
      viewportName,
      "INVITADO fue redirigido desde ruta de consulta: " + JSON.stringify(result)
    );
  }

  const nutrition = matrix.routeResults.find(result => result.expectedRoute === "nutrition");
  const player360 = matrix.routeResults.find(result => result.expectedRoute === "player360");
  assertCondition(nutrition?.routeId === matrix.playerId, viewportName, "Nutrición pierde playerId de ruta");
  assertCondition(player360?.routeId === matrix.playerId, viewportName, "Player 360 pierde playerId de ruta");

  const desktopDisabled = matrix.desktopLinks.filter(link => link.disabled);
  assertCondition(
    desktopDisabled.length === 0,
    viewportName,
    "INVITADO tiene módulos de consulta bloqueados en desktop: " + JSON.stringify(desktopDisabled)
  );

  const mobileProtectedKeys = ["approvals", "training", "nutrition"];
  for (const key of mobileProtectedKeys) {
    const link = matrix.mobileLinks.find(item => item.key === key);
    assertCondition(Boolean(link), viewportName, "Falta ruta móvil " + key);
    assertCondition(!link.disabled, viewportName, "Ruta móvil bloqueada para INVITADO: " + key);
    assertCondition(link.href.startsWith("#/"), viewportName, "Ruta móvil inválida para INVITADO: " + key);
  }

  assertCondition(
    matrix.alerts.length === 0,
    viewportName,
    "Las rutas read-only generaron alertas de permiso: " + JSON.stringify(matrix.alerts)
  );
  assertCondition(pageErrors.length === 0, viewportName, "pageerror: " + pageErrors.join(" | "));

  console.log(JSON.stringify({ viewport: viewportName, matrix, result: "PASS" }));
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await runViewport(browser, "iphone-390x844", { width: 390, height: 844 });
  console.log("INVITED_ROUTE_MATRIX_UI_OK");
} finally {
  await browser.close();
}
