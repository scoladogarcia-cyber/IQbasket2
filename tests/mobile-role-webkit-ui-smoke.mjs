import { chromium, webkit } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.GLOBAL_UI_QA_BASE_URL || "http://127.0.0.1:4173/";
const BROWSER_NAME = String(process.env.QA_BROWSER || "chromium").toLowerCase();
const browserType = BROWSER_NAME === "webkit" ? webkit : chromium;
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYER_ID = "10000000-0000-4000-8000-000000000001";

const roles = [
  { role: "JUGADOR", playerId: PLAYER_ID, linkedPlayerIds: [] },
  { role: "FAMILIA_TUTOR", playerId: null, linkedPlayerIds: [PLAYER_ID] }
];

function assertCondition(condition, scope, message, detail = null) {
  if (!condition) {
    throw new Error(`[${BROWSER_NAME}][${scope}] ${message}${detail ? ` · ${JSON.stringify(detail)}` : ""}`);
  }
}

async function installFixture(page, spec) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ spec, TEAM_ID, TEAM_SEASON_ID }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { LayoutView } = await import("/views/LayoutView.js");
    const app = window.iqApp;

    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
    DataStore.getActiveSeasonContext = () => ({
      team_season_id: TEAM_SEASON_ID,
      team_id: TEAM_ID,
      name: "2025/2026",
      start_date: "2025-09-01",
      end_date: "2026-06-30"
    });
    DataStore.getActiveSeasonDisplayName = () => "2025/2026";
    DataStore.getActiveSeason = () => "2025/2026";
    DataStore.getTeams = () => [{ id: TEAM_ID, name: "Equipo QA", category: "U16" }];
    DataStore.getSeasons = () => [{ team_season_id: TEAM_SEASON_ID, team_id: TEAM_ID, name: "2025/2026" }];

    app.isAuthenticated = true;
    app.teamId = TEAM_ID;
    app.permissionService.setCurrentUser({
      id: `qa-${spec.role.toLowerCase()}`,
      email: `${spec.role.toLowerCase()}@example.test`,
      role: spec.role,
      global_role: null,
      playerId: spec.playerId,
      linkedPlayerIds: spec.linkedPlayerIds,
      assigned_team_ids: [TEAM_ID],
      allowed_team_season_ids: [TEAM_SEASON_ID]
    });
    DataStore.setPermissionService(app.permissionService);

    localStorage.setItem("iq_user_email", `${spec.role.toLowerCase()}@example.test`);
    localStorage.setItem("iq_user_role", spec.role);
    localStorage.setItem("iq_active_team_id", TEAM_ID);
    localStorage.setItem("iq_active_season", "2025/2026");

    document.getElementById("app").innerHTML = LayoutView.wrap(
      '<section style="min-height:1100px;padding:16px">Mobile role QA</section>',
      "dashboard",
      spec.role
    );
    LayoutView.bindMobileDrawerEvents();
    app.bindLayoutEvents();
  }, { spec, TEAM_ID, TEAM_SEASON_ID });
}

