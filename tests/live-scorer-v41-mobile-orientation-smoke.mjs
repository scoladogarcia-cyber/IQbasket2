import { chromium, webkit } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173";
const BROWSER = String(process.env.QA_BROWSER || "chromium").toLowerCase();
const browserType = BROWSER === "webkit" ? webkit : chromium;

function ok(value, message) {
  if (!value) throw new Error(message);
}

const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await installBrowserNetworkStubs(page);
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

async function inspectLayout() {
  return page.evaluate(async () => {
    const root = document.querySelector(".v41-scorer-root");
    const lease = root.querySelector("[data-live-writer-lease-panel]");
    const score = root.querySelector(".v38-scorebar");
    const actions = root.querySelector(".v38-actions-section");
    const players = root.querySelector(".v38-player-grid");
    const lastAction = root.querySelector(".v38-actions-grid .v38-fast-action:last-child");

    actions.scrollTop = actions.scrollHeight;
    await new Promise(resolve => requestAnimationFrame(() => resolve()));

    const rect = element => {
      const value = element.getBoundingClientRect();
      return { top: value.top, right: value.right, bottom: value.bottom, left: value.left, width: value.width, height: value.height };
    };

    const rootRect = rect(root);
    const leaseRect = rect(lease);
    const scoreRect = rect(score);
    const actionRect = rect(actions);
    const lastActionRect = rect(lastAction);
    const rootStyle = getComputedStyle(root);
    const actionStyle = getComputedStyle(actions);
    const playerStyle = getComputedStyle(players);

    return {
      orientation: matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait",
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      rootRect,
      leaseRect,
      scoreRect,
      actionRect,
      lastActionRect,
      rootPosition: rootStyle.position,
      rootOverflowY: rootStyle.overflowY,
      rootColumns: rootStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
      actionOverflowY: actionStyle.overflowY,
      actionScrollHeight: actions.scrollHeight,
      actionClientHeight: actions.clientHeight,
      playerColumns: playerStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
      writerState: root.dataset.liveWriterState,
      bodyScrollWidth: document.documentElement.scrollWidth
    };
  });
}

