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
  const PLAYER = "11111111-1111-4111-8111-111111111111";
  const view = new FamilyWorkspaceView({ rpc: async () => ({ data: null, error: null }) }, null);
  let claimed = false;
  const analyticsEvents = [];
  view.analytics.trackSafely = async event => { analyticsEvents.push(event); return "event"; };
  view.analytics.trackOncePerSession = async event => { analyticsEvents.push(event); return "event"; };
  view.service.listPlayers = async () => [{ player_id: PLAYER, first_name: "Alex", last_name: "Demo" }];
  view.service.bootstrapFree = async () => ({ plan_code: "FAMILY_FREE" });
  view.service.getProductSnapshot = async () => ({ plan_code: "FAMILY_FREE", subject_covered: true });
  view.service.getPassport = async () => ({
    player: { id: PLAYER, first_name: "Alex", last_name: "Demo" },
    career_totals: { games: 18, minutes: 410 },
    recent_games: Array.from({ length: 10 }, () => ({})),
    career: [{ season_name: "2025/2026", team_name: "Demo U16", club_name: "IQ Club", games: 18, points: 132 }]
  });
  view.service.getPlayer360Snapshot = async () => ({ allowed: false, reason_code: "ENTITLEMENT_NOT_INCLUDED" });
  view.service.claimLink = async () => { claimed = true; return { claimed: true }; };
  const host = document.createElement("div");
  host.id = "family-smoke-host";
  document.body.innerHTML = "";
  document.body.appendChild(host);
  await view.render(host, { id: PLAYER });

  const rect = host.getBoundingClientRect();
  const strip = [...host.querySelectorAll(".family-value-strip span")].map(node => node.textContent.trim());
  const locked = host.querySelector(".family-locked")?.textContent || "";
  const career = host.querySelector(".family-career-row")?.textContent || "";
  const dashboard = host.querySelector(".family-dashboard")?.textContent || "";
  const offer = host.querySelector(".family-conversion")?.textContent || "";
  host.querySelector("[data-family-interest]")?.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  const form = host.querySelector("[data-family-claim-form]");
  form.querySelector('[name="claimCode"]').value = "12345678-1234-4123-8123-123456789abc";
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  return {
    width: rect.width,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    strip,
    locked,
    career,
    dashboard,
    offer,
    analyticsEvents: analyticsEvents.map(event => event.eventCode),
    claimed,
    title: host.querySelector("#family-title")?.textContent || ""
  };
});

if (result.overflowX) throw new Error(`Family workspace desborda en móvil: ${JSON.stringify(result)}`);
if (result.strip.length !== 4) throw new Error(`Debe mostrar las 4 etapas de valor: ${JSON.stringify(result)}`);
if (!result.locked.includes("Disponible en Family")) throw new Error(`Family Free debe mantener Player360 bloqueado: ${JSON.stringify(result)}`);
if (!result.career.includes("Demo U16")) throw new Error(`El pasaporte debe mostrar trayectoria: ${JSON.stringify(result)}`);
if (!result.dashboard.includes("Lo importante, de un vistazo")) throw new Error(`Debe renderizar dashboard familiar: ${JSON.stringify(result)}`);
if (!result.offer.includes("Desbloquea la evolución completa")) throw new Error(`Debe mostrar oferta contextual con evidencia suficiente: ${JSON.stringify(result)}`);
if (!result.analyticsEvents.includes("FAMILY_PLAN_INTEREST_CLICKED")) throw new Error(`Debe medir interés sin iniciar cobro: ${JSON.stringify(result)}`);
if (!result.claimed) throw new Error(`El formulario de vinculación debe invocar el servicio: ${JSON.stringify(result)}`);
if (!result.title.includes("Alex Demo")) throw new Error(`Debe presentar el jugador: ${JSON.stringify(result)}`);

console.log(JSON.stringify({ result: "FAMILY_WORKSPACE_UI_SMOKE_OK", ...result }));
await browser.close();
