import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID = "21111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GAME_ID = "31111111-1111-4111-8111-111111111111";

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

  const result = await page.evaluate(async ({ TEAM_ID, TEAM_SEASON_ID, GAME_ID }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { LiveGameSetupV39View } = await import("/views/games/LiveGameSetupV39View.js");
    const { LiveCaptureStartController } = await import("/features/game-live/LiveCaptureStartController.js");
    await import("/views/LiveScoreHUDViewV39.js");

    const players = Array.from({ length: 6 }, (_, index) => ({
      id: `41111111-1111-4111-8111-11111111111${index}`,
      team_id: TEAM_ID,
      first_name: `P${index + 1}`,
      last_name: "QA",
      jersey: index + 4
    }));
    const game = {
      id: GAME_ID,
      team_id: TEAM_ID,
      team_season_id: TEAM_SEASON_ID,
      season_id: "season-qa",
      play_state: "SCHEDULED",
      edit_state: "OPEN"
    };

    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
    DataStore.getActiveSeasonId = () => "season-qa";
    DataStore.getTeamById = () => ({ id: TEAM_ID, name: "Equipo QA", competition: "Liga QA" });
    DataStore.getPlayersEligibleOnDate = () => players.map(row => ({ ...row }));
    DataStore.getGameById = () => game;

    const auth = {
      can: () => true,
      canPreview: () => true
    };

    document.body.innerHTML = '<main id="v39-smoke"></main>';
    const setup = new LiveGameSetupV39View(null, auth);
    setup.render("v39-smoke", TEAM_ID);
    const starterButtons = [...document.querySelectorAll("[data-starter-id]")];
    starterButtons.slice(0, 5).forEach(button => button.click());
    const selectedAfterFive = document.querySelectorAll(".v39-live-starter.is-selected").length;
    starterButtons[5]?.click();
    const selectedAfterSixthAttempt = document.querySelectorAll(".v39-live-starter.is-selected").length;
    const setupOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    const setupCount = document.querySelector("#v39-starter-count")?.textContent || "";

    document.body.innerHTML = `
      <main id="gate-root">
        <div class="v39-live-root">
          <button class="btn-action-direct">Acción</button>
          <button id="btn-hud-finish">Finalizar</button>
        </div>
      </main>`;
    const transitions = [];
    let rerenders = 0;
    const fakeView = {
      gameId: GAME_ID,
      async render() {
        rerenders += 1;
        document.getElementById("gate-root").innerHTML = `
          <div class="v39-live-root">
            <button class="btn-action-direct">Acción</button>
            <button id="btn-hud-finish">Finalizar</button>
          </div>`;
      }
    };
    const gate = new LiveCaptureStartController(fakeView, null, auth);
    gate.service = {
      async snapshot() { return { play_state: "SCHEDULED" }; },
      async transition({ targetState }) {
        transitions.push(targetState);
        return { play_state: targetState };
      }
    };
    await gate.syncAfterRender(document.getElementById("gate-root"), GAME_ID);
    const gateVisible = Boolean(document.querySelector("[data-live-start-gate]"));
    const leaseMarkerHidden = !document.querySelector("#btn-hud-finish")
      && Boolean(document.querySelector("#btn-hud-finish-gated"));
    const captureBlocked = Boolean(document.querySelector(".btn-action-direct")?.disabled);
    document.querySelector("[data-live-start-action]")?.click();
    await new Promise(resolve => setTimeout(resolve, 20));

    document.body.innerHTML = `
      <main class="v39-live-root" style="min-height:1200px">
        <div class="v38-scorebar">Marcador</div>
        <div class="v38-toolbar">Toolbar</div>
        <div class="v38-period-strip">Periodo</div>
        <section class="v38-player-section"><div class="v38-player-grid"><button class="v38-player">#4 P1</button></div></section>
        <section class="v38-actions-section"><div class="v38-section-title">Acciones</div><div class="v38-actions-grid"><button class="v38-fast-action"><strong>+2</strong><span>Canasta</span></button></div></section>
      </main>`;
    const palette = document.querySelector(".v38-actions-section");
    const paletteStyle = getComputedStyle(palette);
    const rect = palette.getBoundingClientRect();

    return {
      setupCount,
      selectedAfterFive,
      selectedAfterSixthAttempt,
      setupOverflow,
      gateVisible,
      leaseMarkerHidden,
      captureBlocked,
      transitions,
      rerenders,
      palettePosition: paletteStyle.position,
      paletteTop: rect.top,
      paletteBottom: rect.bottom,
      viewportHeight: window.innerHeight,
      paletteWidth: rect.width,
      viewportWidth: window.innerWidth
    };
  }, { TEAM_ID, TEAM_SEASON_ID, GAME_ID });

  ok(result.setupCount === "5/5", "El alta live no confirma quinteto 5/5");
  ok(result.selectedAfterFive === 5, "No se pueden seleccionar exactamente cinco titulares");
  ok(result.selectedAfterSixthAttempt === 5, "El alta permite más de cinco titulares");
  ok(!result.setupOverflow, "El alta live desborda horizontalmente en iPhone");
  ok(result.gateVisible, "SCHEDULED no muestra la puerta Preparar/Iniciar");
  ok(result.leaseMarkerHidden, "El lease puede competir con el gate antes de LIVE");
  ok(result.captureBlocked, "SCHEDULED deja acciones activas antes de iniciar");
  ok(result.transitions.join(",") === "READY,LIVE", "El inicio no sigue SCHEDULED → READY → LIVE");
  ok(result.rerenders === 1, "El scorer no se recompone después de entrar en LIVE");
  ok(result.palettePosition === "fixed", "La paleta móvil no queda fija bajo el pulgar");
  ok(result.paletteTop >= 0 && result.paletteBottom <= result.viewportHeight + 1, "La paleta móvil queda fuera del viewport");
  ok(result.paletteWidth <= result.viewportWidth, "La paleta móvil desborda el viewport");
  ok(pageErrors.length === 0, `pageerror: ${pageErrors.join(" | ")}`);

  console.log(JSON.stringify({ viewport: "iphone-390x844", ...result, result: "PASS" }));
  console.log("LIVE_CAPTURE_V39_MOBILE_UI_OK");
} finally {
  await browser.close();
}
