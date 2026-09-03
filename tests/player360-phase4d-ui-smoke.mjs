import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.PLAYER360_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYER_ID = "10000000-0000-4000-8000-000000000001";

function snapshot(id, periodStart, periodEnd, loadLast = 300) {
  return {
    id,
    team_season_id: TEAM_SEASON_ID,
    player_id: PLAYER_ID,
    period_start: periodStart,
    period_end: periodEnd,
    generated_at: periodEnd + "T20:00:00.000Z",
    snapshot: {
      contract_version: "PLAYER360_LONGITUDINAL_V1",
      calculation_version: "PLAYER360_LONGITUDINAL_2026.09_V1",
      expected_buckets: 8,
      eligibility_periods: [{ from: periodStart, to: periodEnd }],
      series: [
        {
          key: "training.SESSION_LOAD",
          module: "training",
          unit: "AU",
          coverage: { expected_buckets: 8, observed_buckets: 6, coverage_pct: 75 },
          trend: {
            status: "READY",
            sample_size: 6,
            direction: "UP",
            first_value: 200,
            last_value: loadLast,
            relative_change_pct: 50,
            slope_per_week: 20
          },
          points: []
        },
        {
          key: "competition.EVALUATION",
          module: "competition",
          unit: "INDEX",
          coverage: { expected_buckets: 8, observed_buckets: 6, coverage_pct: 75 },
          trend: {
            status: "READY",
            sample_size: 6,
            direction: "UP",
            first_value: 8,
            last_value: 12,
            relative_change_pct: 50,
            slope_per_week: 0.8
          },
          points: []
        }
      ],
      associations: [{
        left: "training.SESSION_LOAD",
        right: "competition.EVALUATION",
        lag_buckets: 1,
        status: "READY",
        sample_size: 6,
        coefficient: 0.65,
        direction: "POSITIVE",
        strength: "STRONG"
      }],
      limitations: [
        "Las asociaciones son descriptivas y no demuestran causalidad."
      ]
    },
    evidence_bundle: {
      evidence_version: "PLAYER360_EVIDENCE_V1",
      facts: [
        { fact_type: "LONGITUDINAL_TREND", metric_key: "training.SESSION_LOAD" },
        {
          fact_type: "DESCRIPTIVE_ASSOCIATION",
          left_metric_key: "training.SESSION_LOAD",
          right_metric_key: "competition.EVALUATION",
          causal_claim_allowed: false
        }
      ],
      missing_data: [{ evidence_type: "LONGITUDINAL_TREND", metric_key: "evaluation.SHOOTING" }],
      limitations: ["La IA solo interpreta hechos incluidos en la evidencia."]
    }
  };
}

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

    const auth = new PermissionService();
    auth.setCurrentUser({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      global_role: "ADMIN",
      assigned_team_ids: [TEAM_ID],
      allowed_team_season_ids: [TEAM_SEASON_ID],
      contextualMemberships: [{
        team_season_id: TEAM_SEASON_ID,
        team_id: TEAM_ID,
        function_role: "ADMIN",
        status: "ACTIVE"
      }]
    });

    const metrics = [{
      code: "SHOOTING",
      domain_code: "TECHNICAL",
      name: "Tiro",
      scale_min: 0,
      scale_max: 10,
      scale_step: 0.5,
      higher_is_better: true
    }];

    const snapshots = [{
      id: "snapshot-1",
      team_season_id: TEAM_SEASON_ID,
      player_id: PLAYER_ID,
      period_start: "2026-01-01",
      period_end: "2026-02-28",
      snapshot: {
        contract_version: "PLAYER360_LONGITUDINAL_V1",
        calculation_version: "PLAYER360_LONGITUDINAL_2026.09_V1",
        expected_buckets: 8,
        eligibility_periods: [{ from: "2026-01-01", to: "2026-02-28" }],
        series: [
          {
            key: "training.SESSION_LOAD",
            module: "training",
            unit: "AU",
            coverage: { expected_buckets: 8, observed_buckets: 6, coverage_pct: 75 },
            trend: {
              status: "READY",
              sample_size: 6,
              direction: "UP",
              first_value: 200,
              last_value: 300,
              relative_change_pct: 50,
              slope_per_week: 20
            },
            points: []
          },
          {
            key: "competition.EVALUATION",
            module: "competition",
            unit: "INDEX",
            coverage: { expected_buckets: 8, observed_buckets: 6, coverage_pct: 75 },
            trend: {
              status: "READY",
              sample_size: 6,
              direction: "UP",
              first_value: 8,
              last_value: 12,
              relative_change_pct: 50,
              slope_per_week: 0.8
            },
            points: []
          }
        ],
        associations: [{
          left: "training.SESSION_LOAD",
          right: "competition.EVALUATION",
          lag_buckets: 1,
          status: "READY",
          sample_size: 6,
          coefficient: 0.65,
          direction: "POSITIVE",
          strength: "STRONG"
        }],
        limitations: ["Las asociaciones son descriptivas y no demuestran causalidad."]
      },
      evidence_bundle: {
        evidence_version: "PLAYER360_EVIDENCE_V1",
        facts: [
          { fact_type: "LONGITUDINAL_TREND", metric_key: "training.SESSION_LOAD" },
          {
            fact_type: "DESCRIPTIVE_ASSOCIATION",
            left_metric_key: "training.SESSION_LOAD",
            right_metric_key: "competition.EVALUATION",
            causal_claim_allowed: false
          }
        ],
        missing_data: [{ evidence_type: "LONGITUDINAL_TREND", metric_key: "evaluation.SHOOTING" }]
      }
    }];

    const insights = [{
      id: "insight-1",
      snapshot_id: "snapshot-1",
      team_season_id: TEAM_SEASON_ID,
      player_id: PLAYER_ID,
      audience: "STAFF",
      provider: "TEST_PROVIDER",
      model_name: "TEST_MODEL",
      prompt_version: "TEST_PROMPT_V1",
      status: "DRAFT",
      content: {
        summary: "La carga y la valoración evolucionan al alza en el periodo observado.",
        priorities: ["Mantener consistencia de carga"],
        recommendations: ["Revisar junto al contexto competitivo"],
        action_plan: ["Seguimiento semanal"]
      }
    }];

    window.__phase4dCalls = {
      generate: [],
      review: [],
      externalProviderCalls: 0
    };
    window.__phase4dData = { snapshots, insights };

    const view = new Player360View(null, auth);
    view.service = {
      getCapabilities: async () => ({
        ready: true,
        evaluation: true,
        objective_profile: true,
        metric_catalog: true
      }),
      listMetrics: async () => metrics,
      listEvaluations: async () => [],
      getActiveObjectiveProfile: async () => null,
      getObjectiveGap: async () => [],
      saveEvaluation: async () => "unused",
      archiveEvaluation: async () => true,
      saveObjectiveProfile: async () => "unused",
      archiveObjectiveProfile: async () => true
    };

    const analyticsService = {
      supabase: {},
      getCapabilities: async () => ({
        ready: true,
        longitudinal_snapshots: true,
        ai_insights: true,
        human_review: true
      }),
      listSnapshots: async ({ teamSeasonId, playerId }) => {
        if (teamSeasonId !== TEAM_SEASON_ID || playerId !== PLAYER_ID) {
          throw new Error("TEST_WRONG_ANALYTICS_SCOPE");
        }
        return window.__phase4dData.snapshots.map(item => structuredClone(item));
      },
      listInsights: async ({ snapshotId }) =>
        window.__phase4dData.insights
          .filter(item => item.snapshot_id === snapshotId)
          .map(item => structuredClone(item)),
      reviewAiInsight: async payload => {
        window.__phase4dCalls.review.push(structuredClone(payload));
        const insight = window.__phase4dData.insights.find(item => item.id === payload.insightId);
        if (insight) insight.status = payload.status;
        return true;
      }
    };

    const orchestrator = {
      generateAndSaveSnapshot: async payload => {
        window.__phase4dCalls.generate.push(structuredClone(payload));
        const created = {
          id: "snapshot-2",
          team_season_id: TEAM_SEASON_ID,
          player_id: PLAYER_ID,
          period_start: payload.periodStart,
          period_end: payload.periodEnd,
          snapshot: {
            contract_version: "PLAYER360_LONGITUDINAL_V1",
            calculation_version: "PLAYER360_LONGITUDINAL_2026.09_V1",
            expected_buckets: 10,
            eligibility_periods: [{ from: payload.periodStart, to: payload.periodEnd }],
            series: [{
              key: "training.SESSION_LOAD",
              module: "training",
              unit: "AU",
              coverage: { expected_buckets: 10, observed_buckets: 8, coverage_pct: 80 },
              trend: {
                status: "READY",
                sample_size: 8,
                direction: "STABLE",
                first_value: 250,
                last_value: 252,
                relative_change_pct: 0.8,
                slope_per_week: 0.1
              },
              points: []
            }],
            associations: [],
            limitations: []
          },
          evidence_bundle: {
            evidence_version: "PLAYER360_EVIDENCE_V1",
            facts: [{ fact_type: "LONGITUDINAL_TREND", metric_key: "training.SESSION_LOAD" }],
            missing_data: []
          }
        };
        const existing = window.__phase4dData.snapshots.findIndex(item => item.id === created.id);
        if (existing >= 0) window.__phase4dData.snapshots[existing] = created;
        else window.__phase4dData.snapshots.unshift(created);
        return { snapshotId: "snapshot-2" };
      }
    };

    view.analyticsService = analyticsService;
    view.analyticsOrchestrator = orchestrator;
    view.analyticsPanel.analyticsService = analyticsService;
    view.analyticsPanel.orchestrator = orchestrator;

    document.body.innerHTML = '<main id="dashboard-content-area"></main>';
    window.__phase4dView = view;
    await view.render("dashboard-content-area", PLAYER_ID, TEAM_ID);
  }, { TEAM_ID, TEAM_SEASON_ID, PLAYER_ID });
}

