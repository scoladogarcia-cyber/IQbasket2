import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173";
const GAME_ID = "44444444-4444-4444-8444-444444444444";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWN_PLAYER_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_PLAYER_ID = "10000000-0000-4000-8000-000000000002";

function ok(condition, viewport, message) {
  if (!condition) throw new Error(`[${viewport}] ${message}`);
}

async function installFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ GAME_ID, TEAM_ID, TEAM_SEASON_ID, OWN_PLAYER_ID, OTHER_PLAYER_ID }) => {
    const [{ Permission }, { DataStore }, { GameCaptureModesView }, { ScopedGameBoxScoreView }, { PlayerNutritionRouterView }, { FamilyWorkspaceV31View }] = await Promise.all([
      import("/security/PermissionService.js"),
      import("/services/DataStore.js"),
      import("/views/games/GameCaptureModesView.js"),
      import("/views/games/ScopedGameBoxScoreView.js"),
      import("/views/PlayerNutritionRouterView.js"),
      import("/views/family/FamilyWorkspaceV31View.js")
    ]);

    document.body.innerHTML = '<main id="v31-host"></main>';
    const host = document.getElementById("v31-host");

    const capabilities = new Set([
      Permission.RECORD_LIVE_GAME,
      Permission.RECORD_QUICK_GAME,
      Permission.EDIT_BOXSCORE
    ]);
    const familyAuth = {
      getAuthenticatedRole: () => "FAMILIA_TUTOR",
      getCurrentUser: () => ({
        id: "family-user",
        role: "FAMILIA_TUTOR",
        linkedPlayerIds: [OWN_PLAYER_ID],
        gameDelegations: [{
          gameId: GAME_ID,
          capabilities: [...capabilities],
          validUntil: "2099-12-31T23:59:59Z"
        }]
      }),
      canPreview(permission, context = {}) {
        if (permission === Permission.EDIT_GAME) return false;
        return String(context.gameId || "") === GAME_ID && capabilities.has(permission);
      }
    };

    // 1. Full team game list: delegated Family must see exactly the three
    // capture entry points without receiving the broad EDIT_GAME action.
    host.innerHTML = `<article class="game-item-card"><div class="actions">
      <button class="btn-open-court-direct" data-id="${GAME_ID}">Pista / Edición</button>
      <button class="btn-live-existing-game" data-id="${GAME_ID}" disabled>Captura</button>
      <button onclick="window.location.hash='#/boxscore/${GAME_ID}'">Boxscore</button>
    </div></article>`;
    const gameView = Object.create(GameCaptureModesView.prototype);
    gameView.auth = familyAuth;
    gameView.games = [{ id: GAME_ID, team_id: TEAM_ID, team_season_id: TEAM_SEASON_ID, edit_state: "OPEN" }];
    gameView._isGameLocked = () => false;
    gameView._isTeamSeasonFrozen = () => false;
    gameView._decorateCaptureModes(host, TEAM_ID);

    const captureState = {
      broadEditPresent: Boolean(host.querySelector(".btn-open-court-direct")),
      liveText: host.querySelector(".btn-live-existing-game")?.textContent || "",
      quickHref: host.querySelector("[data-quick-capture-id]")?.getAttribute("href") || "",
      actaText: [...host.querySelectorAll("button")].map(el => el.textContent || "").find(text => text.includes("Acta")) || "",
      note: host.querySelector(".game-capture-scope-note")?.textContent || ""
    };

    // 2. Delegated Acta must force the V21 scoped snapshot/write flow even if
    // Family can also read the whole team.
    host.innerHTML = "";
    const box = new ScopedGameBoxScoreView(null, familyAuth);
    let scopedLoad = 0;
    let scopedDetail = 0;
    box._loadGameScopedSnapshot = async gameId => {
      scopedLoad += 1;
      box.isGameScopedOnly = true;
      box.games = [{ id: gameId }];
      box.players = [];
      box.gameStats = [];
    };
    box._renderGameBoxScoreDetail = () => { scopedDetail += 1; };
    await box.render("v31-host", GAME_ID);

    // 3. Main Nutrition route: Family resolves the exact linked subject and opens
    // Wellness directly. It must never enter the staff nutrition selector nor
    // depend on a generic Player360 hash that could select another tab.
    let staffCalls = 0;
    const nutrition = new PlayerNutritionRouterView(null, familyAuth, {
      render() { staffCalls += 1; }
    });
    const nutritionRenderState = {
      calls: 0,
      playerId: null,
      teamId: null,
      activeTabAtRender: null
    };
    nutrition.subjectView = {
      activeTab: "evaluation",
      async render(_containerId, playerId, teamId) {
        nutritionRenderState.calls += 1;
        nutritionRenderState.playerId = playerId;
        nutritionRenderState.teamId = teamId;
        nutritionRenderState.activeTabAtRender = this.activeTab;
      }
    };
    history.replaceState(null, "", "#/nutrition");
    await nutrition.render("v31-host", null, TEAM_ID);

    // 4. Family global team layer: rich team metrics remain privacy-safe because
    // identity masking has already happened in the server snapshot.
    const familyView = Object.create(FamilyWorkspaceV31View.prototype);
    const teamMarkup = familyView._teamSection({
      team: { team_name: "IQBasket Showcase U18", season_name: "2026/2027" },
      team_metrics: {
        games: 10, wins: 7, losses: 3,
        points_for_avg: 72.4, points_against_avg: 65.1,
        assists: 150, rebounds: 380, turnovers: 110,
        efg: 52.6, ortg: 108.2, drtg: 97.4
      },
      privacy: { show_other_player_names: false, show_other_player_jerseys: false },
      players: [
        { player_id: OWN_PLAYER_ID, linked: true, first_name: "Lukas", last_name: "Danzic", jersey: 7, primary_position: "Base", games: 10, mpg: 24, ppg: 13, rpg: 4, apg: 5, eval_pg: 15, plus_minus: 32 },
        { player_id: OTHER_PLAYER_ID, linked: false, first_name: null, last_name: null, jersey: null, primary_position: "Alero", games: 9, mpg: 18, ppg: 8, rpg: 5, apg: 2, eval_pg: 10, plus_minus: 4 }
      ]
    });
    host.innerHTML = teamMarkup;
    const familyTeamState = {
      title: host.querySelector("#family-team-v31-title")?.textContent || "",
      text: host.textContent || "",
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };

    // 5. Player team-dashboard presentation preference. Import after installing
    // deterministic app/DataStore context so the progressive enhancer can bind.
    const originalGetPlayerById = DataStore.getPlayerById;
    const originalGetActiveTeamId = DataStore.getActiveTeamId;
    const originalGetActiveTeamSeasonId = DataStore.getActiveTeamSeasonId;
    DataStore.getPlayerById = id => String(id) === OWN_PLAYER_ID
      ? { id: OWN_PLAYER_ID, first_name: "Lukas", last_name: "Danzic", jersey: 7 }
      : null;
    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;

    window.iqApp.permissionService = {
      getAuthenticatedRole: () => "JUGADOR",
      getCurrentUser: () => ({ id: "player-user", role: "JUGADOR", playerId: OWN_PLAYER_ID })
    };
    host.innerHTML = `<div class="clean-dashboard-wrapper"><div class="dash-top-bar"><div>Dashboard</div></div>
      <div class="purple-leaders-banner">
        <div class="purple-leader-col"><strong class="leader-player-name">#7 Lukas Danzic</strong><span class="leader-player-meta">Base · 10 PJ</span></div>
        <div class="purple-leader-col"><strong class="leader-player-name">#12 Paula Test</strong><span class="leader-player-meta">Alero · 9 PJ</span></div>
      </div></div>`;
    await import(`/features/player-dashboard/PlayerDashboardPrivacyEnhancer.js?v31=${Date.now()}`);
    await new Promise(resolve => setTimeout(resolve, 80));
    const privacyPanel = host.querySelector(".player-peer-identity-control");
    privacyPanel?.querySelector('[data-peer-mode="POSITIONS_ONLY"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 20));
    const leaderNames = [...host.querySelectorAll(".leader-player-name")].map(el => el.textContent || "");
    const positionsPressed = privacyPanel?.querySelector('[data-peer-mode="POSITIONS_ONLY"]')?.getAttribute("aria-pressed") || "false";

    DataStore.getPlayerById = originalGetPlayerById;
    DataStore.getActiveTeamId = originalGetActiveTeamId;
    DataStore.getActiveTeamSeasonId = originalGetActiveTeamSeasonId;

    window.__v31 = {
      captureState,
      scopedLoad,
      scopedDetail,
      scopedOnly: box.isGameScopedOnly,
      staffCalls,
      nutritionRenderState,
      familyTeamState,
      privacyPanel: Boolean(privacyPanel),
      positionsPressed,
      leaderNames
    };
  }, { GAME_ID, TEAM_ID, TEAM_SEASON_ID, OWN_PLAYER_ID, OTHER_PLAYER_ID });
}

