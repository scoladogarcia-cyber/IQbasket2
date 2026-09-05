import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.GLOBAL_UI_QA_BASE_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: "compact", width: 320, height: 568 },
  { name: "iphone", width: 390, height: 844 }
];

const results = [];
for (const viewport of viewports) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await installBrowserNetworkStubs(page);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const { BusinessMetricsView } = await import("/views/admin/BusinessMetricsView.js");
    const pilotPermissions = new Set([
      "VIEW_FAMILY_PILOT", "ENROLL_FAMILY_PILOT", "REVOKE_FAMILY_PILOT"
    ]);
    const auth = { canPreview: permission => pilotPermissions.has(permission) };
    const view = new BusinessMetricsView({ rpc: async () => ({ data: {}, error: null }) }, auth);
    view.service.getMetrics = async () => ({
      unique_users: 12, unique_players: 17, offer_views: 20, interest_clicks: 5, interest_rate: 25,
      family_plans: { FAMILY_FREE: "ACTIVE", FAMILY: "DRAFT", FAMILY_PRO: "DRAFT" },
      events: { FAMILY_WORKSPACE_VIEWED: 42, FAMILY_PLAN_INTEREST_CLICKED: 5 }
    });
    view.pilotService.getSnapshot = async () => ({
      pilotCode: "FAMILY_VALUE_V1",
      activeCount: 1,
      expiredCount: 2,
      revokedCount: 1,
      includesAi: false,
      includesSensitiveModules: false,
      candidates: [
        {
          owner_user_id: "11111111-1111-4111-8111-111111111111",
          owner_name: "Familia Demo",
          owner_email: "family@example.test",
          player_id: "22222222-2222-4222-8222-222222222222",
          player_name: "Jugador Demo",
          eligible: true,
          active_enrollment_id: null
        }
      ],
      enrollments: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          owner_name: "Familia Activa",
          player_name: "Jugador Activo",
          status: "ACTIVE",
          ends_at: "2026-10-03T10:00:00Z"
        }
      ]
    });
    const host = document.createElement("div");
    document.body.innerHTML = "";
    document.body.appendChild(host);
    await view.render(host);
    const readiness = host.querySelector("[data-family-commercial-readiness]");
    const pilot = host.querySelector("[data-family-pilot]");
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      text: host.textContent,
      kpis: host.querySelectorAll(".biz-kpis article").length,
      readinessPresent: Boolean(readiness),
      readinessPills: readiness?.querySelectorAll(".biz-readiness-pill").length || 0,
      blockedPills: readiness?.querySelectorAll(".biz-readiness-pill.is-blocked").length || 0,
      blockerCodes: readiness?.querySelectorAll("code").length || 0,
      pilotPresent: Boolean(pilot),
      pilotCounts: pilot?.querySelectorAll(".biz-pilot-counts span").length || 0,
      pilotEnrollButton: Boolean(pilot?.querySelector("[data-pilot-enroll]")),
      pilotRevokeButton: Boolean(pilot?.querySelector("[data-pilot-revoke]")),
      candidateOptions: pilot?.querySelectorAll("[data-pilot-candidate] option").length || 0
    };
  });

  if (result.overflow) throw new Error(`[${viewport.name}] Business metrics overflows mobile: ${JSON.stringify(result)}`);
  if (result.kpis !== 4) throw new Error(`[${viewport.name}] Business metrics must show four KPIs: ${JSON.stringify(result)}`);
  if (!result.text.includes("25%") || !result.text.includes("FAMILY_PRO")) throw new Error(`[${viewport.name}] Business metrics content missing: ${JSON.stringify(result)}`);
  if (!result.readinessPresent || result.readinessPills !== 2) throw new Error(`[${viewport.name}] Commercial readiness card missing: ${JSON.stringify(result)}`);
  if (result.blockedPills !== 2 || result.blockerCodes < 2) throw new Error(`[${viewport.name}] Commercial readiness must fail closed by default: ${JSON.stringify(result)}`);
  if (!result.pilotPresent || result.pilotCounts !== 3) throw new Error(`[${viewport.name}] Family pilot card missing: ${JSON.stringify(result)}`);
  if (!result.pilotEnrollButton || !result.pilotRevokeButton || result.candidateOptions !== 1) {
    throw new Error(`[${viewport.name}] Family pilot actions missing: ${JSON.stringify(result)}`);
  }
  if (!result.text.includes("Sin IA, Wellness ni Nutrición") || !result.text.includes("28 días")) {
    throw new Error(`[${viewport.name}] Family pilot guardrails missing: ${JSON.stringify(result)}`);
  }
  results.push({ viewport: viewport.name, ...result });
  await page.close();
}

console.log(JSON.stringify({ result: "BUSINESS_METRICS_UI_SMOKE_OK", results }));
await browser.close();