async function inspectRole(browser, spec) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await installFixture(page, spec);

  const shell = await page.evaluate(() => {
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const route = key => {
      const el = document.querySelector(`[data-route-key="${key}"]`);
      return el ? {
        href: el.getAttribute("href") || "",
        locked: el.classList.contains("disabled-link"),
        text: el.textContent.trim()
      } : null;
    };
    const myPlayer = document.querySelector('.mobile-bottom-bar [data-route-key="player360"], .mobile-bottom-bar [data-route-key="family"]');
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      headerVisible: visible(document.querySelector(".mobile-header")),
      bottomVisible: visible(document.querySelector(".mobile-bottom-bar")),
      sidebarVisible: visible(document.querySelector(".app-sidebar")),
      training: route("training"),
      nutrition: route("nutrition"),
      myPlayer: myPlayer ? {
        key: myPlayer.getAttribute("data-route-key"),
        href: myPlayer.getAttribute("href") || "",
        rect: myPlayer.getBoundingClientRect().toJSON()
      } : null,
      bottomTargets: [...document.querySelectorAll(".mobile-bottom-bar .mobile-nav-item")].map(el => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      })
    };
  });

  assertCondition(!shell.overflow, spec.role, "Hay overflow horizontal", shell);
  assertCondition(shell.headerVisible && shell.bottomVisible && !shell.sidebarVisible, spec.role, "Shell móvil incorrecto", shell);
  assertCondition(shell.training?.locked === true, spec.role, "Entrenamientos debe quedar bloqueado para este perfil", shell.training);
  assertCondition(shell.nutrition?.locked === false && shell.nutrition?.href === "#/nutrition", spec.role, "Nutrición debe estar accesible", shell.nutrition);
  for (const target of shell.bottomTargets) {
    assertCondition(target.width >= 44 && target.height >= 44, spec.role, "Target inferior menor de 44px", target);
  }

  if (spec.role === "JUGADOR") {
    assertCondition(shell.myPlayer?.key === "player360", spec.role, "El acceso Mi desarrollo debe apuntar a Player 360", shell.myPlayer);
    assertCondition(shell.myPlayer?.href === `#/player360/${PLAYER_ID}`, spec.role, "Ruta propia de Player 360 incorrecta", shell.myPlayer);
  } else {
    assertCondition(shell.myPlayer?.key === "family" && shell.myPlayer?.href === "#/family", spec.role, "Family debe abrir Mis jugadores", shell.myPlayer);
  }

  await page.click("#btn-mobile-more-toggle");
  await page.waitForTimeout(360);
  const drawer = await page.evaluate(() => {
    const overlay = document.querySelector("#mobile-more-drawer");
    const content = overlay?.querySelector(".mobile-drawer-content");
    const rect = content?.getBoundingClientRect();
    return {
      open: overlay?.classList.contains("open") || false,
      ariaHidden: overlay?.getAttribute("aria-hidden"),
      top: rect?.top ?? null,
      bottom: rect?.bottom ?? null,
      viewportHeight: window.visualViewport?.height || window.innerHeight,
      overflowY: content ? getComputedStyle(content).overflowY : ""
    };
  });
  assertCondition(drawer.open && drawer.ariaHidden === "false", spec.role, "El drawer no abre correctamente", drawer);
  assertCondition(drawer.top >= -1 && drawer.bottom <= drawer.viewportHeight + 1, spec.role, "El drawer sale del viewport", drawer);
  assertCondition(["auto", "scroll"].includes(drawer.overflowY), spec.role, "El drawer no permite scroll", drawer);
  await page.click("#btn-close-drawer");

  for (const [overlayClass, cardClass] of [
    ["modal-overlay", "modal-content"],
    ["iq-modal-overlay", "iq-modal-card"],
    ["season-v3-modal", "season-v3-modal-card"],
    ["privacy-modal-overlay", "privacy-modal"],
    ["hud-modal-overlay", "hud-modal-content"]
  ]) {
    const modal = await page.evaluate(({ overlayClass, cardClass }) => {
      const overlay = document.createElement("div");
      overlay.className = overlayClass;
      overlay.style.display = "flex";
      const card = document.createElement("div");
      card.className = cardClass;
      card.innerHTML = '<div style="height:1400px;padding:12px">Long modal</div>';
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      const rect = card.getBoundingClientRect();
      const state = {
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.visualViewport?.height || window.innerHeight,
        overflowY: getComputedStyle(card).overflowY,
        clientHeight: card.clientHeight,
        scrollHeight: card.scrollHeight
      };
      overlay.remove();
      return state;
    }, { overlayClass, cardClass });
    assertCondition(modal.top >= -1 && modal.bottom <= modal.viewportHeight + 1, spec.role, `${cardClass} sale del viewport`, modal);
    assertCondition(["auto", "scroll"].includes(modal.overflowY) && modal.scrollHeight > modal.clientHeight, spec.role, `${cardClass} no permite scroll`, modal);
  }

  assertCondition(pageErrors.length === 0, spec.role, "Se produjeron pageerror", pageErrors);
  console.log(JSON.stringify({ browser: BROWSER_NAME, role: spec.role, shell, drawer, result: "PASS" }));
  await page.close();
}

const browser = await browserType.launch({ headless: true });
try {
  for (const spec of roles) await inspectRole(browser, spec);
  console.log(`MOBILE_ROLE_${BROWSER_NAME.toUpperCase()}_UI_OK`);
} finally {
  await browser.close();
}