async function runViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await installFixture(page);
  const state = await page.evaluate(() => window.__v31);

  ok(!state.captureState.broadEditPresent, name, "La delegación no debe mostrar EDIT_GAME amplio");
  ok(state.captureState.liveText.includes("Anotación en vivo"), name, "Falta modo Anotación en vivo");
  ok(state.captureState.quickHref.includes(`/easy-entry/${GAME_ID}`), name, "Falta modo Partido rápido");
  ok(state.captureState.actaText.includes("Acta / BoxScore"), name, "Falta modo Acta / BoxScore");
  ok(state.captureState.note.includes("en vivo") && state.captureState.note.includes("rápido") && state.captureState.note.includes("acta"), name, "El alcance delegado no se explica en UI");

  ok(state.scopedLoad === 1 && state.scopedDetail === 1 && state.scopedOnly, name, "Acta delegada no fuerza el boundary V21");
  ok(state.staffCalls === 0, name, "Family entró erróneamente en NutritionView de staff");
  ok(state.nutritionRenderState.calls === 1, name, "Nutrición Family no abre Player360 del sujeto");
  ok(state.nutritionRenderState.playerId === OWN_PLAYER_ID, name, "Nutrición Family no resuelve el jugador vinculado exacto");
  ok(state.nutritionRenderState.teamId === TEAM_ID, name, "Nutrición Family pierde el contexto de equipo");
  ok(state.nutritionRenderState.activeTabAtRender === "wellness", name, "Nutrición Family no abre directamente Wellness");

  ok(state.familyTeamState.title.includes("IQBasket Showcase U18"), name, "Falta contexto global de equipo en Family");
  ok(state.familyTeamState.text.includes("72.4") && state.familyTeamState.text.includes("108.2") && state.familyTeamState.text.includes("97.4"), name, "Family no muestra KPIs globales avanzados");
  ok(state.familyTeamState.text.includes("Alero"), name, "Family no mantiene posición del compañero anonimizado");
  ok(!state.familyTeamState.text.includes("Paula Test"), name, "Family filtró identidad protegida del compañero");
  ok(!state.familyTeamState.horizontalOverflow, name, "Family team dashboard desborda el viewport");

  ok(state.privacyPanel, name, "Falta selector de identidad para JUGADOR");
  ok(state.positionsPressed === "true", name, "No se activa Solo posiciones");
  ok(state.leaderNames[0].includes("Lukas Danzic"), name, "El jugador propio no debe anonimizarse");
  ok(state.leaderNames[1] === "Alero", name, "El resto del equipo no cambia a solo posición");
  ok(pageErrors.length === 0, name, `pageerror: ${pageErrors.join(" | ")}`);

  console.log(JSON.stringify({ viewport: name, state, result: "PASS" }));
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await runViewport(browser, "iphone-390x844", { width: 390, height: 844 });
  console.log("FAMILY_PLAYER_COHERENCE_V31_UI_OK");
} finally {
  await browser.close();
}
