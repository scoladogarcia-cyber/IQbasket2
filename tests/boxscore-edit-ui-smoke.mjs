import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function assertCondition(condition, viewport, message) {
  if (!condition) throw new Error(`[${viewport}] ${message}`);
}

async function installFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  await page.evaluate(async ({ TEAM_ID, TEAM_SEASON_ID }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { GameBoxScoreView } = await import("/views/GameBoxScoreView.js");
    const { PermissionService } = await import("/security/PermissionService.js");

    const players = [
      {
        id: "10000000-0000-4000-8000-000000000001",
        team_id: TEAM_ID,
        first_name: "Víctor",
        last_name: "Base",
        jersey: 7
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        team_id: TEAM_ID,
        first_name: "Paula",
        last_name: "Escolta",
        jersey: 12
      }
    ];

    const games = [
      {
        id: "game-open",
        team_id: TEAM_ID,
        team_season_id: TEAM_SEASON_ID,
        date: "2026-02-10",
        opponent: "Rival Open",
        venue: "Local",
        team_score: 70,
        opponent_score: 62,
        edit_state: "OPEN",
        starter_ids: [players[0].id]
      },
      {
        id: "game-locked",
        team_id: TEAM_ID,
        team_season_id: TEAM_SEASON_ID,
        date: "2026-02-17",
        opponent: "Rival Locked",
        venue: "Visitante",
        team_score: 60,
        opponent_score: 65,
        edit_state: "LOCKED",
        starter_ids: []
      }
    ];

    const statsByGame = {
      "game-open": [
        {
          game_id: "game-open",
          player_id: players[0].id,
          starter: true,
          minutes: 30,
          fg2_made: 2,
          fg2_attempted: 5,
          fg3_made: 1,
          fg3_attempted: 4,
          ft_made: 2,
          ft_attempted: 2,
          off_reb: 1,
          def_reb: 3,
          assists: 4,
          steals: 1,
          blocks: 0,
          turnovers: 2,
          fouls_committed: 2,
          fouls_drawn: 3
        },
        {
          game_id: "game-open",
          player_id: players[1].id,
          starter: false,
          minutes: 20,
          fg2_made: 1,
          fg2_attempted: 3,
          fg3_made: 2,
          fg3_attempted: 5,
          ft_made: 0,
          ft_attempted: 0,
          off_reb: 0,
          def_reb: 2,
          assists: 2,
          steals: 0,
          blocks: 0,
          turnovers: 1,
          fouls_committed: 1,
          fouls_drawn: 1
        }
      ],
      "game-locked": [
        {
          game_id: "game-locked",
          player_id: players[0].id,
          starter: false,
          minutes: 25,
          fg2_made: 3,
          fg2_attempted: 6,
          fg3_made: 0,
          fg3_attempted: 2,
          ft_made: 1,
          ft_attempted: 2,
          off_reb: 1,
          def_reb: 4,
          assists: 3,
          steals: 1,
          blocks: 1,
          turnovers: 2,
          fouls_committed: 3,
          fouls_drawn: 2
        }
      ]
    };

    window.__box = {
      calls: [],
      frozen: false,
      games,
      players,
      statsByGame
    };

    DataStore.getGames = () => games.map(game => ({ ...game }));
    DataStore.getSeasonParticipantPlayers = () => players.map(player => ({ ...player }));
    DataStore.getPlayers = () => players.map(player => ({ ...player }));
    DataStore.getPlayerGameStats = (_playerId, gameId) =>
      (statsByGame[gameId] || []).map(row => ({ ...row }));
    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
    DataStore.getActiveSeasonContext = () => ({
      team_season_id: TEAM_SEASON_ID,
      team_id: TEAM_ID,
      name: "2025/2026",
      start_date: "2025-09-01",
      end_date: "2026-06-30",
      data_status: window.__box.frozen ? "FROZEN" : "ACTIVE"
    });

    DataStore.saveGameAndStats = async (gameData, statsList) => {
      window.__box.calls.push({
        gameData: structuredClone(gameData),
        statsList: structuredClone(statsList)
      });
      statsByGame[gameData.id] = statsList.map(row => ({ ...row }));
      const index = games.findIndex(game => game.id === gameData.id);
      if (index >= 0) games[index] = { ...games[index], ...structuredClone(gameData) };
      return true;
    };

    const makeAuth = role => {
      const auth = new PermissionService();
      auth.setCurrentUser({
        id: role === "INVITADO" ? "guest-user" : "coach-user",
        email: role === "INVITADO" ? "test@test.com" : "coach@example.test",
        role,
        global_role: role,
        assigned_team_ids: [TEAM_ID],
        allowed_team_season_ids: [TEAM_SEASON_ID],
        contextualMemberships: role === "INVITADO" ? [] : [
          {
            team_season_id: TEAM_SEASON_ID,
            team_id: TEAM_ID,
            function_role: "ENTRENADOR",
            status: "ACTIVE"
          }
        ]
      });
      return auth;
    };

    document.body.innerHTML = '<main id="boxscore-test-root" style="min-height:100vh;width:100%;"></main>';

    window.__renderBox = async ({ role = "ENTRENADOR", gameId = "game-open", frozen = false } = {}) => {
      window.__box.frozen = Boolean(frozen);
      const view = new GameBoxScoreView(null, makeAuth(role));
      window.__box.view = view;
      await view.render("boxscore-test-root", gameId);
    };

    await window.__renderBox();
  }, { TEAM_ID, TEAM_SEASON_ID });
}

