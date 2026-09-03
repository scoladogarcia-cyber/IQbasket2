import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.SEASON_FREEZE_UI_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SEASON_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const roles = [
  { role: "SUPERADMIN", email: "scolado@nechigroup.com", openAction: "freeze", frozenAction: "reopen" },
  { role: "ADMIN", email: "admin@example.test", openAction: "freeze", frozenAction: "reopen" },
  { role: "ENTRENADOR", email: "coach@example.test", openAction: "request", frozenAction: null },
  { role: "ANALISTA", email: "analyst@example.test", openAction: "request", frozenAction: null },
  { role: "COORDINADOR", authRole: "INVITADO", contextRole: "COORDINADOR", email: "coord@example.test", openAction: null, frozenAction: null },
  { role: "DIRECTOR_DEPORTIVO", authRole: "INVITADO", contextRole: "DIRECTOR_DEPORTIVO", email: "director@example.test", openAction: null, frozenAction: null },
  { role: "INVITADO", email: "test@test.com", openAction: null, frozenAction: null }
];

async function renderScenario(page, spec, frozen, pending = false) {
  return page.evaluate(async ({ spec, frozen, pending, TEAM_ID, TEAM_SEASON_ID, SEASON_ID }) => {
    const { PermissionService, Permission } = await import("/security/PermissionService.js");
    const { SeasonFreezeService } = await import("/services/seasons/SeasonFreezeService.js");
    const { SeasonManagementView } = await import("/views/SeasonManagementView.js");

    const auth = new PermissionService({
      id: "browser-" + spec.role,
      email: spec.email,
      role: spec.authRole || spec.role,
      club_id: "club-a",
      assigned_team_ids: [TEAM_ID],
      allowed_team_ids: [TEAM_ID],
      allowed_season_ids: [SEASON_ID],
      allowed_team_season_ids: [TEAM_SEASON_ID],
      contextualMemberships: [{
        teamSeasonId: TEAM_SEASON_ID,
        teamId: TEAM_ID,
        globalSeasonId: SEASON_ID,
        role: spec.contextRole || spec.role,
        status: "ACTIVE"
      }]
    });

    const scope = {
      id: TEAM_SEASON_ID,
      team_id: TEAM_ID,
      season_id: SEASON_ID,
      legacy_season_id: null,
      status: "ACTIVE",
      data_status: frozen ? "FROZEN" : "ACTIVE"
    };
    const state = {
      capabilities: { ready: true, global_season_write: spec.role === "SUPERADMIN" },
      seasons: [{
        id: SEASON_ID,
        code: "2025-2026",
        name: "2025/2026",
        start_date: "2025-09-01",
        end_date: "2026-06-30",
        status: "ACTIVE"
      }],
      teamSeasons: [scope],
      teams: [{
        id: TEAM_ID,
        club_id: "club-a",
        name: "Equipo Demo",
        category: "Cadete",
        competition: "Liga"
      }],
      staffAssignments: [],
      usersById: new Map()
    };

    const baseFreeze = new SeasonFreezeService(null, auth);
    window.__seasonFreezeCalls = [];
    const freezeService = {
      isFrozen: input => baseFreeze.isFrozen(input),
      canFreeze: input => baseFreeze.canFreeze(input),
      canReopen: input => baseFreeze.canReopen(input),
      canRequestFreeze: input => baseFreeze.canRequestFreeze(input),
      canReviewRequests: input => baseFreeze.canReviewRequests(input),
      getCapabilities: async () => ({ ready: true, team_season_freeze: true }),
      listRequests: async () => pending ? [{
        id: "pending-1",
        team_season_id: TEAM_SEASON_ID,
        status: "PENDING",
        requested_by_role: spec.contextRole || spec.role
      }] : [],
      requestFreeze: async (teamSeasonId, reason) => {
        window.__seasonFreezeCalls.push({ action: "request", teamSeasonId, reason });
      },
      setFrozen: async (teamSeasonId, value, reason) => {
        window.__seasonFreezeCalls.push({ action: value ? "freeze" : "reopen", teamSeasonId, reason });
      }
    };

    const seasonService = {
      loadOverview: async () => state,
      setTeamSeasonStatus: async () => {},
      updateGlobalSeason: async () => {},
      createGlobalSeason: async () => {},
      linkTeamSeason: async () => {},
      assignStaff: async () => {},
      removeStaff: async () => {}
    };

    const view = new SeasonManagementView(seasonService, auth, freezeService);
    view.state = state;
    view.freezeCapabilities = { ready: true, team_season_freeze: true };
    view.freezeRequests = pending ? [{
      id: "pending-1",
      team_season_id: TEAM_SEASON_ID,
      status: "PENDING"
    }] : [];

    document.body.innerHTML = '<main id="season-freeze-test"></main>';
    const container = document.getElementById("season-freeze-test");
    const canManage = auth.canPreview(Permission.MANAGE_SEASONS, {
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonId: SEASON_ID
    });
    container.innerHTML = view.renderMarkup({ activeTeamId: TEAM_ID, canManage });

    window.confirm = () => true;
    view.bindEvents(container, { onChanged: async () => {} });

    const actions = {
      freeze: Boolean(container.querySelector('[data-action="freeze-scope-data"]')),
      reopen: Boolean(container.querySelector('[data-action="reopen-scope-data"]')),
      request: Boolean(container.querySelector('[data-action="request-freeze-scope-data"]'))
    };
    const actionButtons = [...container.querySelectorAll(
      '[data-action="freeze-scope-data"],[data-action="reopen-scope-data"],[data-action="request-freeze-scope-data"]'
    )];

    return {
      actions,
      text: container.textContent,
      minActionHeight: actionButtons.length
        ? Math.min(...actionButtons.map(button => button.getBoundingClientRect().height))
        : null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  }, { spec, frozen, pending, TEAM_ID, TEAM_SEASON_ID, SEASON_ID });
}

async function clickExpectedAction(page, action) {
  const selector = {
    freeze: '[data-action="freeze-scope-data"]',
    reopen: '[data-action="reopen-scope-data"]',
    request: '[data-action="request-freeze-scope-data"]'
  }[action];
  if (!selector) return [];

  const reasonInput = page.locator(".season-freeze-reason").first();
  if (await reasonInput.count()) {
    await reasonInput.fill("Motivo inline test");
  }

  const dialogs = [];
  const handler = async dialog => {
    dialogs.push(dialog.type());
    await dialog.accept();
  };
  page.on("dialog", handler);
  await page.click(selector);
  await page.waitForFunction(() => window.__seasonFreezeCalls.length > 0);
  page.off("dialog", handler);

  if (dialogs.includes("prompt")) {
    throw new Error("El lifecycle V6 abrió prompt() en navegador.");
  }

  return page.evaluate(() => window.__seasonFreezeCalls);
}

async function inspect(browser, spec, viewportName, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  const open = await renderScenario(page, spec, false, false);
  if (!open.text.includes("Datos abiertos")) {
    throw new Error("[" + viewportName + "][" + spec.role + "] falta estado Datos abiertos");
  }
  if (open.overflow) {
    throw new Error("[" + viewportName + "][" + spec.role + "] overflow horizontal en temporada abierta");
  }
  if (open.minActionHeight !== null && open.minActionHeight < 43) {
    throw new Error("[" + viewportName + "][" + spec.role + "] acción táctil demasiado pequeña: " + open.minActionHeight);
  }

  for (const action of ["freeze", "reopen", "request"]) {
    const expected = spec.openAction === action;
    if (open.actions[action] !== expected) {
      throw new Error(
        "[" + viewportName + "][" + spec.role + "] acción abierta incorrecta " +
        action + ": " + JSON.stringify(open.actions)
      );
    }
  }

  if (spec.openAction) {
    const calls = await clickExpectedAction(page, spec.openAction);
    if (calls[0]?.action !== spec.openAction || calls[0]?.reason !== "Motivo inline test") {
      throw new Error("[" + viewportName + "][" + spec.role + "] handler abierto/nota incorrectos: " + JSON.stringify(calls));
    }
  }

  const frozen = await renderScenario(page, spec, true, false);
  if (!frozen.text.includes("Datos cerrados") || !frozen.text.includes("solo lectura")) {
    throw new Error("[" + viewportName + "][" + spec.role + "] falta estado histórico cerrado");
  }
  if (frozen.overflow) {
    throw new Error("[" + viewportName + "][" + spec.role + "] overflow horizontal en temporada cerrada");
  }

  for (const action of ["freeze", "reopen", "request"]) {
    const expected = spec.frozenAction === action;
    if (frozen.actions[action] !== expected) {
      throw new Error(
        "[" + viewportName + "][" + spec.role + "] acción cerrada incorrecta " +
        action + ": " + JSON.stringify(frozen.actions)
      );
    }
  }

  if (spec.frozenAction) {
    const calls = await clickExpectedAction(page, spec.frozenAction);
    if (calls[0]?.action !== spec.frozenAction || calls[0]?.reason !== "Motivo inline test") {
      throw new Error("[" + viewportName + "][" + spec.role + "] handler cerrado/nota incorrectos: " + JSON.stringify(calls));
    }
  }

  if (spec.role === "ENTRENADOR") {
    const pending = await renderScenario(page, spec, false, true);
    if (pending.actions.request || !pending.text.includes("Cierre solicitado")) {
      throw new Error("[" + viewportName + "][ENTRENADOR] solicitud duplicable o badge pendiente ausente");
    }
  }

  console.log(JSON.stringify({
    role: spec.role,
    viewport: viewportName,
    openAction: spec.openAction,
    frozenAction: spec.frozenAction,
    result: "PASS"
  }));

  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const spec of roles) {
    await inspect(browser, spec, "desktop-1440x900", { width: 1440, height: 900 });
    await inspect(browser, spec, "iphone-390x844", { width: 390, height: 844 });
  }
  console.log("TEAM_SEASON_FREEZE_UI_OK");
} finally {
  await browser.close();
}
