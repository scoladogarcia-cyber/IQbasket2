import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function assertCondition(condition, viewport, message) {
  if (!condition) throw new Error(`[${viewport}] ${message}`);
}

async function installFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  await page.evaluate(async ({ TEAM_ID, TEAM_SEASON_ID }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { NutritionView } = await import("/views/NutritionView.js");
    const { LayoutView } = await import("/views/LayoutView.js");
    const { PermissionService } = await import("/security/PermissionService.js");

    const players = [
      {
        id: "10000000-0000-4000-8000-000000000001",
        team_id: TEAM_ID,
        first_name: "Víctor",
        last_name: "Base",
        jersey: 7
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        team_id: TEAM_ID,
        first_name: "Paula",
        last_name: "Escolta",
        jersey: 12
      }
    ];

    const season = {
      team_season_id: TEAM_SEASON_ID,
      teamSeasonId: TEAM_SEASON_ID,
      team_id: TEAM_ID,
      teamId: TEAM_ID,
      name: "2025/2026",
      start_date: "2025-09-01",
      end_date: "2026-06-30",
      data_status: "ACTIVE"
    };

    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
    DataStore.getActiveSeasonContext = () => ({ ...season });
    DataStore.getActiveSeasonDisplayName = () => season.name;
    DataStore.getTeamById = () => ({ id: TEAM_ID, name: "Equipo Demo" });
    DataStore.getSeasonParticipantPlayers = () => players.map(player => ({ ...player }));
    DataStore.getPlayersForActiveSeason = () => players.map(player => ({ ...player }));
    DataStore.getTeamPlayers = () => players.map(player => ({ ...player }));

    const auth = new PermissionService();
    auth.setCurrentUser({
      id: "coach-user",
      email: "coach@example.test",
      role: "ENTRENADOR",
      global_role: "ENTRENADOR",
      assigned_team_ids: [TEAM_ID],
      allowed_team_season_ids: [TEAM_SEASON_ID],
      contextualMemberships: [
        {
          team_season_id: TEAM_SEASON_ID,
          team_id: TEAM_ID,
          function_role: "ENTRENADOR",
          status: "ACTIVE"
        }
      ]
    });

    const guestAuth = new PermissionService();
    guestAuth.setCurrentUser({
      id: "guest-user",
      email: "test@test.com",
      role: "INVITADO",
      global_role: "INVITADO",
      assigned_team_ids: [TEAM_ID],
      allowed_team_season_ids: [TEAM_SEASON_ID],
      contextualMemberships: []
    });

    const navScratch = document.createElement("div");
    navScratch.innerHTML = LayoutView.wrap(
      '<div id="dashboard-content-area"></div>',
      "nutrition",
      "ENTRENADOR"
    );
    const desktopNav = navScratch.querySelector('.nav-link[data-route-key="nutrition"]');
    const mobileNav = navScratch.querySelector('.drawer-item[data-route-key="nutrition"]');
    window.__nutritionNav = {
      desktopExists: Boolean(desktopNav),
      desktopHref: desktopNav?.getAttribute("href") || "",
      desktopLocked: desktopNav?.classList.contains("disabled-link") || false,
      mobileExists: Boolean(mobileNav),
      mobileHref: mobileNav?.getAttribute("href") || "",
      mobileLocked: mobileNav?.classList.contains("disabled-link") || false
    };

    const guestNavScratch = document.createElement("div");
    guestNavScratch.innerHTML = LayoutView.wrap(
      '<div id="dashboard-content-area"></div>',
      "nutrition",
      "INVITADO"
    );
    const guestDesktopNav = guestNavScratch.querySelector('.nav-link[data-route-key="nutrition"]');
    const guestMobileNav = guestNavScratch.querySelector('.drawer-item[data-route-key="nutrition"]');
    window.__guestNutritionNav = {
      desktopExists: Boolean(guestDesktopNav),
      desktopHref: guestDesktopNav?.getAttribute("href") || "",
      desktopLocked: guestDesktopNav?.classList.contains("disabled-link") || false,
      mobileExists: Boolean(guestMobileNav),
      mobileHref: guestMobileNav?.getAttribute("href") || "",
      mobileLocked: guestMobileNav?.classList.contains("disabled-link") || false
    };

    document.body.innerHTML = '<main id="nutrition-test-root" style="min-height:100vh;width:100%;"></main>';

    const store = [];
    window.__nutritionCalls = [];
    window.__guestNutritionReads = 0;

    const view = new NutritionView(null, auth);
    view.service.supabase = {};
    view.service.resolveAccessContext = async ({ module }) => ({
      ready: true,
      module,
      purpose: "SPORT_PERFORMANCE",
      can_read: true,
      can_create: true,
      can_update: true,
      can_archive: true,
      manual_input_enabled: true,
      external_import_enabled: false,
      recommendations_enabled: true,
      ai_processing_enabled: false
    });
    view.service.listMetrics = async ({ module }) => module === "nutrition" ? [
      {
        id: "metric-hydration",
        module: "nutrition",
        code: "HYDRATION_ADHERENCE",
        name: "Hidratación percibida",
        description: "Cumplimiento percibido de la pauta personal.",
        value_type: "SCALE",
        unit: "SCALE_1_5",
        min_value: 1,
        max_value: 5,
        step: 1,
        options: []
      }
    ] : [];
    view.service.listEntries = async () => structuredClone(store);
    view.service.saveManualEntry = async payload => {
      window.__nutritionCalls.push(structuredClone(payload));
      const id = payload.entryId || "nutrition-entry-1";
      const entry = {
        id,
        player_id: payload.playerId,
        team_season_id: payload.teamSeasonId,
        module: "nutrition",
        entry_date: payload.entryDate,
        observations: payload.values.map(value => ({
          metric_code: value.metric_code,
          value_type: "SCALE",
          value: value.value,
          unit: "SCALE_1_5"
        }))
      };
      const index = store.findIndex(item => item.id === id);
      if (index >= 0) store[index] = entry;
      else store.unshift(entry);
      return id;
    };
    view.service.archiveEntry = async () => true;

    window.__nutritionView = view;

    window.__renderGuestNutrition = async () => {
      const guestView = new NutritionView(null, guestAuth);
      guestView.service.supabase = {};
      guestView.service.resolveAccessContext = async ({ module }) => ({
        ready: true,
        module,
        purpose: null,
        can_read: false,
        can_create: false,
        can_update: false,
        can_archive: false,
        manual_input_enabled: true,
        external_import_enabled: false,
        recommendations_enabled: true,
        ai_processing_enabled: false
      });
      guestView.service.listMetrics = async ({ module }) => module === "nutrition" ? [
        {
          id: "metric-hydration",
          module: "nutrition",
          code: "HYDRATION_ADHERENCE",
          name: "Hidratación percibida",
          description: "Cumplimiento percibido de la pauta personal.",
          value_type: "SCALE",
          unit: "SCALE_1_5",
          min_value: 1,
          max_value: 5,
          step: 1,
          options: []
        }
      ] : [];
      guestView.service.listEntries = async () => {
        window.__guestNutritionReads += 1;
        return structuredClone(store);
      };
      guestView.service.saveManualEntry = async () => {
        throw new Error("INVITADO_NO_DEBE_GUARDAR_WELLNESS");
      };
      window.__guestNutritionView = guestView;
      await guestView.render("nutrition-test-root", players[0].id, TEAM_ID);
    };

    await view.render("nutrition-test-root", players[0].id, TEAM_ID);
  }, { TEAM_ID, TEAM_SEASON_ID });
}

