import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.CORE_USER_FLOWS_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID = "21111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GAME_ID = "31111111-1111-4111-8111-111111111111";

function assertCondition(condition, viewport, message) {
  if (!condition) throw new Error(`[${viewport}] ${message}`);
}

async function installFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ TEAM_ID, TEAM_SEASON_ID, GAME_ID }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { EasyStatsEntryView } = await import("/views/EasyStatsEntryView.js");
    const { GameLiveEditorView } = await import("/views/GameLiveEditorView.js");

    const game = {
      id: GAME_ID, team_id: TEAM_ID, team_season_id: TEAM_SEASON_ID,
      date: "2026-09-05", opponent: "Rival QA", venue: "Local",
      team_score: 64, opponent_score: 59, edit_state: "OPEN", starter_ids: []
    };
    const players = [{
      id: "41111111-1111-4111-8111-111111111111", team_id: TEAM_ID,
      first_name: "Test", last_name: "Player", jersey: 7
    }];
    window.__lifecycle = { game, frozen: false, lockCalls: [], permissionCalls: [] };
    DataStore.getGames = () => [{ ...window.__lifecycle.game }];
    DataStore.getGameById = () => ({ ...window.__lifecycle.game });
    DataStore.getGamePeriodScores = () => [];
    DataStore.getPlayerGameStats = () => [];
    DataStore.getPlayersEligibleOnDate = () => players.map(player => ({ ...player }));
    DataStore.getPlayers = () => players.map(player => ({ ...player }));
    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
    DataStore.getActiveSeasonId = () => "season-qa";
    DataStore.getActiveSeasonContext = () => ({
      team_id: TEAM_ID,
      team_season_id: TEAM_SEASON_ID,
      data_status: window.__lifecycle.frozen ? "FROZEN" : "ACTIVE"
    });
    DataStore.init = async () => true;

    const liveOnlyAuth = {
      canPreview(permission, context) {
        window.__lifecycle.permissionCalls.push({ permission, context });
        return permission === "RECORD_LIVE_GAME";
      }
    };

    document.body.innerHTML = '<main id="lifecycle-root" style="min-height:100vh;width:100%;"></main>';
    window.__renderEasy = async () => {
      const view = new EasyStatsEntryView(null, liveOnlyAuth, null, GAME_ID);
      await view.render("lifecycle-root", GAME_ID);
    };
    window.__renderEasyWithBoxScore = async () => {
      const auth = { canPreview: permission => ["RECORD_LIVE_GAME", "EDIT_BOXSCORE"].includes(permission) };
      const view = new EasyStatsEntryView(null, auth, null, GAME_ID);
      await view.render("lifecycle-root", GAME_ID);
    };
    const adminAuth = {
      canPreview(permission, context) {
        window.__lifecycle.permissionCalls.push({ permission, context });
        return [
          "CREATE_GAME", "RECORD_LIVE_GAME", "EDIT_GAME", "EDIT_BOXSCORE",
          "DELETE_GAME", "LOCK_GAME", "REOPEN_GAME", "REVIEW_GAME_LOCK_REQUESTS"
        ].includes(permission);
      },
      can(permission, context) { return this.canPreview(permission, context); }
    };

    window.__renderGames = async () => {
      const view = new GameLiveEditorView(null, adminAuth);
      view.teamId = TEAM_ID;
      view.gameLockService = {
        canLock: item => String(item.edit_state).toUpperCase() === "OPEN",
        canReopen: item => String(item.edit_state).toUpperCase() === "LOCKED",
        canReviewRequests: () => false,
        canRequestLock: () => false,
        listPendingRequests: async () => [],
        setLocked: async (gameId, locked, reason) => {
          window.__lifecycle.lockCalls.push({ gameId, locked, reason });
          window.__lifecycle.game.edit_state = locked ? "LOCKED" : "OPEN";
          window.__lifecycle.game.lock_reason = reason || null;
        }
      };
      window.__lifecycle.gameView = view;
      await view._renderGamesList(document.getElementById("lifecycle-root"), TEAM_ID);
    };

    window.__checkBoxScorePermission = () => {
      const calls = [];
      const auth = { canPreview: (permission, context) => {
        calls.push({ permission, context });
        return permission === "EDIT_BOXSCORE";
      }};
      const view = new GameLiveEditorView(null, auth);
      view.teamId = TEAM_ID;
      view.currentGame = { ...window.__lifecycle.game };
      return { allowed: view._canEditFullBoxScore(), calls };
    };

    await window.__renderEasy();
  }, { TEAM_ID, TEAM_SEASON_ID, GAME_ID });
}

async function inspect(page) {
  return page.evaluate(() => ({
    text: document.body.textContent || "",
    hasForm: Boolean(document.querySelector("#form-easy-stats, #form-game-editor")),
    hasReopen: Boolean(document.querySelector(".btn-reopen-game")),
    hasEdit: Boolean(document.querySelector(".btn-open-court-direct:not([aria-disabled='true'])")),
    hasActaMode: Boolean(document.querySelector('[data-mode="acta"]')),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    permissionCalls: structuredClone(window.__lifecycle.permissionCalls),
    lockCalls: structuredClone(window.__lifecycle.lockCalls)
  }));
}

