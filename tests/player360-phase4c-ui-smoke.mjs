import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.PLAYER360_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYER_ID = "10000000-0000-4000-8000-000000000001";

async function installFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ TEAM_ID, TEAM_SEASON_ID, PLAYER_ID }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { Player360View } = await import("/views/Player360View.js");
    const { PermissionService } = await import("/security/PermissionService.js");

    const player = {
      id: PLAYER_ID,
      team_id: TEAM_ID,
      first_name: "Víctor",
      last_name: "Base",
      jersey: 7
    };
    const season = {
      id: TEAM_SEASON_ID,
      team_season_id: TEAM_SEASON_ID,
      teamSeasonId: TEAM_SEASON_ID,
      team_id: TEAM_ID,
      teamId: TEAM_ID,
      name: "2025/2026",
      start_date: "2025-09-01",
      end_date: "2026-06-30",
      source: "v3"
    };

    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
    DataStore.getActiveSeasonContext = () => season;
    DataStore.getActiveSeasonDisplayName = () => season.name;
    DataStore.getTeamById = () => ({ id: TEAM_ID, name: "Equipo Demo" });
    DataStore.getPlayerById = id => String(id) === PLAYER_ID ? player : null;

    const auth = new PermissionService({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      assigned_team_ids: [TEAM_ID],
      allowed_team_season_ids: [TEAM_SEASON_ID]
    });

    const metrics = [
      {
        code: "SHOOTING",
        domain_code: "TECHNICAL",
        name: "Tiro",
        scale_min: 0,
        scale_max: 10,
        scale_step: 0.5,
        higher_is_better: true
      },
      {
        code: "DECISION_MAKING",
        domain_code: "TACTICAL",
        name: "Toma de decisiones",
        scale_min: 0,
        scale_max: 10,
        scale_step: 0.5,
        higher_is_better: true
      }
    ];

    const evaluations = [{
      id: "eval-1",
      evaluation_date: "2026-02-01",
      revision: 1,
      title: "Evaluación inicial",
      evaluation_type: "GENERAL",
      source_type: "CLUB_COACH",
      is_private: false,
      summary: "Base de trabajo",
      scores: [{ metric_code: "SHOOTING", metric_name: "Tiro", score: 7 }]
    }];
    const objective = {
      id: "profile-1",
      effective_date: "2026-02-01",
      target_date: "2026-06-01",
      title: "Perfil objetivo de temporada",
      rationale: "Priorizar toma de decisiones",
      targets: [{
        metric_code: "SHOOTING",
        metric_name: "Tiro",
        domain_code: "TECHNICAL",
        target_score: 8.5,
        priority_weight: 2
      }]
    };

    window.__phase4cCalls = { evaluations: [], objectives: [] };
    const view = new Player360View(null, auth);
    view.service = {
      getCapabilities: async () => ({
        ready: true,
        evaluation: true,
        objective_profile: true,
        metric_catalog: true
      }),
      listMetrics: async () => metrics,
      listEvaluations: async () => evaluations,
      getActiveObjectiveProfile: async () => objective,
      getObjectiveGap: async () => [{
        metric_code: "SHOOTING",
        metric_name: "Tiro",
        domain_code: "TECHNICAL",
        current_score: 7,
        target_score: 8.5,
        gap_to_target: 1.5,
        priority_weight: 2,
        data_status: "AVAILABLE"
      }],
      saveEvaluation: async payload => {
        window.__phase4cCalls.evaluations.push(payload);
        return "eval-new";
      },
      archiveEvaluation: async () => true,
      saveObjectiveProfile: async payload => {
        window.__phase4cCalls.objectives.push(payload);
        return "profile-new";
      },
      archiveObjectiveProfile: async () => true
    };

    document.body.innerHTML = '<main id="dashboard-content-area"></main>';
    window.__phase4cView = view;
    await view.render("dashboard-content-area", PLAYER_ID, TEAM_ID);
  }, { TEAM_ID, TEAM_SEASON_ID, PLAYER_ID });
}

async function runViewport(name, viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await installFixture(page);

  const core = await page.evaluate(() => ({
    title: document.querySelector(".p360c-hero h1")?.textContent.trim(),
    evaluationCards: document.querySelectorAll(".p360c-eval-card").length,
    minDate: document.querySelector("#p360c-evaluation-date")?.min,
    maxDate: document.querySelector("#p360c-evaluation-date")?.max,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));

  if (!core.title?.includes("Víctor Base")) throw new Error(`[${name}] Player 360 no identifica al jugador`);
  if (core.evaluationCards !== 1) throw new Error(`[${name}] No se renderiza la evaluación existente`);
  if (core.minDate !== "2025-09-01" || core.maxDate !== "2026-06-30") {
    throw new Error(`[${name}] Límites temporales incorrectos: ${JSON.stringify(core)}`);
  }
  if (core.horizontalOverflow) throw new Error(`[${name}] Player 360 provoca overflow horizontal`);

  await page.locator("#p360c-evaluation-editor > summary").click();
  await page.locator("#p360c-evaluation-title").fill("Evaluación mensual UI");
  await page.locator('.p360c-eval-score[data-metric-code="SHOOTING"]').fill("7.5");
  await page.locator("#p360c-evaluation-form button[type=submit]").click();
  await page.waitForFunction(() => window.__phase4cCalls.evaluations.length === 1);

  await page.locator('[data-p360c-tab="objective"]').click();
  await page.locator("#p360c-objective-editor > summary").click();
  await page.locator("#p360c-objective-title").fill("Objetivo mensual UI");
  await page.locator('.p360c-target-score[data-metric-code="SHOOTING"]').fill("9");
  await page.locator("#p360c-objective-form button[type=submit]").click();
  await page.waitForFunction(() => window.__phase4cCalls.objectives.length === 1);

  const result = await page.evaluate(() => ({
    calls: window.__phase4cCalls,
    gapCards: document.querySelectorAll(".p360c-gap").length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    viewWidth: document.querySelector(".p360c-view")?.getBoundingClientRect().width,
    viewportWidth: window.innerWidth
  }));

  if (result.calls.evaluations[0]?.teamSeasonId !== TEAM_SEASON_ID) {
    throw new Error(`[${name}] La evaluación no conserva team-season`);
  }
  if (result.calls.evaluations[0]?.playerId !== PLAYER_ID) {
    throw new Error(`[${name}] La evaluación no conserva playerId`);
  }
  if (result.calls.objectives[0]?.targets[0]?.target_score !== 9) {
    throw new Error(`[${name}] El objetivo no recoge la puntuación editada`);
  }
  if (result.gapCards !== 1) throw new Error(`[${name}] No se renderiza el gap objetivo`);
  if (result.horizontalOverflow || result.viewWidth > result.viewportWidth) {
    throw new Error(`[${name}] Geometría responsive inválida: ${JSON.stringify(result)}`);
  }
  if (pageErrors.length) throw new Error(`[${name}] pageerror: ${pageErrors.join(" | ")}`);

  console.log(JSON.stringify({ viewport: name, core, result, status: "PASS" }));
  await browser.close();
}

for (const spec of [
  { name: "desktop-1440x900", viewport: { width: 1440, height: 900 } },
  { name: "iphone-390x844", viewport: { width: 390, height: 844 } }
]) {
  await runViewport(spec.name, spec.viewport);
}

console.log("PLAYER360_PHASE4C_UI_OK");