async function runViewport(name, viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);

  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("dialog", async dialog => {
    await dialog.accept();
  });

  await installFixture(page);

  const tabs = await page.locator("[data-p360c-tab]").evaluateAll(nodes =>
    nodes.map(node => node.getAttribute("data-p360c-tab"))
  );
  if (!tabs.includes("analytics")) {
    throw new Error(`[${name}] Falta la pestaña Evolución + IA`);
  }

  await page.locator('[data-p360c-tab="analytics"]').click();

  const initial = await page.evaluate(() => ({
    series: document.querySelectorAll(".p360d-series-card").length,
    associations: document.querySelectorAll(".p360d-association").length,
    insights: document.querySelectorAll(".p360d-insight").length,
    reviewButtons: document.querySelectorAll(".p360d-review-insight").length,
    hasNoCausalityCopy: (document.querySelector(".p360d-panel")?.textContent || "")
      .includes("no demuestra causalidad"),
    hasProviderSafetyCopy: (document.querySelector(".p360d-panel")?.textContent || "")
      .includes("No se almacenan claves de proveedor"),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  }));

  if (initial.series !== 2) throw new Error(`[${name}] Series longitudinales incorrectas`);
  if (initial.associations !== 1) throw new Error(`[${name}] Asociación descriptiva no renderizada`);
  if (initial.insights !== 1) throw new Error(`[${name}] Insight IA no renderizado`);
  if (initial.reviewButtons !== 2) throw new Error(`[${name}] Controles de revisión incorrectos`);
  if (!initial.hasNoCausalityCopy) throw new Error(`[${name}] Falta advertencia de no causalidad`);
  if (!initial.hasProviderSafetyCopy) throw new Error(`[${name}] Falta aviso de seguridad del proveedor IA`);
  if (initial.overflow) throw new Error(`[${name}] Overflow horizontal en analítica`);

  await page.locator(".p360d-review-notes").fill("Revisión humana UI");
  await page.locator('.p360d-review-insight[data-review-status="APPROVED"]').click();
  await page.waitForFunction(() => window.__phase4dCalls.review.length === 1);
  await page.waitForFunction(() =>
    (document.querySelector(".p360d-insight")?.textContent || "").includes("Aprobado")
  );

  const reviewCall = await page.evaluate(() => window.__phase4dCalls.review[0]);
  if (reviewCall.insightId !== "insight-1" || reviewCall.status !== "APPROVED") {
    throw new Error(`[${name}] Revisión IA usa alcance/estado incorrecto`);
  }
  if (reviewCall.notes !== "Revisión humana UI") {
    throw new Error(`[${name}] No se conserva la nota de revisión`);
  }

  await page.fill("#p360d-period-from", "2026-03-01");
  await page.fill("#p360d-period-to", "2026-05-15");
  await page.locator("#p360d-generate-form button[type=submit]").click();
  await page.waitForFunction(() => window.__phase4dCalls.generate.length === 1);
  await page.waitForFunction(() =>
    document.querySelector("#p360d-snapshot-select")?.value === "snapshot-2"
  );

  const result = await page.evaluate(() => ({
    generate: window.__phase4dCalls.generate[0],
    review: window.__phase4dCalls.review[0],
    externalProviderCalls: window.__phase4dCalls.externalProviderCalls,
    selectedSnapshot: document.querySelector("#p360d-snapshot-select")?.value || "",
    series: document.querySelectorAll(".p360d-series-card").length,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    panelWidth: document.querySelector(".p360d-panel")?.getBoundingClientRect().width || 0,
    viewportWidth: window.innerWidth
  }));

  if (result.generate.teamId !== TEAM_ID) throw new Error(`[${name}] Snapshot usa teamId incorrecto`);
  if (result.generate.teamSeasonId !== TEAM_SEASON_ID) throw new Error(`[${name}] Snapshot usa team-season incorrecto`);
  if (result.generate.playerId !== PLAYER_ID) throw new Error(`[${name}] Snapshot usa jugador incorrecto`);
  if (result.generate.periodStart !== "2026-03-01" || result.generate.periodEnd !== "2026-05-15") {
    throw new Error(`[${name}] Snapshot usa periodo incorrecto`);
  }
  if (result.externalProviderCalls !== 0) {
    throw new Error(`[${name}] La UI ha intentado llamar a un proveedor externo`);
  }
  if (result.selectedSnapshot !== "snapshot-2") {
    throw new Error(`[${name}] No se selecciona el snapshot recién generado`);
  }
  if (result.series !== 1) throw new Error(`[${name}] Snapshot generado no refresca series`);
  if (result.overflow || result.panelWidth > result.viewportWidth + 1) {
    throw new Error(`[${name}] Geometría responsive inválida: ${JSON.stringify(result)}`);
  }

  const relevantConsoleErrors = consoleErrors.filter(message =>
    !/favicon|Failed to load resource.*404/i.test(message)
  );
  if (pageErrors.length) throw new Error(`[${name}] pageerror: ${pageErrors.join(" | ")}`);
  if (relevantConsoleErrors.length) {
    throw new Error(`[${name}] console error: ${relevantConsoleErrors.join(" | ")}`);
  }

  console.log(JSON.stringify({ viewport: name, initial, result, status: "PASS" }));
  await browser.close();
}

for (const spec of [
  { name: "desktop-1440x900", viewport: { width: 1440, height: 900 } },
  { name: "iphone-390x844", viewport: { width: 390, height: 844 } }
]) {
  await runViewport(spec.name, spec.viewport);
}

console.log("PLAYER360_PHASE4D_UI_OK");
