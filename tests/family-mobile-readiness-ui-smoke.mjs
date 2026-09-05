import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.GLOBAL_UI_QA_BASE_URL || "http://127.0.0.1:4173/";
const PLAYER = "33333333-3333-4333-8333-333333333333";

function assert(condition, viewport, message, detail = null) {
  if (!condition) throw new Error(`[${viewport}] ${message}${detail ? ` · ${JSON.stringify(detail)}` : ""}`);
}

async function installBase(page) {
  await installBrowserNetworkStubs(page);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });
}

async function renderScenario(page, planCode) {
  return page.evaluate(async ({ PLAYER, planCode }) => {
    const { FamilyWorkspaceView } = await import("/views/family/FamilyWorkspaceView.js");
    const view = new FamilyWorkspaceView({ rpc: async () => ({ data: null, error: null }) }, null);
    const analytics = [];
    let claimed = false;
    view.analytics.trackSafely = async event => { analytics.push(event); return "event"; };
    view.analytics.trackOncePerSession = async event => { analytics.push(event); return "event"; };
    view.service.listPlayers = async () => [{ player_id: PLAYER, first_name: "Alex", last_name: "Ready" }];
    view.service.bootstrapFree = async () => ({ plan_code: planCode });
    view.service.getProductSnapshot = async () => ({ plan_code: planCode, subject_covered: true });
    view.service.getPassport = async () => ({
      player: { id: PLAYER, first_name: "Alex", last_name: "Ready" },
      career_totals: { games: 16, minutes: 380 },
      recent_games: Array.from({ length: 10 }, (_, i) => ({ points: 8 + i, minutes: 20 + i })),
      career: [{ season_name: "2025/2026", team_name: "Ready U16", club_name: "IQ Club", games: 16, points: 144 }]
    });
    view.service.getPlayer360Snapshot = async () => planCode === "FAMILY"
      ? {
          allowed: true,
          recent_games: Array.from({ length: 8 }, (_, i) => ({ points: 9 + i, rebounds: 4, assists: 3, minutes: 24, fg3_made: 1, fg3_attempted: 3 })),
          objective: { title: "Mejorar lectura de ventaja" },
          shared_evaluations: []
        }
      : { allowed: false, reason_code: "ENTITLEMENT_NOT_INCLUDED" };
    view.service.getDevelopmentContext = async () => planCode === "FAMILY"
      ? {
          allowed: true,
          objective: { title: "Mejorar lectura de ventaja", targets: [{ metric_code: "DECISION", metric_name: "Lectura de ventaja", priority_weight: 3 }] },
          recent_training: [{ session_id: "t1", title: "Ventajas", attendance_status: "PRESENT", participated_minutes: 70 }],
          recent_external_development: [{ session_id: "e1", title: "Tecnificación", objective: "Lectura", duration_minutes: 60 }],
          recent_games: [{ game_id: "g1", opponent: "Rival", points: 12, minutes: 25 }]
        }
      : { allowed: false, reason_code: "ENTITLEMENT_NOT_INCLUDED" };
    view.service.claimLink = async () => { claimed = true; return { player_id: PLAYER, claimed: true }; };

    const host = document.createElement("div");
    host.id = `family-readiness-${planCode.toLowerCase()}`;
    document.body.innerHTML = "";
    document.body.appendChild(host);
    await view.render(host, { id: PLAYER });
    await new Promise(resolve => setTimeout(resolve, 20));

    const form = host.querySelector("[data-family-claim-form]");
    const claimButton = form?.querySelector('button[type="submit"]');
    const claimInput = form?.querySelector('[name="claimCode"]');
    const buttonRect = claimButton?.getBoundingClientRect() || { height: 0, width: 0 };
    const inputRect = claimInput?.getBoundingClientRect() || { height: 0, width: 0 };

    const aiPreview = host.querySelector(".family-ai-preview")?.textContent || "";
    const activeAiButtons = [...host.querySelectorAll(".family-ai-preview button")].filter(button => !button.disabled).length;
    const locked = host.querySelector(".family-locked")?.textContent || "";
    const weekly = host.querySelector("[data-family-weekly-plan]")?.textContent || "";
    const offer = host.querySelector(".family-conversion")?.textContent || "";
    const disclaimer = [...host.querySelectorAll(".family-disclaimer")].map(node => node.textContent || "").join(" | ");
    if (claimInput && form) {
      claimInput.value = "12345678-1234-4123-8123-123456789abc";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return {
      planCode,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      claimButtonHeight: buttonRect.height,
      claimInputHeight: inputRect.height,
      claimed,
      aiPreview,
      activeAiButtons,
      locked,
      weekly,
      offer,
      disclaimer,
      analytics: analytics.map(event => event.eventCode),
      title: host.querySelector("#family-title")?.textContent || ""
    };
  }, { PLAYER, planCode });
}

async function runViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await installBase(page);

  const free = await renderScenario(page, "FAMILY_FREE");
  assert(!free.overflowX, name, "Family Free desborda horizontalmente", free);
  assert(free.claimButtonHeight >= 44, name, "CTA de vinculación demasiado pequeño", free);
  assert(free.claimInputHeight >= 44, name, "Input de invitación demasiado pequeño", free);
  assert(free.claimed, name, "Vincular jugador no llama al servicio", free);
  assert(free.locked.includes("Disponible en Family"), name, "Family Free no mantiene capacidades premium cerradas", free);
  assert(!free.aiPreview, name, "Family Free no debe promocionar IA Pro antes de Family", free);
  assert(free.offer.includes("Desbloquea la evolución completa"), name, "Falta conversión contextual basada en evidencia", free);

  const family = await renderScenario(page, "FAMILY");
  assert(!family.overflowX, name, "Family desborda horizontalmente", family);
  assert(family.weekly.includes("Lectura de ventaja"), name, "Family pierde el foco semanal compartido", family);
  assert(family.weekly.includes("1 entrenos · 1 tecnificaciones · 1 partidos"), name, "Family pierde evidencia conectada", family);
  assert(family.aiPreview.includes("todavía no activados"), name, "Family Pro IA no comunica estado desactivado", family);
  assert(family.aiPreview.includes("calidad, coste y privacidad"), name, "Preview IA no explica gate de piloto", family);
  assert(family.activeAiButtons === 0, name, "Existe un CTA de IA activo antes del piloto", family);
  assert(family.disclaimer.includes("no prescribe cargas") || family.disclaimer.includes("no atribuye causas"), name, "Faltan límites explícitos del producto", family);
  assert(pageErrors.length === 0, name, "pageerror durante Family mobile readiness", pageErrors);

  console.log(JSON.stringify({ viewport: name, free: "PASS", family: "PASS" }));
  await page.close();
}
const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, "compact-320x568", { width: 320, height: 568 });
  await runViewport(browser, "iphone-390x844", { width: 390, height: 844 });
  await runViewport(browser, "landscape-844x390", { width: 844, height: 390 });
  console.log("FAMILY_MOBILE_READINESS_UI_OK");
} finally {
  await browser.close();
}