async function runViewport(browser, viewportName, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("dialog", async dialog => dialog.accept());
  await installFixture(page);

  const openEasy = await inspect(page);
  assertCondition(!openEasy.text.includes("Acceso Restringido"), viewportName, "RECORD_LIVE_GAME válido queda bloqueado");
  assertCondition(!openEasy.text.includes("Temporada cerrada"), viewportName, "Partido OPEN aparece congelado");
  assertCondition(!openEasy.text.includes("Partido cerrado"), viewportName, "Partido OPEN aparece cerrado");
  assertCondition(!openEasy.hasActaMode, viewportName, "RECORD_LIVE_GAME sin EDIT_BOXSCORE expone Acta Oficial");
  const livePermission = openEasy.permissionCalls.find(call => call.permission === "RECORD_LIVE_GAME");
  assertCondition(Boolean(livePermission), viewportName, "Entrada rápida no evalúa RECORD_LIVE_GAME");
  assertCondition(livePermission.context?.teamId === TEAM_ID, viewportName, "RECORD_LIVE_GAME pierde teamId");
  assertCondition(livePermission.context?.teamSeasonId === TEAM_SEASON_ID, viewportName, "RECORD_LIVE_GAME pierde teamSeasonId");

  await page.evaluate(() => window.__renderEasyWithBoxScore());
  const fullEntry = await inspect(page);
  assertCondition(fullEntry.hasActaMode, viewportName, "EDIT_BOXSCORE autorizado no expone Acta Oficial");

  await page.evaluate(async () => {
    window.__lifecycle.frozen = true;
    window.__lifecycle.game.edit_state = "OPEN";
    await window.__renderEasy();
  });
  const frozenEasy = await inspect(page);
  assertCondition(frozenEasy.text.includes("Temporada cerrada"), viewportName, "EasyStats no bloquea temporada FROZEN");
  assertCondition(!frozenEasy.text.includes("Guardar Cambios"), viewportName, "FROZEN expone guardado en EasyStats");

  await page.evaluate(async () => {
    window.__lifecycle.frozen = false;
    window.__lifecycle.game.edit_state = "LOCKED";
    await window.__renderEasy();
  });
  const lockedEasy = await inspect(page);
  assertCondition(lockedEasy.text.includes("Partido cerrado"), viewportName, "EasyStats no bloquea partido LOCKED");
  assertCondition(!lockedEasy.text.includes("Guardar Cambios"), viewportName, "LOCKED expone guardado en EasyStats");

  const boxPermission = await page.evaluate(() => window.__checkBoxScorePermission());
  assertCondition(boxPermission.allowed, viewportName, "Acta completa no acepta EDIT_BOXSCORE independiente");
  assertCondition(boxPermission.calls.length === 1, viewportName, "Acta completa realiza evaluación de permiso inesperada");
  assertCondition(boxPermission.calls[0].permission === "EDIT_BOXSCORE", viewportName, "Acta completa sigue usando EDIT_GAME");
  assertCondition(boxPermission.calls[0].context?.teamSeasonId === TEAM_SEASON_ID, viewportName, "EDIT_BOXSCORE pierde contexto de temporada");
  await page.evaluate(async () => {
    window.__lifecycle.frozen = false;
    window.__lifecycle.game.edit_state = "LOCKED";
    window.__lifecycle.game.lock_reason = "QA lock";
    await window.__renderGames();
  });
  const lockedList = await inspect(page);
  assertCondition(lockedList.hasReopen, viewportName, "Admin no recibe acción Reabrir en LOCKED");
  assertCondition(!lockedList.hasEdit, viewportName, "LOCKED mantiene acceso de edición desde listado");

  await page.locator(".btn-reopen-game").click();
  await page.waitForFunction(() => window.__lifecycle.lockCalls.some(call => call.locked === false));
  const reopenedList = await inspect(page);
  assertCondition(!reopenedList.hasReopen, viewportName, "Reapertura no actualiza acción de ciclo de vida");
  assertCondition(reopenedList.hasEdit, viewportName, "Partido reabierto no recupera edición autorizada");

  const reopenCall = reopenedList.lockCalls.find(call => call.locked === false);
  assertCondition(reopenCall?.gameId === GAME_ID, viewportName, "Reapertura actúa sobre partido incorrecto");

  await page.evaluate(async () => {
    window.__lifecycle.frozen = true;
    window.__lifecycle.game.edit_state = "LOCKED";
    await window.__renderGames();
  });
  const frozenList = await inspect(page);
  assertCondition(frozenList.text.includes("Temporada cerrada"), viewportName, "Listado no comunica FROZEN");
  assertCondition(!frozenList.hasReopen, viewportName, "FROZEN permite reabrir partido individual");
  assertCondition(!frozenList.hasEdit, viewportName, "FROZEN permite edición de partido");
  assertCondition(!frozenList.overflow, viewportName, "Ciclo de partido desborda horizontalmente viewport");
  assertCondition(pageErrors.length === 0, viewportName, "pageerror: " + pageErrors.join(" | "));

  console.log(JSON.stringify({
    viewport: viewportName,
    livePermission: livePermission.permission,
    actaHiddenWithoutPermission: !openEasy.hasActaMode,
    actaVisibleWithPermission: fullEntry.hasActaMode,
    frozenBlocked: frozenEasy.text.includes("Temporada cerrada"),
    lockedBlocked: lockedEasy.text.includes("Partido cerrado"),
    reopenedEditable: reopenedList.hasEdit,
    freezeSuppressesReopen: !frozenList.hasReopen,
    result: "PASS"
  }));
  await page.close();
}
const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await runViewport(browser, "iphone-390x844", { width: 390, height: 844 });
  console.log("GAME_LIFECYCLE_MOBILE_UI_OK");
} finally {
  await browser.close();
}