try {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  await page.evaluate(async () => {
    const { LiveScoreHUDViewV41 } = await import("/views/LiveScoreHUDViewV41.js");
    document.body.innerHTML = `
      <main class="v39-live-root v40-scorer-root v41-scorer-root" data-v40-scorer="true" data-v41-scorer="true">
        <section data-live-writer-lease-panel="true" aria-live="polite" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;margin-bottom:12px;color:#334155;font:600 12px/1.4 system-ui,sans-serif">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div id="live-writer-lease-status" role="status" style="color:#166534">✅ Tienes el turno de escritura · renovado hasta 08:32:42.</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" data-live-writer-handoff-create>Transferir captura</button>
              <button type="button" data-live-writer-release>Liberar turno</button>
            </div>
          </div>
          <div data-live-writer-handoff-output hidden></div>
        </section>
        <div class="v40-scorer-topbar"><button>‹ <span>Partidos</span></button><div class="v40-scorer-title"><strong>ANOTACIÓN</strong><span>EN DIRECTO</span></div><button>•••</button></div>
        <header class="v38-scorebar"><div class="v38-team"><span>JMJ Manyanet</span><strong>0</strong></div><div class="v38-clock-wrap"><div class="v38-clock">10:00</div><div class="v38-period">Q1</div></div><div class="v38-team"><strong>0</strong><span>Test3</span></div></header>
        <section class="v38-toolbar"><button>↶</button><button>↷</button><button>⇄ Cambios</button><button>☷ 0</button></section>
        <section class="v38-period-strip"><button>Q1</button><button>Q2</button><button>Q3</button><button>Q4</button><button id="btn-add-ot">+PR</button></section>
        <section class="v38-player-section"><div class="v38-section-title"><strong>5 EN PISTA</strong><span>Toca jugadora + acción</span></div><div class="v38-player-grid">${Array.from({ length: 5 }, (_, i) => `<button class="v38-player"><strong>#${[5,10,16,19,23][i]}</strong><span>${["Anna","Noa","June","Paula","Arlet"][i]}</span></button>`).join("")}</div></section>
        <section class="v38-actions-section"><div class="v38-section-title"><div class="v39-palette-tabs"><button class="is-active">Mi equipo</button><button>Rival</button></div></div><div class="v38-actions-grid">${Array.from({ length: 14 }, (_, i) => `<button class="v38-fast-action"><strong>${i + 1}</strong><span>Acción</span></button>`).join("")}</div></section>
        <section class="v38-feed-section v40-secondary-panel">Feed</section>
        <section class="v38-advanced v40-secondary-panel">Avanzado</section>
        <section class="v38-finish-row v40-secondary-panel">Finalizar</section>
      </main>`;

    const root = document.querySelector(".v41-scorer-root");
    LiveScoreHUDViewV41.prototype._syncWriterLeaseState.call({}, root);
  });

  const portrait = await inspectLayout();
  ok(portrait.orientation === "portrait", "El smoke no arrancó en vertical");
  ok(portrait.rootPosition === "fixed", "V41 no mantiene el scorer inmersivo");
  ok(portrait.rootRect.top >= -1 && portrait.rootRect.bottom <= portrait.viewportHeight + 1, "V41 desborda el viewport vertical");
  ok(portrait.rootRect.right <= portrait.viewportWidth + 1, "V41 desborda el viewport horizontal");
  ok(portrait.writerState === "owned", "V41 no reconoce el writer lease real");
  ok(portrait.leaseRect.height <= 26, "El writer lease vuelve a desplazar el scorer en vertical");
  ok(portrait.leaseRect.bottom <= portrait.scoreRect.top + 1, "Writer lease y marcador se solapan");
  ok(portrait.actionRect.bottom <= portrait.rootRect.bottom + 1, "La zona de acciones queda fuera del scorer");
  ok(["auto", "scroll"].includes(portrait.actionOverflowY), "La zona de acciones no tiene scroll interno de seguridad");
  ok(portrait.lastActionRect.bottom <= portrait.actionRect.bottom + 2, "La última acción no es alcanzable tras hacer scroll");
  ok(portrait.playerColumns === 5, "Las cinco jugadoras no permanecen en una fila");
  ok(portrait.rootColumns === 1, "El modo vertical no usa una columna principal");
  ok(portrait.bodyScrollWidth <= portrait.viewportWidth + 1, "V41 genera scroll horizontal en vertical");

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(80);
  const landscape = await inspectLayout();
  ok(landscape.orientation === "landscape", "V41 no responde al cambio a apaisado");
  ok(landscape.rootRect.top >= -1 && landscape.rootRect.bottom <= landscape.viewportHeight + 1, "V41 desborda el viewport apaisado");
  ok(landscape.rootColumns === 2, "El modo apaisado no activa el layout de dos zonas");
  ok(landscape.actionRect.left >= landscape.scoreRect.right - 2, "Las acciones no ocupan la columna derecha en apaisado");
  ok(landscape.leaseRect.bottom <= landscape.scoreRect.top + 1, "Writer lease y marcador se solapan en apaisado");
  ok(landscape.lastActionRect.bottom <= landscape.actionRect.bottom + 2, "La última acción no es alcanzable en apaisado");
  ok(landscape.playerColumns === 5, "Las cinco jugadoras dejan de estar en una fila al girar");
  ok(landscape.bodyScrollWidth <= landscape.viewportWidth + 1, "V41 genera scroll horizontal en apaisado");
  ok(pageErrors.length === 0, `pageerror: ${pageErrors.join(" | ")}`);

  console.log(JSON.stringify({ browser: BROWSER, portrait, landscape, result: "PASS" }));
  console.log("LIVE_SCORER_V41_MOBILE_ORIENTATION_OK");
} finally {
  await browser.close();
}
