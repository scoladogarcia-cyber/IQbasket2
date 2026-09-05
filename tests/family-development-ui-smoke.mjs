import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.GLOBAL_UI_QA_BASE_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await installBrowserNetworkStubs(page);
await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

const result = await page.evaluate(async () => {
  const { FamilyWorkspaceView } = await import("/views/family/FamilyWorkspaceView.js");
  const PLAYER = "22222222-2222-4222-8222-222222222222";
  const view = new FamilyWorkspaceView({ rpc: async () => ({ data: null, error: null }) }, null);
  const analyticsEvents = [];
  view.analytics.trackSafely = async event => { analyticsEvents.push(event); return "event"; };
  view.analytics.trackOncePerSession = async event => { analyticsEvents.push(event); return "event"; };
  view.service.listPlayers = async () => [{ player_id: PLAYER, first_name: "Alex", last_name: "Family" }];
  view.service.bootstrapFree = async () => ({ plan_code: "FAMILY" });
  view.service.getProductSnapshot = async () => ({ plan_code: "FAMILY", subject_covered: true });
  view.service.getPassport = async () => ({
    player: { id: PLAYER, first_name: "Alex", last_name: "Family" },
    career_totals: { games: 14, minutes: 322 },
    recent_games: Array.from({ length: 10 }, (_, i) => ({ points: 8 + i, minutes: 20 + i })),
    career: [{ season_name: "2025/2026", team_name: "Demo U16", games: 14, points: 128 }]
  });  view.service.getPlayer360Snapshot = async () => ({
    allowed: true,
    recent_games: Array.from({ length: 8 }, (_, i) => ({ points: 7 + i, rebounds: 4, assists: 2, minutes: 22, fg3_made: 1, fg3_attempted: 3 })),
    objective: { title: "Mejorar lectura de ventaja" },
    shared_evaluations: []
  });
  view.service.getDevelopmentContext = async () => ({
    allowed: true,
    reason_code: "ENTITLED",
    objective: {
      title: "Mejorar lectura de ventaja",
      targets: [
        { metric_code: "DECISION", metric_name: "Lectura de ventaja", priority_weight: 3 },
        { metric_code: "FINISH", metric_name: "Finalización", priority_weight: 1 }
      ]
    },
    recent_training: [{ session_id: "t1", title: "Ventajas", attendance_status: "PRESENT", participated_minutes: 70 }],
    recent_external_development: [{ session_id: "e1", title: "Tecnificación", objective: "Lectura", duration_minutes: 60 }],
    recent_games: [{ game_id: "g1", opponent: "Rival", points: 12, minutes: 25 }]
  });

  const host = document.createElement("div");
  host.id = "family-development-smoke-host";
  document.body.innerHTML = "";
  document.body.appendChild(host);
  await view.render(host, { id: PLAYER });
  await new Promise(resolve => setTimeout(resolve, 20));
  const plan = host.querySelector("[data-family-weekly-plan]")?.textContent || "";
  const ai = host.querySelector(".family-ai-preview")?.textContent || "";
  const disabledAiButtons = [...host.querySelectorAll(".family-ai-preview button")].filter(button => !button.disabled).length;
  return {
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    plan,
    ai,
    disabledAiButtons,
    analyticsEvents: analyticsEvents.map(event => event.eventCode),
    cards: host.querySelectorAll(".family-ai-grid article").length
  };
});

if (result.overflowX) throw new Error(`Family development desborda en móvil: ${JSON.stringify(result)}`);
if (!result.plan.includes("Lectura de ventaja")) throw new Error(`El plan debe respetar el objetivo compartido: ${JSON.stringify(result)}`);
if (!result.plan.includes("1 entrenos · 1 tecnificaciones · 1 partidos")) throw new Error(`Debe mostrar evidencia conectada: ${JSON.stringify(result)}`);
if (!result.plan.includes("no prescribe cargas")) throw new Error(`Debe mantener disclaimer de límites: ${JSON.stringify(result)}`);
if (!result.ai.includes("todavía no activados") || !result.ai.includes("En preparación")) throw new Error(`La IA debe permanecer en preview: ${JSON.stringify(result)}`);
if (result.cards !== 4 || result.disabledAiButtons !== 0) throw new Error(`No debe existir CTA IA activo: ${JSON.stringify(result)}`);
if (!result.analyticsEvents.includes("FAMILY_WEEKLY_PLAN_VIEWED")) throw new Error(`Debe medir valor del plan semanal: ${JSON.stringify(result)}`);
if (!result.analyticsEvents.includes("FAMILY_TRAINING_VALUE_VIEWED") || !result.analyticsEvents.includes("FAMILY_TECHNIFICATION_VALUE_VIEWED")) throw new Error(`Debe medir conexión de desarrollo: ${JSON.stringify(result)}`);

console.log(JSON.stringify({ result: "FAMILY_DEVELOPMENT_UI_SMOKE_OK", ...result }));
await browser.close();