async function inspectEditable(page) {
  return page.evaluate(() => ({
    hasSave: Boolean(document.querySelector("#btn-save-boxscore")),
    enabledInputs: [...document.querySelectorAll(".bs-input")].filter(input => !input.disabled).length,
    disabledInputs: [...document.querySelectorAll(".bs-input")].filter(input => input.disabled).length,
    enabledStarters: [...document.querySelectorAll(".chk-starter")].filter(input => !input.disabled).length,
    text: document.body.textContent || "",
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  }));
}

async function runViewport(browser, viewportName, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);

  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("dialog", async dialog => dialog.accept());

  await installFixture(page);

  const openState = await inspectEditable(page);
  assertCondition(openState.hasSave, viewportName, "ENTRENADOR no puede guardar BoxScore OPEN");
  assertCondition(openState.enabledInputs > 0, viewportName, "Inputs OPEN aparecen bloqueados");
  assertCondition(openState.enabledStarters > 0, viewportName, "Quinteto inicial OPEN aparece bloqueado");
  assertCondition(!openState.overflow, viewportName, "BoxScore OPEN desborda horizontalmente la página");

  const firstRow = page.locator('tr[data-player-id="10000000-0000-4000-8000-000000000001"]');
  await firstRow.locator('.bs-input[data-field="fg2_made"]').fill("3");
  await firstRow.locator('.bs-input[data-field="minutes"]').fill("32");

  const visiblePoints = await firstRow.locator(".cell-pts").textContent();
  assertCondition(String(visiblePoints).trim() === "11", viewportName, "PTS no se recalcula al editar T2C");

  await page.locator("#btn-save-boxscore").click();
  await page.waitForFunction(() => window.__box.calls.length === 1);

  const saveCall = await page.evaluate(() => window.__box.calls[0]);
  const victor = saveCall.statsList.find(row => row.player_id === "10000000-0000-4000-8000-000000000001");
  assertCondition(Boolean(victor), viewportName, "No se guarda la fila de Víctor");
  assertCondition(victor.fg2_made === 3, viewportName, "BoxScore guarda T2C incorrecto");
  assertCondition(victor.minutes === 32, viewportName, "BoxScore guarda minutos incorrectos");
  assertCondition(victor.points === 11, viewportName, "BoxScore guarda PTS derivados incorrectos");

  await page.evaluate(() => window.__renderBox({ role: "ENTRENADOR", gameId: "game-locked", frozen: false }));
  const lockedState = await inspectEditable(page);
  assertCondition(!lockedState.hasSave, viewportName, "Partido LOCKED expone Guardar");
  assertCondition(lockedState.enabledInputs === 0, viewportName, "Partido LOCKED deja inputs editables");
  assertCondition(lockedState.text.includes("Partido cerrado"), viewportName, "Falta motivo de solo lectura por cierre");

  await page.evaluate(() => window.__renderBox({ role: "ENTRENADOR", gameId: "game-open", frozen: true }));
  const frozenState = await inspectEditable(page);
  assertCondition(!frozenState.hasSave, viewportName, "Temporada FROZEN expone Guardar");
  assertCondition(frozenState.enabledInputs === 0, viewportName, "Temporada FROZEN deja inputs editables");
  assertCondition(frozenState.text.includes("Temporada cerrada"), viewportName, "Falta motivo de solo lectura por temporada");

  await page.evaluate(() => window.__renderBox({ role: "INVITADO", gameId: "game-open", frozen: false }));
  const guestState = await inspectEditable(page);
  assertCondition(!guestState.hasSave, viewportName, "INVITADO expone Guardar BoxScore");
  assertCondition(guestState.enabledInputs === 0, viewportName, "INVITADO puede editar inputs");
  assertCondition(
    guestState.text.includes("consultar, pero no editar"),
    viewportName,
    "INVITADO no recibe explicación de solo lectura"
  );

  const relevantConsoleErrors = consoleErrors.filter(message =>
    !/favicon|Failed to load resource.*404/i.test(message)
  );
  assertCondition(pageErrors.length === 0, viewportName, "pageerror: " + pageErrors.join(" | "));
  assertCondition(relevantConsoleErrors.length === 0, viewportName, "console error: " + relevantConsoleErrors.join(" | "));

  console.log(JSON.stringify({
    viewport: viewportName,
    openState,
    saveCall,
    lockedState,
    frozenState,
    guestState,
    result: "PASS"
  }));

  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await runViewport(browser, "iphone-390x844", { width: 390, height: 844 });
  console.log("BOXSCORE_EDIT_UI_OK");
} finally {
  await browser.close();
}
