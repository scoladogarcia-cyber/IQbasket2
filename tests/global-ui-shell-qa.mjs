import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.GLOBAL_UI_QA_BASE_URL || "http://127.0.0.1:4173/";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const scenarios = [
  { name: "desktop-superadmin-es", role: "SUPERADMIN", locale: "es", viewport: { width: 1440, height: 900 } },
  { name: "tablet-superadmin-es", role: "SUPERADMIN", locale: "es", viewport: { width: 820, height: 1180 } },
  { name: "iphone-superadmin-es", role: "SUPERADMIN", locale: "es", viewport: { width: 390, height: 844 } },
  { name: "iphone-compact-superadmin-es", role: "SUPERADMIN", locale: "es", viewport: { width: 375, height: 667 } },
  { name: "iphone-admin-es", role: "ADMIN", locale: "es", viewport: { width: 390, height: 844 } },
  { name: "iphone-coach-es", role: "ENTRENADOR", locale: "es", viewport: { width: 390, height: 844 } },
  { name: "iphone-invited-es", role: "INVITADO", locale: "es", viewport: { width: 390, height: 844 } },
  { name: "iphone-superadmin-ca", role: "SUPERADMIN", locale: "ca", viewport: { width: 390, height: 844 } },
  { name: "iphone-superadmin-en", role: "SUPERADMIN", locale: "en", viewport: { width: 390, height: 844 } },
  { name: "iphone-superadmin-fr", role: "SUPERADMIN", locale: "fr", viewport: { width: 390, height: 844 } }
];

function assertCondition(condition, scenario, message, detail = null) {
  if (!condition) {
    const suffix = detail ? ` · ${JSON.stringify(detail)}` : "";
    throw new Error(`[${scenario}] ${message}${suffix}`);
  }
}

async function installFixture(page, scenario) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ scenario, TEAM_ID, TEAM_SEASON_ID }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { LayoutView } = await import("/views/LayoutView.js");
    const { TranslationStore } = await import("/services/TranslationStore.js");

    await TranslationStore.setLanguage(scenario.locale);

    // Reproduce a realistic remote translation that is longer than the old
    // one-line mobile slot. This protects the bottom navigation from the
    // "Mapa de ..." truncation seen on iPhone.
    const remoteLikeHeatmapLabels = {
      es: "Mapa de Calor",
      ca: "Mapa de Calor",
      en: "Heat Map",
      fr: "Carte de Chaleur"
    };
    TranslationStore.dictionaries[scenario.locale].heatmap_analysis =
      remoteLikeHeatmapLabels[scenario.locale];

    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
    DataStore.getActiveSeasonContext = () => ({
      team_season_id: TEAM_SEASON_ID,
      team_id: TEAM_ID,
      name: "2025/2026",
      start_date: "2025-09-01",
      end_date: "2026-06-30",
      data_status: "ACTIVE"
    });
    DataStore.getActiveSeasonDisplayName = () => "2025/2026";
    DataStore.getActiveSeason = () => "2025/2026";
    DataStore.getTeams = () => [{ id: TEAM_ID, name: "Mini Femenino", category: "Mini" }];
    DataStore.getSeasons = () => [{
      team_season_id: TEAM_SEASON_ID,
      team_id: TEAM_ID,
      name: "2025/2026",
      source: "v3"
    }];

    const app = window.iqApp;
    app.isAuthenticated = true;
    app.teamId = TEAM_ID;
    app.permissionService.setCurrentUser({
      id: `qa-${scenario.role.toLowerCase()}`,
      email: scenario.role === "SUPERADMIN" ? "scolado@nechigroup.com" : `${scenario.role.toLowerCase()}@example.test`,
      role: scenario.role,
      global_role: scenario.role === "SUPERADMIN" ? "SUPERADMIN" : null,
      assigned_team_ids: [TEAM_ID],
      allowed_team_season_ids: [TEAM_SEASON_ID]
    });

    localStorage.setItem("iq_user_role", scenario.role);
    localStorage.setItem("iq_active_team_id", TEAM_ID);
    localStorage.setItem("iq_active_season", "2025/2026");

    document.getElementById("app").innerHTML = LayoutView.wrap(
      `<section id="qa-shell-content" style="min-height:1200px;padding:16px">
        <h1>QA shell</h1>
        <button id="qa-bottom-action" type="button" style="margin-top:1050px">Acción inferior</button>
      </section>`,
      "dashboard",
      scenario.role
    );
    LayoutView.bindMobileDrawerEvents();
  }, { scenario, TEAM_ID, TEAM_SEASON_ID });

  await page.waitForTimeout(120);
}

