import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.PLAYER360_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function installFixture(page, viewportName) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ TEAM_ID, TEAM_SEASON_ID, viewportName }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { TrainingView } = await import("/views/TrainingView.js");
    const { LayoutView } = await import("/views/LayoutView.js");
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

    const seasonContext = {
      team_season_id: TEAM_SEASON_ID,
      teamSeasonId: TEAM_SEASON_ID,
      team_id: TEAM_ID,
      teamId: TEAM_ID,
      name: "2025/2026",
      start_date: "2025-09-01",
      end_date: "2026-06-30",
      source: "v3"
    };

    // Use deterministic in-memory DataStore selectors so no real backend is used.
    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
    DataStore.getActiveSeasonContext = () => seasonContext;
    DataStore.getActiveSeasonDisplayName = () => "2025/2026";
    DataStore.getTeamById = () => ({ id: TEAM_ID, name: "Equipo Demo" });
    DataStore.getTeams = () => [{ id: TEAM_ID, name: "Equipo Demo" }];
    DataStore.getSeasonParticipantPlayers = () => players;
    DataStore.getTeamPlayers = () => players;
    DataStore.getPlayersForActiveSeason = () => players;
    DataStore.getPlayersEligibleOnDate = (_teamId, date) => {
      if (String(date) < "2026-02-01") return [players[0]];
      return players;
    };
    DataStore.seasons = [seasonContext];

    const auth = new PermissionService();
    auth.setCurrentUser({
      id: "coach-user",
      email: "coach@example.com",
      role: "ENTRENADOR",
      global_role: "ENTRENADOR",
      assigned_team_ids: [TEAM_ID],
      allowed_team_season_ids: [TEAM_SEASON_ID],
      contextualMemberships: [
        {
          team_season_id: TEAM_SEASON_ID,
          team_id: TEAM_ID,
          function_role: "ENTRENADOR",
          status: "ACTIVE"
        }
      ]
    });

    // Validate navigation with the real LayoutView markup, but keep it
    // detached from the bootstrapped SPA. The component smoke below gets its
    // own host so the app router cannot replace the test DOM on mobile.
    const coachNavScratch = document.createElement("div");
    coachNavScratch.innerHTML = LayoutView.wrap(
      '<div id="dashboard-content-area"></div>',
      "training",
      "ENTRENADOR"
    );

    const trainingNav = coachNavScratch.querySelector(
      '.nav-link[data-route-key="training"]'
    );
    const trainingDrawer = coachNavScratch.querySelector(
      '.drawer-item[data-route-key="training"]'
    );

    window.__p360NavCheck = {
      desktopExists: Boolean(trainingNav),
      desktopHref: trainingNav?.getAttribute("href") || "",
      desktopLocked: trainingNav?.classList.contains("disabled-link") || false,
      drawerExists: Boolean(trainingDrawer),
      drawerHref: trainingDrawer?.getAttribute("href") || "",
      drawerLocked: trainingDrawer?.classList.contains("disabled-link") || false
    };

    // Also verify the same real navigation is locked for JUGADOR.
    const scratch = document.createElement("div");
    scratch.innerHTML = LayoutView.wrap(
      '<div id="dashboard-content-area"></div>',
      "dashboard",
      "JUGADOR"
    );
    const playerTrainingNav = scratch.querySelector(
      '.nav-link[data-route-key="training"]'
    );
    const playerTrainingDrawer = scratch.querySelector(
      '.drawer-item[data-route-key="training"]'
    );
    window.__p360PlayerNavCheck = {
      desktopLocked: playerTrainingNav?.classList.contains("disabled-link") || false,
      desktopHref: playerTrainingNav?.getAttribute("href") || "",
      drawerLocked: playerTrainingDrawer?.classList.contains("disabled-link") || false,
      drawerHref: playerTrainingDrawer?.getAttribute("href") || ""
    };

    const guestScratch = document.createElement("div");
    guestScratch.innerHTML = LayoutView.wrap(
      '<div id="dashboard-content-area"></div>',
      "training",
      "INVITADO"
    );
    const guestTrainingNav = guestScratch.querySelector(
      '.nav-link[data-route-key="training"]'
    );
    const guestTrainingDrawer = guestScratch.querySelector(
      '.drawer-item[data-route-key="training"]'
    );
    window.__p360GuestNavCheck = {
      desktopLocked: guestTrainingNav?.classList.contains("disabled-link") || false,
      desktopHref: guestTrainingNav?.getAttribute("href") || "",
      drawerLocked: guestTrainingDrawer?.classList.contains("disabled-link") || false,
      drawerHref: guestTrainingDrawer?.getAttribute("href") || ""
    };

    // Isolated real TrainingView host. Existing SPA listeners may remain on
    // window, but they have no #app node to overwrite and therefore cannot
    // race with the component under test.
    document.body.innerHTML = '<main id="p360-test-host" style="min-height:100vh;width:100%;"></main>';

    window.__p360 = {
      viewportName,
      createCalls: [],
      attendanceCalls: [],
      externalCalls: [],
      archiveCalls: [],
      sessions: [
        {
          id: "session-existing",
          team_season_id: TEAM_SEASON_ID,
          session_date: "2026-02-05",
          title: "Sesión existente",
          objective: "Trabajo técnico",
          duration_minutes: 75,
          intensity: 6.5,
          status: "PLANNED",
          blocks: [
            {
              id: "block-existing",
              training_session_id: "session-existing",
              block_order: 1,
              title: "Finalizaciones",
              activity_code: "FINISHING",
              duration_minutes: 20,
              intensity: 7
            }
          ],
          participants: [
            {
              id: "participant-existing",
              training_session_id: "session-existing",
              player_id: players[0].id,
              attendance_status: "PRESENT",
              participated_minutes: 60,
              rpe: 6,
              internal_load: 360,
              notes: ""
            }
          ]
        }
      ],
      external: [
        {
          id: "external-existing",
          team_season_id: TEAM_SEASON_ID,
          player_id: players[0].id,
          activity_date: "2026-02-06",
          title: "Tecnificación tiro",
          provider_name: "Academia Demo",
          source_type: "EXTERNAL_COACH",
          duration_minutes: 50,
          intensity: 6,
          rpe: 5,
          internal_load: 250,
          objective: "Tiro exterior"
        }
      ]
    };

    const view = new TrainingView(null, auth);
    window.__p360View = view;

    view.service.getCapabilities = async () => ({
      ready: true,
      training_core: true,
      external_development: true,
      activity_catalog: true,
      temporal_roster_validation: true
    });
    view.service.listActivityTypes = async () => [];
    view.service.listSessions = async () =>
      window.__p360.sessions.map(row => ({
        ...row,
        blocks: (row.blocks || []).map(item => ({ ...item })),
        participants: (row.participants || []).map(item => ({ ...item }))
      }));
    view.service.listExternalDevelopment = async () =>
      window.__p360.external.map(row => ({ ...row }));

    view.service.createSession = async args => {
      window.__p360.createCalls.push(structuredClone(args));
      const id = "session-created";
      window.__p360.sessions.unshift({
        id,
        team_season_id: args.teamSeasonId,
        session_date: args.sessionDate,
        title: args.title,
        objective: args.objective,
        duration_minutes: args.durationMinutes,
        intensity: args.intensity,
        status: "PLANNED",
        blocks: (args.blocks || []).map((block, index) => ({
          id: "new-block-" + index,
          training_session_id: id,
          ...block
        })),
        participants: (args.participants || []).map((participant, index) => ({
          id: "new-participant-" + index,
          training_session_id: id,
          player_id: participant.player_id,
          attendance_status: participant.attendance_status,
          participated_minutes: participant.participated_minutes ?? null,
          rpe: null,
          internal_load: null,
          notes: null
        }))
      });
      return id;
    };

    view.service.setParticipant = async args => {
      window.__p360.attendanceCalls.push(structuredClone(args));
      const session = window.__p360.sessions.find(
        item => item.id === args.trainingSessionId
      );
      if (!session) throw new Error("TEST_SESSION_NOT_FOUND");

      let participant = session.participants.find(
        item => item.player_id === args.playerId
      );
      if (!participant) {
        participant = {
          id: "participant-added",
          training_session_id: session.id,
          player_id: args.playerId
        };
        session.participants.push(participant);
      }

      participant.attendance_status = args.attendanceStatus;
      participant.participated_minutes = args.participatedMinutes;
      participant.rpe = args.rpe;
      participant.notes = args.notes;
      participant.internal_load =
        Number.isFinite(Number(args.participatedMinutes))
        && Number.isFinite(Number(args.rpe))
          ? Number(args.participatedMinutes) * Number(args.rpe)
          : null;

      // Simulate a small real network turn so the physical tap completes before
      // TrainingView replaces the DOM after the persisted operation.
      await new Promise(resolve => setTimeout(resolve, 40));
      return participant.id;
    };

    view.service.archiveSession = async id => {
      window.__p360.archiveCalls.push(id);
      const session = window.__p360.sessions.find(item => item.id === id);
      if (session) session.status = "ARCHIVED";
      return true;
    };

    view.service.createExternalDevelopment = async args => {
      window.__p360.externalCalls.push(structuredClone(args));
      window.__p360.external.unshift({
        id: "external-created",
        team_season_id: args.teamSeasonId,
        player_id: args.playerId,
        activity_date: args.activityDate,
        title: args.title,
        provider_type: args.providerType,
        provider_name: args.providerName,
        objective: args.objective,
        duration_minutes: args.durationMinutes,
        intensity: args.intensity,
        rpe: args.rpe,
        source_type: args.sourceType,
        notes: args.notes,
        internal_load:
          Number.isFinite(Number(args.durationMinutes))
          && Number.isFinite(Number(args.rpe))
            ? Number(args.durationMinutes) * Number(args.rpe)
            : null
      });
      return "external-created";
    };

    await view.render("p360-test-host", TEAM_ID);
  }, { TEAM_ID, TEAM_SEASON_ID, viewportName });
}

