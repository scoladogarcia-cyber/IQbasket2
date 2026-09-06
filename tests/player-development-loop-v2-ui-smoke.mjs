import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.PLAYER360_BASE_URL || "http://127.0.0.1:4173";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYER_ID = "10000000-0000-4000-8000-000000000001";

async function installFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ TEAM_SEASON_ID, PLAYER_ID }) => {
    const { DevelopmentCyclePanel } = await import("/views/player360/DevelopmentCyclePanel.js");
    const { Player360View } = await import("/views/Player360View.js");

    const objective = {
      id: "objective-1",
      title: "Perfil objetivo demo",
      revision: 3,
      targets: [{
        metric_code: "DECISION_MAKING",
        metric_name: "Toma de decisiones",
        priority_weight: 3
      }]
    };
    const state = { cycle: null };
    const calls = [];
    const capabilities = {
      ready: true,
      can_view: true,
      can_create: true,
      can_edit_action: true,
      can_link_evidence: true,
      can_review: true
    };

    function snapshot() {
      return {
        current_cycle: state.cycle ? structuredClone(state.cycle) : null,
        recent_cycles: [],
        available_evidence: [{
          type: "GAME",
          id: "game-1",
          date: "2026-09-05",
          label: "vs Equipo Rival"
        }],
        capabilities
      };
    }

    const service = {
      getCapabilities: async () => capabilities,
      snapshot: async () => snapshot(),
      startCycle: async payload => {
        calls.push({ op: "start", payload });
        state.cycle = {
          id: "cycle-1",
          objective_profile_id: objective.id,
          objective_revision: objective.revision,
          week_start: "2026-08-31",
          starts_on: "2026-09-06",
          ends_on: "2026-09-06",
          status: "ACTIVE",
          objective_title: objective.title,
          focus_metric_name: "Toma de decisiones",
          evidence_snapshot: {
            training_sessions: 3,
            technification_sessions: 1,
            games: 2
          },
          actions: payload.actions.map((item, index) => ({
            id: `action-${index + 1}`,
            action_order: index + 1,
            action_type: String(item.actionType || "OTHER").toUpperCase(),
            status: "PLANNED",
            title: item.title,
            success_criterion: item.successCriterion,
            evidence: []
          }))
        };
        return state.cycle.id;
      },
      setActionState: async payload => {
        calls.push({ op: "state", payload });
        const action = state.cycle.actions.find(item => item.id === payload.actionId);
        action.status = payload.targetState;
        action.state_note = payload.note || null;
        if (state.cycle.actions.every(item => ["COMPLETED", "SKIPPED"].includes(item.status))) {
          state.cycle.status = "REVIEW_DUE";
        }
        return action.id;
      },
      linkEvidence: async payload => {
        calls.push({ op: "evidence", payload });
        const action = state.cycle.actions.find(item => item.id === payload.actionId);
        action.evidence.push({
          id: "evidence-1",
          evidence_type: payload.evidenceType,
          evidence_date: "2026-09-05",
          label: "vs Equipo Rival"
        });
        return "evidence-1";
      },
      reviewCycle: async payload => {
        calls.push({ op: "review", payload });
        state.cycle.status = payload.outcome === "PAUSE" ? "PAUSED" : "COMPLETED";
        state.cycle.review_outcome = payload.outcome;
        state.cycle.review_note = payload.note || null;
        return state.cycle.id;
      }
    };
    const panel = new DevelopmentCyclePanel({ service, can: () => true });
    const styleSource = new Player360View(null, null);
    document.body.innerHTML = '<main id="development-root"></main>';
    const root = document.getElementById("development-root");

    async function mount() {
      await panel.load({
        teamSeasonId: TEAM_SEASON_ID,
        playerId: PLAYER_ID,
        objectiveProfile: objective
      });
      root.innerHTML = `<section class="p360c-view">${styleSource._renderStyles()}${panel.render()}</section>`;
      panel.bind(root, mount);
    }

    window.__developmentLoop = { state, calls, mount };
    await mount();
  }, { TEAM_SEASON_ID, PLAYER_ID });
}