async function inspectShell(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const rectInfo = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };

    const parseRgb = (value) => {
      const match = String(value || "").match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/i);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    };

    const luminance = (rgb) => {
      const values = rgb.map(value => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    };

    const contrast = (foreground, background) => {
      const fg = parseRgb(foreground);
      const bg = parseRgb(background);
      if (!fg || !bg) return null;
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    const header = document.querySelector(".mobile-header");
    const bottomBar = document.querySelector(".mobile-bottom-bar");
    const sidebar = document.querySelector(".app-sidebar");
    const brand = document.querySelector(".mobile-brand");
    const brandTitle = document.querySelector(".mobile-brand .brand-title");
    const mobileNavItems = [...document.querySelectorAll(".mobile-bottom-bar .mobile-nav-item")];
    const mobileLabels = mobileNavItems.map(item => {
      const label = item.querySelector(".mobile-label");
      const style = label ? getComputedStyle(label) : null;
      const parentStyle = getComputedStyle(item);
      return {
        key: item.getAttribute("data-route-key") || item.id || "unknown",
        text: label?.textContent?.trim() || "",
        fontSize: style ? parseFloat(style.fontSize) : 0,
        lineHeight: style?.lineHeight || "",
        color: style?.color || "",
        parentColor: parentStyle.color,
        contrast: label && bottomBar ? contrast(style.color, getComputedStyle(bottomBar).backgroundColor) : null,
        clientWidth: label?.clientWidth || 0,
        scrollWidth: label?.scrollWidth || 0,
        clientHeight: label?.clientHeight || 0,
        scrollHeight: label?.scrollHeight || 0,
        rect: rectInfo(item)
      };
    });

    const selectors = [
      document.querySelector("#mobile-select-team"),
      document.querySelector("#mobile-select-season"),
      document.querySelector(".mobile-lang-box")
    ].filter(Boolean).map(rectInfo);

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      globalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      mobile: {
        headerVisible: visible(header),
        bottomVisible: visible(bottomBar),
        sidebarVisible: visible(sidebar),
        headerRect: rectInfo(header),
        bottomRect: rectInfo(bottomBar),
        selectors,
        brandFontSize: brandTitle ? parseFloat(getComputedStyle(brandTitle).fontSize) : 0,
        brandParentFontSize: brand ? parseFloat(getComputedStyle(brand).fontSize) : 0,
        brandContrast: brandTitle && header
          ? contrast(getComputedStyle(brandTitle).color, getComputedStyle(header).backgroundColor)
          : null,
        navLabels: mobileLabels
      },
      desktop: {
        sidebarVisible: visible(sidebar),
        headerVisible: visible(header),
        bottomVisible: visible(bottomBar),
        sidebarRect: rectInfo(sidebar),
        navFontSizes: [...document.querySelectorAll(".app-sidebar .nav-link")].map(link => ({
          parent: parseFloat(getComputedStyle(link).fontSize),
          label: parseFloat(getComputedStyle(link.querySelector(".nav-label")).fontSize)
        }))
      }
    };
  });
}

async function inspectDrawer(page) {
  await page.click("#btn-mobile-more-toggle");
  await page.waitForSelector("#mobile-more-drawer", { state: "visible" });
  await page.waitForTimeout(80);

  return page.evaluate(() => {
    const drawer = document.querySelector("#mobile-more-drawer");
    const content = drawer?.querySelector(".mobile-drawer-content");
    const contentRect = content?.getBoundingClientRect();
    const items = [...(content?.querySelectorAll(".drawer-item") || [])].map(item => {
      const rect = item.getBoundingClientRect();
      const label = item.querySelector("span:last-child");
      return {
        text: label?.textContent?.trim() || "",
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        labelFontSize: label ? parseFloat(getComputedStyle(label).fontSize) : 0,
        parentFontSize: parseFloat(getComputedStyle(item).fontSize)
      };
    });
    return {
      content: contentRect ? {
        top: contentRect.top,
        bottom: contentRect.bottom,
        height: contentRect.height
      } : null,
      innerHeight: window.innerHeight,
      overflowY: content ? getComputedStyle(content).overflowY : "",
      items
    };
  });
}