async function runViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => {
    pageErrors.push(error.message);
    console.log(`[${name}] BROWSER_PAGE_ERROR ${error.message}`);
  });
  page.on("console", message => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
      console.log(`[${name}] BROWSER_CONSOLE_ERROR ${message.text()}`);
    }
  });
  page.on("dialog", async dialog => {
    console.log(`[${name}] BROWSER_DIALOG ${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });

  await installFixture(page, name);

  const nav = await page.evaluate(() => ({
    coach: window.__p360NavCheck,
    player: window.__p360PlayerNavCheck,
    guest: window.__p360GuestNavCheck
  }));

  assertCondition(nav.coach.desktopExists, name, "Falta navegación desktop de Training");
  assertCondition(nav.coach.desktopHref === "#/training", name, "Training desktop no apunta a #/training");
  assertCondition(!nav.coach.desktopLocked, name, "Training aparece bloqueado para ENTRENADOR");
  assertCondition(nav.coach.drawerExists, name, "Falta navegación móvil de Training");
  assertCondition(nav.coach.drawerHref === "#/training", name, "Training móvil no apunta a #/training");
  assertCondition(nav.player.desktopLocked, name, "Training no queda bloqueado para JUGADOR en desktop");
  assertCondition(nav.player.drawerLocked, name, "Training no queda bloqueado para JUGADOR en móvil");
  assertCondition(nav.guest.desktopHref === "#/training", name, "INVITADO desktop no apunta a Training");
  assertCondition(nav.guest.drawerHref === "#/training", name, "INVITADO móvil no apunta a Training");
  assertCondition(!nav.guest.desktopLocked, name, "Training aparece bloqueado para INVITADO en desktop");
  assertCondition(!nav.guest.drawerLocked, name, "Training aparece bloqueado para INVITADO en móvil");

  const core = await page.evaluate(() => ({
    title: document.querySelector(".p360-hero h1")?.textContent || "",
    sessionCards: document.querySelectorAll(".p360-session-card").length,
    hasExternalTab: Boolean(document.querySelector('[data-p360-tab="external"]')),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    trainingMin: document.querySelector("#p360-training-date")?.getAttribute("min") || null,
    trainingMax: document.querySelector("#p360-training-date")?.getAttribute("max") || null,
    heroTitleColor: getComputedStyle(document.querySelector(".p360-hero h1")).color,
    heroPillColor: getComputedStyle(document.querySelector(".p360-context-pill")).color,
    durationReadOnly: Boolean(document.querySelector("#p360-training-duration")?.readOnly)
  }));

  assertCondition(core.title.includes("Player 360"), name, "No se renderiza Player 360 Training");
  assertCondition(core.sessionCards === 1, name, "Histórico inicial incorrecto");
  assertCondition(core.hasExternalTab, name, "Falta pestaña Desarrollo externo");
  assertCondition(!core.horizontalOverflow, name, "Overflow horizontal en estado inicial");
  assertCondition(core.trainingMin === "2025-09-01", name, "Min de temporada incorrecto");
  assertCondition(core.trainingMax === "2026-06-30", name, "Max de temporada incorrecto");
  assertCondition(core.heroTitleColor === "rgb(255, 255, 255)", name, "Título hero sin contraste suficiente");
  assertCondition(core.heroPillColor === "rgb(255, 255, 255)", name, "Contexto hero sin contraste suficiente");
  assertCondition(core.durationReadOnly, name, "Duración debe ser derivada y no editable");

  // Cancelling a training draft must discard local state and never persist.
  await page.locator("#p360-create-training-panel").evaluate(el => { el.open = true; });
  await page.fill("#p360-training-title", "Borrador cancelado");
  await page.click("#p360-select-all-players");
  await page.click("#p360-add-block");
  await page.locator(".p360-block-row").nth(1).locator(".p360-block-title").fill("Bloque temporal");
  await page.click("#p360-cancel-training");

  const cancelledTraining = await page.evaluate(() => ({
    panelOpen: document.querySelector("#p360-create-training-panel")?.open ?? true,
    title: document.querySelector("#p360-training-title")?.value || "",
    blocks: document.querySelectorAll(".p360-block-row").length,
    checkedPlayers: document.querySelectorAll('input[name="p360-training-player"]:checked').length,
    createCalls: window.__p360.createCalls.length
  }));
  assertCondition(!cancelledTraining.panelOpen, name, "Cancelar entrenamiento no cierra el panel");
  assertCondition(cancelledTraining.title === "", name, "Cancelar entrenamiento no limpia el título");
  assertCondition(cancelledTraining.blocks === 1, name, "Cancelar entrenamiento no restaura un único bloque vacío");
  assertCondition(cancelledTraining.checkedPlayers === 0, name, "Cancelar entrenamiento no limpia jugadores seleccionados");
  assertCondition(cancelledTraining.createCalls === 0, name, "Cancelar entrenamiento provoca una escritura");

  // Create session: exact-date eligibility should change the player checklist.
  await page.locator("#p360-create-training-panel").evaluate(el => { el.open = true; });
  await page.fill("#p360-training-date", "2026-01-15");
  await page.dispatchEvent("#p360-training-date", "change");
  let playerOptions = await page.locator('input[name="p360-training-player"]').count();
  assertCondition(playerOptions === 1, name, "La elegibilidad por fecha no filtra jugadores");

  await page.fill("#p360-training-date", "2026-02-10");
  await page.dispatchEvent("#p360-training-date", "change");
  playerOptions = await page.locator('input[name="p360-training-player"]').count();
  assertCondition(playerOptions === 2, name, "La elegibilidad posterior no incorpora al jugador");

  await page.click("#p360-select-all-players");
  await page.fill("#p360-training-title", "Sesión creada por UI smoke");
  await page.fill("#p360-training-start-time", "18:00");
  await page.fill("#p360-training-end-time", "19:30");
  await page.fill("#p360-training-intensity", "7.5");

  const derivedDuration = await page.locator("#p360-training-duration").inputValue();
  assertCondition(derivedDuration === "90", name, "La duración no se calcula desde inicio/fin");
  await page.fill(".p360-block-title", "Tiro tras bote");
  await page.fill(".p360-block-code", "SHOOTING");
  await page.fill(".p360-block-duration", "25");
  await page.fill(".p360-block-intensity", "8");

  const addBlockButton = page.locator("#p360-add-block");
  await addBlockButton.evaluate(el => {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  });
  await page.waitForTimeout(80);

  const addBlockGeometry = await addBlockButton.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  });

  assertCondition(
    addBlockGeometry.top >= -1
      && addBlockGeometry.bottom <= addBlockGeometry.viewportHeight + 1
      && addBlockGeometry.left >= -1
      && addBlockGeometry.right <= addBlockGeometry.viewportWidth + 1,
    name,
    "Añadir bloque no puede situarse completamente dentro del viewport móvil"
  );

  await addBlockButton.click();
  const blockRows = await page.locator(".p360-block-row").count();
  assertCondition(blockRows === 2, name, "Añadir bloque no funciona");
  const second = page.locator(".p360-block-row").nth(1);
  await second.locator(".p360-block-title").fill("Ventajas 2c1");
  await second.locator(".p360-block-duration").fill("20");

  await page.locator("#p360-training-form").evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => window.__p360.createCalls.length === 1);
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll(".p360-session-card")];
    return cards.length === 2
      && cards.some(card => card.textContent?.includes("Sesión creada por UI smoke"));
  });

  const createCall = await page.evaluate(() => window.__p360.createCalls[0]);
  assertCondition(createCall.teamSeasonId === TEAM_SEASON_ID, name, "Alta usa team-season incorrecto");
  assertCondition(createCall.sessionDate === "2026-02-10", name, "Alta usa fecha incorrecta");
  assertCondition(createCall.blocks.length === 2, name, "Alta no envía dos bloques");
  assertCondition(createCall.durationMinutes === 90, name, "Alta no envía duración derivada");
  assertCondition(createCall.startTime === "18:00", name, "Alta no envía hora de inicio");
  assertCondition(createCall.endTime === "19:30", name, "Alta no envía hora de fin");
  assertCondition(createCall.participants.length === 2, name, "Alta no envía plantilla seleccionada");
  assertCondition(
    createCall.participants.every(row => row.attendance_status === "PRESENT"),
    name,
    "Una sesión histórica debe crear los seleccionados como presentes"
  );
  assertCondition(
    createCall.participants.every(row => row.participated_minutes === 90),
    name,
    "Los presentes de una sesión histórica deben heredar la duración completa"
  );

  // Attendance/RPE edit of the existing session.
  const existingCard = page.locator(".p360-session-card").filter({ hasText: "Sesión existente" });
  await existingCard.locator(".p360-attendance-panel").evaluate(el => { el.open = true; });
  const attendanceRow = existingCard.locator(".p360-attendance-row").first();
  await attendanceRow.locator(".p360-att-status").selectOption("PARTIAL");
  await attendanceRow.locator(".p360-att-minutes").fill("50");
  await attendanceRow.locator(".p360-att-rpe").fill("7");
  await attendanceRow.locator(".p360-att-notes").fill("Smoke carga");
  const saveAttendanceButton = attendanceRow.locator(".p360-save-attendance");
  await saveAttendanceButton.scrollIntoViewIfNeeded();
  await saveAttendanceButton.evaluate(el => {
    el.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await page.waitForTimeout(120);
  const attendanceButtonGeometry = await saveAttendanceButton.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  });
  assertCondition(
    attendanceButtonGeometry.top >= -1
      && attendanceButtonGeometry.bottom <= attendanceButtonGeometry.viewportHeight + 1
      && attendanceButtonGeometry.left >= -1
      && attendanceButtonGeometry.right <= attendanceButtonGeometry.viewportWidth + 1,
    name,
    "Guardar asistencia no queda completamente dentro del viewport"
  );
  await saveAttendanceButton.click();
  await page.waitForFunction(() => window.__p360.attendanceCalls.length === 1);
  await page.waitForTimeout(300);

  const attendanceRenderState = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".p360-session-card")]
      .find(node => node.textContent?.includes("Sesión existente"));
    const session = window.__p360.sessions.find(
      item => item.id === "session-existing"
    );
    return {
      callCount: window.__p360.attendanceCalls.length,
      memoryLoad: session?.participants?.[0]?.internal_load ?? null,
      memoryStatus: session?.participants?.[0]?.attendance_status ?? null,
      visibleLoad: card?.querySelector(".p360-load-value strong")?.textContent || "",
      visibleStatus: card?.querySelector(".p360-att-status")?.value || "",
      title: document.querySelector(".p360-hero h1")?.textContent || "",
      trainingViewExists: Boolean(document.querySelector(".p360-training-view")),
      externalTabExists: Boolean(document.querySelector('[data-p360-tab="external"]')),
      lastError: window.__p360View?.lastError?.message || "",
      activeTab: window.__p360View?.activeTab || "",
      capabilityReady: Boolean(window.__p360View?.capabilities?.ready),
      contentPreview: String(
        document.querySelector("#p360-test-host")?.textContent || ""
      ).replace(/\s+/g, " ").trim().slice(0, 600)
    };
  });
  console.log(JSON.stringify({ viewport: name, attendanceRenderState }));

  assertCondition(
    String(attendanceRenderState.visibleLoad).includes("350"),
    name,
    "La asistencia persiste en memoria pero no se refleja en UI: "
      + JSON.stringify(attendanceRenderState)
  );

  const attendanceCall = await page.evaluate(() => window.__p360.attendanceCalls[0]);
  assertCondition(attendanceCall.attendanceStatus === "PARTIAL", name, "Asistencia no envía estado");
  assertCondition(attendanceCall.participatedMinutes === 50, name, "Asistencia no envía minutos");
  assertCondition(attendanceCall.rpe === 7, name, "Asistencia no envía RPE");

  // Give any unrelated app-level render a chance to surface. The snapshot makes
  // a disappearing TrainingView diagnosable instead of hiding it behind a
  // locator timeout.
  await page.waitForTimeout(250);
  const postAttendanceState = await page.evaluate(() => {
    const content = document.querySelector("#p360-test-host");
    return {
      hash: window.location.hash,
      title: document.querySelector(".p360-hero h1")?.textContent || "",
      trainingViewExists: Boolean(document.querySelector(".p360-training-view")),
      externalTabExists: Boolean(document.querySelector('[data-p360-tab="external"]')),
      sessionCards: document.querySelectorAll(".p360-session-card").length,
      textPreview: String(content?.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500)
    };
  });
  console.log(JSON.stringify({ viewport: name, postAttendanceState }));

  assertCondition(
    postAttendanceState.trainingViewExists,
    name,
    "TrainingView desaparece tras guardar asistencia: " + JSON.stringify(postAttendanceState)
  );
  assertCondition(
    postAttendanceState.externalTabExists,
    name,
    "Desarrollo externo desaparece tras guardar asistencia: " + JSON.stringify(postAttendanceState)
  );

  // External development.
  const externalTab = page.locator('[data-p360-tab="external"]');
  await externalTab.evaluate(el => {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  });
  await page.waitForTimeout(80);
  const externalTabGeometry = await externalTab.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  });
  assertCondition(
    externalTabGeometry.top >= 0
      && externalTabGeometry.bottom <= externalTabGeometry.viewportHeight
      && externalTabGeometry.left >= 0
      && externalTabGeometry.right <= externalTabGeometry.viewportWidth,
    name,
    "La pestaña Desarrollo externo no queda dentro del viewport"
  );
  await externalTab.click();

  // Cancelling external development/technification must also discard the draft.
  await page.locator("#p360-create-external-panel").evaluate(el => { el.open = true; });
  await page.fill("#p360-external-date", "2026-02-10");
  await page.dispatchEvent("#p360-external-date", "change");
  await page.selectOption("#p360-external-player", "10000000-0000-4000-8000-000000000002");
  await page.fill("#p360-external-title", "Tecnificación cancelada");
  await page.fill("#p360-external-provider", "Academia temporal");
  await page.click("#p360-cancel-external");

  const cancelledExternal = await page.evaluate(() => ({
    panelOpen: document.querySelector("#p360-create-external-panel")?.open ?? true,
    title: document.querySelector("#p360-external-title")?.value || "",
    playerId: document.querySelector("#p360-external-player")?.value || "",
    externalCalls: window.__p360.externalCalls.length
  }));
  assertCondition(!cancelledExternal.panelOpen, name, "Cancelar tecnificación no cierra el panel");
  assertCondition(cancelledExternal.title === "", name, "Cancelar tecnificación no limpia la actividad");
  assertCondition(cancelledExternal.playerId === "", name, "Cancelar tecnificación no limpia el jugador");
  assertCondition(cancelledExternal.externalCalls === 0, name, "Cancelar tecnificación provoca una escritura");

  await page.locator("#p360-create-external-panel").evaluate(el => { el.open = true; });
  await page.fill("#p360-external-date", "2026-02-10");
  await page.dispatchEvent("#p360-external-date", "change");
  await page.selectOption("#p360-external-player", "10000000-0000-4000-8000-000000000002");
  await page.fill("#p360-external-title", "Tecnificación individual");
  await page.fill("#p360-external-provider", "Academia Test");
  await page.fill("#p360-external-duration", "60");
  await page.fill("#p360-external-intensity", "6");
  await page.fill("#p360-external-rpe", "5");
  await page.fill("#p360-external-objective", "Mejorar tiro");
  await page.locator("#p360-external-form").evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => window.__p360.externalCalls.length === 1);
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll(".p360-external-card")];
    return cards.length === 2
      && cards.some(card => card.textContent?.includes("Tecnificación individual"));
  });

  const externalCall = await page.evaluate(() => window.__p360.externalCalls[0]);
  assertCondition(externalCall.teamSeasonId === TEAM_SEASON_ID, name, "Externo usa team-season incorrecto");
  assertCondition(externalCall.playerId.endsWith("0002"), name, "Externo usa jugador incorrecto");
  assertCondition(externalCall.sourceType === "EXTERNAL_COACH", name, "Externo pierde provenance source");
  assertCondition(
    externalCall.provenance?.entered_from === "IQBASKET_PLAYER360_UI",
    name,
    "Externo pierde provenance de UI"
  );

  const finalGeometry = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    formWidth: document.querySelector(".p360-training-view")?.getBoundingClientRect().width || 0,
    viewportWidth: window.innerWidth,
    externalCards: document.querySelectorAll(".p360-external-card").length
  }));
  assertCondition(!finalGeometry.horizontalOverflow, name, "Overflow horizontal tras interacciones");
  assertCondition(finalGeometry.formWidth <= finalGeometry.viewportWidth + 1, name, "TrainingView excede viewport");
  assertCondition(finalGeometry.externalCards === 2, name, "Desarrollo externo no se refresca");

  const relevantConsoleErrors = consoleErrors.filter(message =>
    !/favicon|Failed to load resource.*404/i.test(message)
  );
  assertCondition(pageErrors.length === 0, name, "pageerror: " + pageErrors.join(" | "));
  assertCondition(relevantConsoleErrors.length === 0, name, "console error: " + relevantConsoleErrors.join(" | "));

  console.log(JSON.stringify({
    viewport: name,
    nav,
    core,
    createCall,
    attendanceCall,
    externalCall,
    finalGeometry,
    result: "PASS"
  }));

  await page.close();
}

function assertCondition(condition, viewport, message) {
  if (!condition) throw new Error(`[${viewport}] ${message}`);
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await runViewport(browser, "iphone-390x844", { width: 390, height: 844 });
  console.log("PLAYER360_PHASE4B_UI_OK");
} finally {
  await browser.close();
}
