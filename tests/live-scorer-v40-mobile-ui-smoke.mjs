import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173";

function ok(value, message) {
  if (!value) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await installBrowserNetworkStubs(page);
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

try {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    await import("/views/LiveScoreHUDViewV40.js");
    document.body.innerHTML = `
      <main class="v39-live-root v40-scorer-root" data-v40-scorer="true">
        <div class="v40-scorer-topbar"><button>‹</button><div class="v40-scorer-title"><strong>ANOTACIÓN</strong><span>EN DIRECTO</span></div><button>•••</button></div>
        <header class="v38-scorebar"><div class="v38-team"><span>Local</span><strong>10</strong></div><div class="v38-clock-wrap"><div class="v38-clock">08:42</div><div class="v38-period">Q1</div></div><div class="v38-team"><strong>7</strong><span>Rival</span></div></header>
        <section class="v38-toolbar"><button>↶</button><button>↷</button><button>⇄ Cambios</button><button>☷ 12</button></section>
        <section class="v38-period-strip"><button>Q1</button><button>Q2</button><button>Q3</button><button>Q4</button><button id="btn-add-ot">+PR</button></section>
        <section class="v38-player-section"><div class="v38-section-title"><strong>5 EN PISTA</strong><span>Jugador ↔ acción</span></div><div class="v38-player-grid">${Array.from({ length: 5 }, (_, i) => `<button class="v38-player"><strong>#${i + 4}</strong><span>P${i + 1}</span></button>`).join("")}</div></section>
        <section class="v38-actions-section"><div class="v38-section-title"><div class="v39-palette-tabs"><button>Mi equipo</button><button>Rival</button></div></div><div class="v38-actions-grid">${Array.from({ length: 14 }, (_, i) => `<button class="v38-fast-action"><strong>${i + 1}</strong><span>Acción</span></button>`).join("")}</div></section>
        <section class="v38-feed-section v40-secondary-panel">Feed</section>
      </main>`;

    const root = document.querySelector(".v40-scorer-root");
    const rootStyle = getComputedStyle(root);
    const rootRect = root.getBoundingClientRect();
    const playerGrid = document.querySelector(".v38-player-grid");
    const playerStyle = getComputedStyle(playerGrid);
    const actionSection = document.querySelector(".v38-actions-section");
    const actionStyle = getComputedStyle(actionSection);
    const secondary = document.querySelector(".v40-secondary-panel");

    return {
      rootPosition: rootStyle.position,
      rootTop: rootRect.top,
      rootBottom: rootRect.bottom,
      viewportHeight: window.innerHeight,
      rootWidth: rootRect.width,
      viewportWidth: window.innerWidth,
      playerColumns: playerStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
      actionPosition: actionStyle.position,
      secondaryDisplay: getComputedStyle(secondary).display,
      bodyScrollWidth: document.documentElement.scrollWidth
    };
  });

  ok(result.rootPosition === "fixed", "El scorer V40 no cubre el viewport");
  ok(result.rootTop >= -1 && result.rootBottom <= result.viewportHeight + 1, "El scorer V40 desborda verticalmente el viewport");
  ok(result.rootWidth <= result.viewportWidth + 1, "El scorer V40 desborda horizontalmente el viewport");
  ok(result.playerColumns === 5, "Las cinco jugadoras no permanecen en una sola fila");
  ok(result.actionPosition === "static", "La botonera de acciones depende todavía del sticky/fixed legacy");
  ok(result.secondaryDisplay === "none", "Los paneles secundarios ocupan espacio durante la captura normal");
  ok(result.bodyScrollWidth <= result.viewportWidth + 1, "El scorer genera scroll horizontal");
  ok(pageErrors.length === 0, `pageerror: ${pageErrors.join(" | ")}`);

  console.log(JSON.stringify({ viewport: "iphone-390x844", ...result, result: "PASS" }));
  console.log("LIVE_SCORER_V40_MOBILE_UI_OK");
} finally {
  await browser.close();
}