async function runViewport(browser, viewportName, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);

  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await installFixture(page);

  const initial = await page.evaluate(() => ({
    nav: window.__nutritionNav,
    title: document.querySelector(".nutrition-hero h1")?.textContent || "",
    playerOptions: document.querySelectorAll("#nutrition-player-select option").length,
    nutritionButtons: [...document.querySelectorAll("[data-p360w-module]")]
      .map(button => button.textContent?.trim() || ""),
    hasRecovery: [...document.querySelectorAll("[data-p360w-module]")]
      .some(button => (button.textContent || "").includes("Recuperación")),
    hasNew: Boolean(document.querySelector("#p360w-new")),
    player360Href: document.querySelector(".nutrition-player360")?.getAttribute("href") || "",
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  }));

  assertCondition(initial.nav.desktopExists, viewportName, "Falta Nutrición en navegación desktop");
  assertCondition(initial.nav.mobileExists, viewportName, "Falta Nutrición en navegación móvil");
  assertCondition(initial.nav.desktopHref === "#/nutrition", viewportName, "Ruta desktop de Nutrición incorrecta");
  assertCondition(initial.nav.mobileHref === "#/nutrition", viewportName, "Ruta móvil de Nutrición incorrecta");
  assertCondition(!initial.nav.desktopLocked && !initial.nav.mobileLocked, viewportName, "Nutrición aparece bloqueada para ENTRENADOR");
  assertCondition(initial.title.includes("Nutrición"), viewportName, "No se abre la vista Nutrición");
  assertCondition(initial.playerOptions === 2, viewportName, "Selector de jugador incompleto");
  assertCondition(initial.nutritionButtons.length === 1, viewportName, "Ruta Nutrición mezcla módulos");
  assertCondition(initial.nutritionButtons[0].includes("Nutrición"), viewportName, "Panel no queda enfocado en Nutrición");
  assertCondition(!initial.hasRecovery, viewportName, "La ruta Nutrición expone Recovery");
  assertCondition(initial.hasNew, viewportName, "Falta alta manual de check-in nutricional");
  assertCondition(initial.player360Href.includes("/player360/"), viewportName, "Falta acceso a Player 360");
  assertCondition(!initial.overflow, viewportName, "Nutrición desborda horizontalmente");

  await page.locator("#p360w-new").click();
  await page.waitForSelector("#p360w-form");
  await page.fill("#p360w-entry-date", "2026-05-15");
  await page.selectOption('[data-metric-code="HYDRATION_ADHERENCE"]', "4");
  await page.locator('#p360w-form button[type="submit"]').click();
  await page.waitForFunction(() => window.__nutritionCalls.length === 1);
  await page.waitForFunction(() => document.querySelectorAll(".p360w-history-card").length === 1);

  const saved = await page.evaluate(() => ({
    call: window.__nutritionCalls[0],
    history: document.querySelectorAll(".p360w-history-card").length,
    activeModule: window.__nutritionView?.panel?.activeModule,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  }));

  assertCondition(saved.call.module === "nutrition", viewportName, "Check-in se guarda en módulo incorrecto");
  assertCondition(saved.call.playerId.endsWith("0001"), viewportName, "Check-in se vincula a jugador incorrecto");
  assertCondition(saved.call.values[0].metric_code === "HYDRATION_ADHERENCE", viewportName, "Métrica nutricional incorrecta");
  assertCondition(saved.history === 1, viewportName, "Histórico nutricional no refresca");
  assertCondition(saved.activeModule === "nutrition", viewportName, "Nutrición pierde foco tras guardar");
  assertCondition(!saved.overflow, viewportName, "Nutrición desborda tras interacción");

  // INVITADO can discover the module, but ABAC denial must keep all personal
  // wellness rows and mutation affordances unavailable.
  await page.evaluate(() => window.__renderGuestNutrition());
  const guest = await page.evaluate(() => ({
    nav: window.__guestNutritionNav,
    title: document.querySelector(".nutrition-hero h1")?.textContent || "",
    lockedText: String(document.querySelector(".p360w-locked")?.textContent || "")
      .replace(/\s+/g, " ")
      .trim(),
    hasNew: Boolean(document.querySelector("#p360w-new")),
    history: document.querySelectorAll(".p360w-history-card").length,
    entryReads: window.__guestNutritionReads,
    totalSaveCalls: window.__nutritionCalls.length,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  }));

  assertCondition(guest.nav.desktopExists && guest.nav.mobileExists, viewportName, "INVITADO no descubre Nutrición");
  assertCondition(guest.nav.desktopHref === "#/nutrition", viewportName, "INVITADO desktop no navega a Nutrición");
  assertCondition(guest.nav.mobileHref === "#/nutrition", viewportName, "INVITADO móvil no navega a Nutrición");
  assertCondition(!guest.nav.desktopLocked && !guest.nav.mobileLocked, viewportName, "INVITADO ve Nutrición bloqueada en navegación");
  assertCondition(guest.title.includes("Nutrición"), viewportName, "INVITADO no abre el shell de Nutrición");
  assertCondition(guest.lockedText.includes("autorización ABAC"), viewportName, "Falta explicación de privacidad para INVITADO");
  assertCondition(!guest.hasNew, viewportName, "INVITADO expone alta de check-in");
  assertCondition(guest.history === 0, viewportName, "INVITADO expone historial wellness");
  assertCondition(guest.entryReads === 0, viewportName, "INVITADO intentó leer filas wellness sin ABAC");
  assertCondition(guest.totalSaveCalls === 1, viewportName, "INVITADO provocó una escritura wellness");
  assertCondition(!guest.overflow, viewportName, "Shell Nutrición de INVITADO desborda");

  const relevantConsoleErrors = consoleErrors.filter(message =>
    !/favicon|Failed to load resource.*404/i.test(message)
  );
  assertCondition(pageErrors.length === 0, viewportName, "pageerror: " + pageErrors.join(" | "));
  assertCondition(relevantConsoleErrors.length === 0, viewportName, "console error: " + relevantConsoleErrors.join(" | "));

  console.log(JSON.stringify({ viewport: viewportName, initial, saved, guest, result: "PASS" }));
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await runViewport(browser, "iphone-390x844", { width: 390, height: 844 });
  console.log("NUTRITION_ROUTE_UI_OK");
} finally {
  await browser.close();
}