async function runScenario(browser, scenario) {
  const page = await browser.newPage({ viewport: scenario.viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await installFixture(page, scenario);
  const shell = await inspectShell(page);
  const isMobileLayout = scenario.viewport.width < 1024;

  assertCondition(!shell.globalOverflow, scenario.name, "Hay overflow horizontal global", shell.viewport);
  assertCondition(pageErrors.length === 0, scenario.name, "Se produjeron pageerror", pageErrors);

  if (isMobileLayout) {
    assertCondition(shell.mobile.headerVisible, scenario.name, "La cabecera móvil no es visible");
    assertCondition(shell.mobile.bottomVisible, scenario.name, "La navegación inferior no es visible");
    assertCondition(!shell.mobile.sidebarVisible, scenario.name, "El sidebar desktop aparece en layout móvil");

    const headerRect = shell.mobile.headerRect;
    const bottomRect = shell.mobile.bottomRect;
    assertCondition(
      headerRect && headerRect.left >= -1 && headerRect.right <= shell.viewport.width + 1,
      scenario.name,
      "La cabecera sale del viewport",
      headerRect
    );
    assertCondition(
      bottomRect && bottomRect.left >= -1 && bottomRect.right <= shell.viewport.width + 1,
      scenario.name,
      "La navegación inferior sale del viewport",
      bottomRect
    );

    for (const rect of shell.mobile.selectors) {
      assertCondition(rect.left >= -1 && rect.right <= shell.viewport.width + 1, scenario.name, "Selector móvil fuera de viewport", rect);
      assertCondition(rect.height >= 32, scenario.name, "Selector móvil demasiado pequeño", rect);
    }

    assertCondition(shell.mobile.brandContrast >= 4.5, scenario.name, "Contraste insuficiente en la marca móvil", shell.mobile.brandContrast);
    assertCondition(shell.mobile.brandFontSize <= 14, scenario.name, "La marca móvil crece por estilos globales", {
      fontSize: shell.mobile.brandFontSize,
      parentFontSize: shell.mobile.brandParentFontSize
    });

    for (const label of shell.mobile.navLabels) {
      assertCondition(label.fontSize <= 10.5, scenario.name, "Label de navegación móvil sobredimensionado", label);
      assertCondition(label.contrast >= 4.5, scenario.name, "Contraste insuficiente en navegación móvil", label);
      assertCondition(label.rect.width >= 44 && label.rect.height >= 44, scenario.name, "Target táctil inferior menor de 44px", label);
      assertCondition(label.scrollWidth <= label.clientWidth + 1, scenario.name, "Label móvil desborda horizontalmente", label);
      assertCondition(label.scrollHeight <= label.clientHeight + 1, scenario.name, "Label móvil queda recortado verticalmente", label);
    }

    const drawer = await inspectDrawer(page);
    assertCondition(
      drawer.content && drawer.content.top >= -1 && drawer.content.bottom <= drawer.innerHeight + 1,
      scenario.name,
      "El drawer Más sale del viewport",
      drawer
    );
    assertCondition(["auto", "scroll"].includes(drawer.overflowY), scenario.name, "El drawer Más no permite scroll", drawer.overflowY);
    for (const item of drawer.items) {
      assertCondition(item.height >= 44, scenario.name, "Elemento del drawer menor de 44px", item);
      assertCondition(item.left >= -1 && item.right <= shell.viewport.width + 1, scenario.name, "Elemento del drawer sale del viewport", item);
      assertCondition(Math.abs(item.labelFontSize - item.parentFontSize) <= 0.25, scenario.name, "El span del drawer no hereda la tipografía del componente", item);
    }
  } else {
    assertCondition(shell.desktop.sidebarVisible, scenario.name, "El sidebar desktop no es visible");
    assertCondition(!shell.desktop.headerVisible && !shell.desktop.bottomVisible, scenario.name, "Se muestran controles móviles en desktop");
    for (const nav of shell.desktop.navFontSizes) {
      assertCondition(Math.abs(nav.parent - nav.label) <= 0.25, scenario.name, "El label desktop no hereda la escala del enlace", nav);
    }
  }

  console.log(JSON.stringify({ scenario: scenario.name, shell, result: "PASS" }));
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const scenario of scenarios) {
    await runScenario(browser, scenario);
  }
  console.log("GLOBAL_UI_SHELL_QA_OK");
} finally {
  await browser.close();
}
