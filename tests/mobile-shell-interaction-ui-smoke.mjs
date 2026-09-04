import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.GLOBAL_UI_QA_BASE_URL || "http://127.0.0.1:4173/";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function assertCondition(condition, message, detail = null) {
  if (!condition) throw new Error(`${message}${detail ? ` · ${JSON.stringify(detail)}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await installBrowserNetworkStubs(page);
await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

await page.evaluate(async ({ TEAM_ID, TEAM_SEASON_ID }) => {
  const { DataStore } = await import("/services/DataStore.js");
  const { LayoutView } = await import("/views/LayoutView.js");
  const app = window.iqApp;
  DataStore.getActiveTeamId = () => TEAM_ID;
  DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
  DataStore.getActiveSeasonContext = () => ({
    team_season_id: TEAM_SEASON_ID,
    team_id: TEAM_ID,
    name: "2025/2026"
  });
  DataStore.getActiveSeasonDisplayName = () => "2025/2026";
  DataStore.getActiveSeason = () => "2025/2026";
  DataStore.getTeams = () => [{ id: TEAM_ID, name: "QA Team", category: "U18" }];
  DataStore.getSeasons = () => [{ team_season_id: TEAM_SEASON_ID, team_id: TEAM_ID, name: "2025/2026" }];

  app.isAuthenticated = true;
  app.teamId = TEAM_ID;
  app.permissionService.setCurrentUser({
    id: "qa-mobile-user",
    email: "qa-mobile@example.test",
    role: "INVITADO",
    assigned_team_ids: [TEAM_ID],
    allowed_team_season_ids: [TEAM_SEASON_ID]
  });
  const renderShell = () => {
    document.getElementById("app").innerHTML = LayoutView.wrap(
      '<section style="min-height:1100px;padding:16px">Mobile shell QA</section>',
      "dashboard",
      "INVITADO"
    );
    LayoutView.bindMobileDrawerEvents();
    app.bindLayoutEvents();
  };

  renderShell();
  renderShell();
  renderShell();
  window.__mobileShellRender = renderShell;
}, { TEAM_ID, TEAM_SEASON_ID });

for (let cycle = 0; cycle < 3; cycle += 1) {
  if (cycle > 0) await page.evaluate(() => window.__mobileShellRender());
  await page.locator("#btn-mobile-more-toggle").click();
  await page.waitForTimeout(350);
  const drawerState = await page.evaluate(() => {
    const overlay = document.querySelector("#mobile-more-drawer");
    const content = overlay?.querySelector(".mobile-drawer-content");
    const rect = content?.getBoundingClientRect();
    return {
      open: overlay?.classList.contains("open") || false,
      ariaHidden: overlay?.getAttribute("aria-hidden"),
      bodyOverflow: getComputedStyle(document.body).overflow,
      top: rect?.top ?? null,
      bottom: rect?.bottom ?? null,
      viewportHeight: window.visualViewport?.height || window.innerHeight,
      overflowY: content ? getComputedStyle(content).overflowY : null
    };
  });
  assertCondition(drawerState.open, "El drawer móvil debe abrirse inmediatamente tras cada re-render", drawerState);
  assertCondition(drawerState.ariaHidden === "false", "El drawer abierto debe exponer aria-hidden=false", drawerState);
  assertCondition(drawerState.top >= -1 && drawerState.bottom <= drawerState.viewportHeight + 1,
    "El drawer debe quedar dentro del viewport visual", drawerState);
  assertCondition(drawerState.overflowY === "auto", "El drawer debe poder desplazarse verticalmente", drawerState);
  await page.locator("#btn-close-drawer").click();
}

await page.evaluate(() => window.__mobileShellRender());
await page.locator("#btn-mobile-more-toggle").click();
await page.locator("#btn-mobile-logout").click();
await page.waitForFunction(() => window.iqApp?.isAuthenticated === false);
const logoutState = await page.evaluate(() => ({
  isAuthenticated: window.iqApp?.isAuthenticated,
  currentRoute: window.iqApp?.currentRoute,
  hash: window.location.hash,
  bodyOverflow: document.body.style.overflow,
  loginVisible: Boolean(document.querySelector("form, #login-form, .auth-container")),
  userEmail: localStorage.getItem("iq_user_email"),
  activeTeam: localStorage.getItem("iq_active_team_id")
}));
assertCondition(logoutState.isAuthenticated === false, "Cerrar sesión móvil debe desautenticar la app", logoutState);
assertCondition(logoutState.currentRoute === "dashboard" && logoutState.hash === "#/dashboard",
  "Logout móvil debe resetear la ruta", logoutState);
assertCondition(!logoutState.userEmail && !logoutState.activeTeam,
  "Logout móvil debe limpiar el contexto local", logoutState);
assertCondition(logoutState.bodyOverflow === "", "Logout móvil debe liberar el scroll del body", logoutState);

const modalPairs = [
  ["modal-overlay", "modal-content"],
  ["iq-modal-overlay", "iq-modal-card"],
  ["season-v3-modal", "season-v3-modal-card"],
  ["privacy-modal-overlay", "privacy-modal"],
  ["hud-modal-overlay", "hud-modal-content"]
];
for (const [overlayClass, cardClass] of modalPairs) {
  const geometry = await page.evaluate(({ overlayClass, cardClass }) => {
    const overlay = document.createElement("div");
    overlay.className = overlayClass;
    overlay.style.display = "flex";
    const card = document.createElement("div");
    card.className = cardClass;
    card.innerHTML = `<div style="height:1400px;padding:12px">Scrollable modal QA</div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    const rect = card.getBoundingClientRect();
    const result = {
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.visualViewport?.height || window.innerHeight,
      overflowY: getComputedStyle(card).overflowY,
      clientHeight: card.clientHeight,
      scrollHeight: card.scrollHeight
    };
    overlay.remove();
    return result;
  }, { overlayClass, cardClass });
  assertCondition(geometry.top >= -1 && geometry.bottom <= geometry.viewportHeight + 1,
    `${cardClass} debe permanecer dentro del viewport`, geometry);
  assertCondition(geometry.overflowY === "auto" && geometry.scrollHeight > geometry.clientHeight,
    `${cardClass} debe ser desplazable si su contenido excede la pantalla`, geometry);
}

await browser.close();
console.log(JSON.stringify({ result: "MOBILE_SHELL_INTERACTION_UI_OK", logout: logoutState, modalPairs: modalPairs.length }));