async function assertGeometry(page, label) {
  const geometry = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    rootWidth: document.querySelector(".p360c-view")?.getBoundingClientRect().width || 0,
    viewportWidth: window.innerWidth
  }));
  if (geometry.horizontalOverflow || geometry.rootWidth > geometry.viewportWidth + 1) {
    throw new Error(`[${label}] Overflow horizontal: ${JSON.stringify(geometry)}`);
  }
  return geometry;
}

async function runViewport(name, viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  try {
    await installFixture(page);
    await page.locator("#p360c-panel-development").waitFor();
    const initial = await assertGeometry(page, `${name}:initial`);

    const startForm = page.locator("#p360d-start-form");
    if (await startForm.count() !== 1) {
      throw new Error(`[${name}] No aparece el formulario para crear el ciclo.`);
    }
    await startForm.locator('button[type="submit"]').click();
    await page.waitForFunction(() => window.__developmentLoop.state.cycle?.id === "cycle-1");
    await page.locator('[data-development-action="action-1"]').waitFor();

    const created = await page.evaluate(() => ({
      calls: window.__developmentLoop.calls.slice(),
      status: window.__developmentLoop.state.cycle?.status,
      actions: window.__developmentLoop.state.cycle?.actions?.length || 0
    }));
    if (created.calls[0]?.op !== "start" || created.actions !== 1 || created.status !== "ACTIVE") {
      throw new Error(`[${name}] Creación de ciclo inválida: ${JSON.stringify(created)}`);
    }

    const action = page.locator('[data-development-action="action-1"]');
    const evidenceForm = action.locator(".p360d-evidence-form");
    await evidenceForm.locator("[data-evidence]").selectOption("GAME|game-1");
    await evidenceForm.locator('button[type="submit"]').click();
    await page.waitForFunction(() => window.__developmentLoop.state.cycle?.actions?.[0]?.evidence?.length === 1);

    const stateForm = page.locator('[data-development-action="action-1"] .p360d-state-form');
    await stateForm.locator("[data-action-state]").selectOption("COMPLETED");
    await stateForm.locator("[data-action-note]").fill("Acción observada y cerrada en UAT.");
    await stateForm.locator('button[type="submit"]').click();
    await page.waitForFunction(() => window.__developmentLoop.state.cycle?.status === "REVIEW_DUE");
    await page.locator("#p360d-review-form").waitFor();

    const afterAction = await assertGeometry(page, `${name}:review-ready`);
    const reviewForm = page.locator("#p360d-review-form");
    await reviewForm.locator("[data-review-outcome]").selectOption("ADAPT");
    await reviewForm.locator("[data-review-note]").fill("Adaptar el foco con la evidencia registrada.");
    await reviewForm.locator('button[type="submit"]').click();
    await page.waitForFunction(() => window.__developmentLoop.state.cycle?.status === "COMPLETED");
    await page.locator("text=Ciclo cerrado").waitFor();

    const finalState = await page.evaluate(() => ({
      status: window.__developmentLoop.state.cycle?.status,
      outcome: window.__developmentLoop.state.cycle?.review_outcome,
      evidence: window.__developmentLoop.state.cycle?.actions?.[0]?.evidence?.length || 0,
      calls: window.__developmentLoop.calls.map(item => item.op)
    }));

    const finalGeometry = await assertGeometry(page, `${name}:closed`);
    const expectedOps = ["start", "evidence", "state", "review"];
    if (JSON.stringify(finalState.calls) !== JSON.stringify(expectedOps)) {
      throw new Error(`[${name}] Secuencia RPC inesperada: ${JSON.stringify(finalState.calls)}`);
    }
    if (finalState.status !== "COMPLETED" || finalState.outcome !== "ADAPT" || finalState.evidence !== 1) {
      throw new Error(`[${name}] Estado final inválido: ${JSON.stringify(finalState)}`);
    }
    if (pageErrors.length) throw new Error(`[${name}] pageerror: ${pageErrors.join(" | ")}`);

    console.log(JSON.stringify({
      viewport: name,
      initial,
      afterAction,
      finalGeometry,
      finalState,
      status: "PASS"
    }));
  } finally {
    await browser.close();
  }
}

for (const spec of [
  { name: "desktop-1440x900", viewport: { width: 1440, height: 900 } },
  { name: "iphone-390x844", viewport: { width: 390, height: 844 } }
]) {
  await runViewport(spec.name, spec.viewport);
}

console.log("PLAYER_DEVELOPMENT_LOOP_V2_UI_OK");
