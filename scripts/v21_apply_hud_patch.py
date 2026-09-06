from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "views/LiveScoreHUDView.js"
text = PATH.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    'import { Permission } from "../security/PermissionService.js";\n',
    'import { Permission } from "../security/PermissionService.js";\n'
    'import { GameCaptureDelegationService } from "../services/games/GameCaptureDelegationService.js";\n'
    'import { GamePlayStateService } from "../services/games/GamePlayStateService.js";\n',
    "imports",
)

replace_once(
    '''    this.auth = authController;
    this.gameId = gameId;

    this.currentStep = 1;''',
    '''    this.auth = authController;
    this.gameId = gameId;
    this.captureService = new GameCaptureDelegationService(this.auth?.supabase || null);
    this.playStateService = new GamePlayStateService(this.auth?.supabase || null);
    this.gameSnapshot = null;
    this.snapshotLoaded = false;
    this.isExistingGame = Boolean(gameId);
    this.existingStatsByPlayerId = new Map();

    this.currentStep = 1;''',
    "constructor",
)

replace_once(
    '''  _getPeriodDuration(periodName) {
    return periodName.startsWith("OT") ? this.config.overtimeSeconds : this.config.periodSeconds;
  }

  async render(containerId = "dashboard-content-area") {''',
    '''  _getPeriodDuration(periodName) {
    return periodName.startsWith("OT") ? this.config.overtimeSeconds : this.config.periodSeconds;
  }

  _gameContext() {
    const game = this.gameSnapshot?.game || (this.gameId ? DataStore.getGameById?.(this.gameId) : null);
    return {
      gameId: this.gameId || game?.id || null,
      teamId: game?.team_id || game?.teamId || DataStore.getActiveTeamId?.() || null,
      teamSeasonId: game?.team_season_id || game?.teamSeasonId || DataStore.getActiveTeamSeasonId?.() || null,
      seasonId: game?.season_id || game?.seasonId || null
    };
  }

  _can(permission) {
    const context = this._gameContext();
    if (typeof this.auth?.canPreview === "function") return Boolean(this.auth.canPreview(permission, context));
    if (typeof this.auth?.can === "function") return Boolean(this.auth.can(permission, context));
    return false;
  }

  _secondsToClock(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  _clockToSeconds(value, fallback = this.config.periodSeconds) {
    const match = String(value || "").match(/^(\\d{1,2}):(\\d{2})$/);
    if (!match) return fallback;
    return Math.max(0, (Number(match[1]) * 60) + Number(match[2]));
  }

  _periodNumberForName(periodName) {
    const localNumber = parseInt(String(periodName || "1").replace(/[^\\d]/g, ""), 10) || 1;
    if (!String(periodName || "").startsWith("OT")) return localNumber;
    const regulationCount = Number(this.gameSnapshot?.game?.periods_count || (this.config.format === "minibasket" ? 6 : 4));
    return regulationCount + localNumber;
  }

  _periodNameFromNumber(periodNumber, isOvertime = false) {
    const regulationCount = Number(this.gameSnapshot?.game?.periods_count || 4);
    const value = Number(periodNumber) || 1;
    if (isOvertime || value > regulationCount) {
      const overtimeNumber = value > regulationCount ? value - regulationCount : value;
      return `OT${Math.max(1, overtimeNumber)}`;
    }
    return `${regulationCount === 6 ? "P" : "Q"}${value}`;
  }

  async _loadExistingGameSnapshot() {
    if (!this.gameId || this.snapshotLoaded) return;
    const snapshot = await this.captureService.getSnapshot(this.gameId);
    if (!snapshot?.game?.id) throw new Error("No se pudo resolver el partido solicitado.");

    this.gameSnapshot = snapshot;
    this.snapshotLoaded = true;
    const game = snapshot.game;
    const regulationCount = Math.max(1, Number(game.periods_count || 4));
    const periodMinutes = Math.max(1, Number(game.period_minutes || 10));
    this.config.periodSeconds = periodMinutes * 60;
    this.config.format = regulationCount === 6 ? "minibasket" : `${regulationCount}x${periodMinutes}`;
    this.config.date = game.date || this.config.date;
    this.config.opponent = game.opponent || "Rival";
    this.config.venue = game.venue || "Local";
    this.teamScore = Number(game.team_score || 0);
    this.opponentScore = Number(game.opponent_score || 0);

    const starters = new Set(Array.isArray(game.starter_ids) ? game.starter_ids.map(String) : []);
    this.roster = (snapshot.players || []).map((player, index) => ({
      id: String(player.id),
      name: `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Jugador",
      jersey: String(player.jersey ?? index + 4),
      isConvoked: true,
      isStarter: starters.has(String(player.id))
    }));
    this.existingStatsByPlayerId = new Map((snapshot.stats || []).map(stat => [String(stat.player_id), stat]));
    this._syncOnCourtFromStarters();

    const regulationNames = Array.from({ length: regulationCount }, (_, index) => `${regulationCount === 6 ? "P" : "Q"}${index + 1}`);
    const overtimeNumbers = (snapshot.periods || [])
      .filter(period => Boolean(period.is_overtime) || Number(period.period_number) > regulationCount)
      .map(period => Math.max(1, Number(period.period_number) - regulationCount));
    const overtimeCount = overtimeNumbers.length ? Math.max(...overtimeNumbers) : 0;
    this.periodsList = [...regulationNames, ...Array.from({ length: overtimeCount }, (_, index) => `OT${index + 1}`)];

    const playerNames = new Map(this.roster.map(player => [player.id, player.name]));
    this.playByPlayEvents = (snapshot.events || []).map((event, index) => {
      const action = String(event.action_type || "");
      const isOpponent = action.startsWith("opp_");
      const periodName = this._periodNameFromNumber(event.period, Number(event.period) > regulationCount);
      const timeRemaining = this._clockToSeconds(event.game_clock, this._getPeriodDuration(periodName));
      return {
        id: String(event.id || `loaded-${index}`),
        isOpponent,
        period: periodName,
        timeRemaining,
        game_clock: event.game_clock || this._secondsToClock(timeRemaining),
        action,
        action_type: action,
        event_type: action,
        actionLabel: this._getActionLabelSpanish(action),
        points: Number(event.points || 0),
        playerId: event.player_id ? String(event.player_id) : null,
        player_id: event.player_id ? String(event.player_id) : null,
        playerName: isOpponent ? "Rival" : (playerNames.get(String(event.player_id)) || "Jugador"),
        coord_x: event.coord_x ?? null,
        coord_y: event.coord_y ?? null,
        made: Boolean(event.made),
        onCourt: []
      };
    });

    const lastEvent = this.playByPlayEvents[this.playByPlayEvents.length - 1];
    this.currentPeriod = lastEvent?.period || this.periodsList[0] || "Q1";
    this.timeRemaining = lastEvent?.timeRemaining ?? this._getPeriodDuration(this.currentPeriod);
    const playState = String(game.play_state || "SCHEDULED").toUpperCase();
    this.currentStep = playState === "FINISHED" ? 4 : playState === "LIVE" ? 2 : 1;
  }

  async _ensureExistingGameLive() {
    if (!this.isExistingGame) return;
    let state = String(this.gameSnapshot?.game?.play_state || "SCHEDULED").toUpperCase();
    if (state === "CANCELLED") throw new Error("El partido está cancelado y no admite captura.");
    if (state === "FINISHED") throw new Error("El partido ya está finalizado. Usa el acta/BoxScore para corregirlo.");
    if (state === "SCHEDULED") {
      if (!this._can(Permission.PREPARE_GAME)) throw new Error("Necesitas permiso para preparar este partido.");
      await this.playStateService.transition({ gameId: this.gameId, targetState: "READY" });
      state = "READY";
    }
    if (state === "READY") {
      if (!this._can(Permission.START_GAME)) throw new Error("Necesitas permiso para iniciar este partido.");
      await this.playStateService.transition({ gameId: this.gameId, targetState: "LIVE" });
      state = "LIVE";
    }
    if (this.gameSnapshot?.game) this.gameSnapshot.game.play_state = state;
  }

  async _finishExistingGameIfAllowed() {
    if (!this.isExistingGame) return false;
    const state = String(this.gameSnapshot?.game?.play_state || "").toUpperCase();
    if (state !== "LIVE" || !this._can(Permission.FINISH_GAME)) return false;
    await this.playStateService.transition({ gameId: this.gameId, targetState: "FINISHED" });
    if (this.gameSnapshot?.game) this.gameSnapshot.game.play_state = "FINISHED";
    return true;
  }

  async render(containerId = "dashboard-content-area") {''',
    "helpers",
)

replace_once(
    '''    if (!this.auth?.canPreview?.(Permission.RECORD_LIVE_GAME)) {
      container.innerHTML = `''',
    '''    if (!this._can(Permission.RECORD_LIVE_GAME)) {
      container.innerHTML = `''',
    "render permission",
)

replace_once(
    '''      return;
    }

    const activeTeamId = DataStore.getActiveTeamId ? DataStore.getActiveTeamId() : null;
    const allPlayers = (''',
    '''      return;
    }

    if (this.isExistingGame) {
      try {
        await this._loadExistingGameSnapshot();
      } catch (error) {
        container.innerHTML = `
          <div style="padding:24px;background:white;border:1px solid #fecaca;border-radius:12px;color:#991b1b;">
            <h3 style="margin-top:0;">No se pudo abrir el partido</h3>
            <p style="margin-bottom:0;">${String(error?.message || error)}</p>
          </div>`;
        return;
      }
    }

    const activeTeamId = DataStore.getActiveTeamId ? DataStore.getActiveTeamId() : null;
    const allPlayers = this.isExistingGame ? [] : (''',
    "snapshot load",
)

replace_once(
    '''        : (DataStore.getPlayers?.(activeTeamId) || DataStore.getPlayers?.() || [])
    );''',
    '''        : (DataStore.getPlayers?.(activeTeamId) || DataStore.getPlayers?.() || [])
    );''',
    "players closure",
)

# Make existing game identity immutable in the pre-game UI.
for field in ["cfg-game-type", "cfg-format", "cfg-date", "cfg-opponent", "cfg-venue"]:
    token = f'id="{field}"'
    replacement = f'id="{field}" ${{this.isExistingGame ? \'disabled aria-disabled="true"\' : \'\'}}'
    count = text.count(token)
    if count != 1:
        raise RuntimeError(f"{field}: expected 1 match, found {count}")
    text = text.replace(token, replacement, 1)

# Jersey is identity data; a delegated capture session must not mutate it.
replace_once(
    '''class="input-jersey" data-id="${p.id}" value="${p.jersey}" style="''',
    '''class="input-jersey" data-id="${p.id}" value="${p.jersey}" ${this.isExistingGame ? 'disabled aria-disabled="true"' : ''} style="''',
    "jersey readonly",
)

replace_once(
    '''    this.container.querySelector("#btn-start-scoring")?.addEventListener("click", () => {''',
    '''    this.container.querySelector("#btn-start-scoring")?.addEventListener("click", async () => {''',
    "async start",
)

replace_once(
    '''      this.currentStep = 2;
      this.render();
    });''',
    '''      try {
        await this._ensureExistingGameLive();
        this.currentStep = 2;
        await this.render();
      } catch (error) {
        alert(`No se pudo iniciar la captura: ${error.message || error}`);
      }
    });''',
    "start lifecycle",
)

# Existing games preserve stored minutes and, when there are no capture events, stored boxscore values.
replace_once(
    '''    const playerStatsMap = new Map();
    convoked.forEach(p => {
      const autoMin = Math.round(calculatedMinutesMap.get(p.id) || 0);
      playerStatsMap.set(p.id, {
        id: p.id,
        name: p.name,
        jersey: p.jersey,
        min: autoMin,
        pts: 0, t2m: 0, t2a: 0, t3m: 0, t3a: 0, ftm: 0, fta: 0,
        reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fouls: 0, foulsDrawn: 0
      });
    });

    this.playByPlayEvents.forEach(ev => {''',
    '''    const playerStatsMap = new Map();
    const hasCaptureEvents = this.playByPlayEvents.length > 0;
    convoked.forEach(p => {
      const existing = this.existingStatsByPlayerId.get(String(p.id)) || {};
      const calculated = Math.round(calculatedMinutesMap.get(p.id) || 0);
      const storedMinutes = Number(existing.minutes);
      const autoMin = this.isExistingGame && Number.isFinite(storedMinutes) ? storedMinutes : calculated;
      const useStored = this.isExistingGame && !hasCaptureEvents;
      const oreb = useStored ? Number(existing.off_reb || 0) : 0;
      const dreb = useStored ? Number(existing.def_reb || 0) : 0;
      playerStatsMap.set(p.id, {
        id: p.id,
        name: p.name,
        jersey: p.jersey,
        min: autoMin,
        pts: useStored ? Number(existing.points || 0) : 0,
        t2m: useStored ? Number(existing.fg2_made || 0) : 0,
        t2a: useStored ? Number(existing.fg2_attempted || 0) : 0,
        t3m: useStored ? Number(existing.fg3_made || 0) : 0,
        t3a: useStored ? Number(existing.fg3_attempted || 0) : 0,
        ftm: useStored ? Number(existing.ft_made || 0) : 0,
        fta: useStored ? Number(existing.ft_attempted || 0) : 0,
        reb: oreb + dreb,
        oreb,
        dreb,
        ast: useStored ? Number(existing.assists || 0) : 0,
        stl: useStored ? Number(existing.steals || 0) : 0,
        blk: useStored ? Number(existing.blocks || existing.blocks_made || 0) : 0,
        tov: useStored ? Number(existing.turnovers || 0) : 0,
        fouls: useStored ? Number(existing.fouls_committed || 0) : 0,
        foulsDrawn: useStored ? Number(existing.fouls_drawn || 0) : 0
      });
    });

    this.playByPlayEvents.forEach(ev => {''',
    "stored boxscore",
)

# Period numbers and clocks are canonicalized for both new and existing games.
replace_once(
    '''          const pNum = parseInt(pName.replace(/[^\\d]/g, ""), 10) || 1;''',
    '''          const pNum = this._periodNumberForName(pName);''',
    "period numbering",
)
replace_once(
    '''          const pNum = parseInt(String(ev.period || '1').replace(/[^\\d]/g, ""), 10) || 1;''',
    '''          const pNum = this._periodNumberForName(ev.period || "Q1");''',
    "event period numbering",
)
replace_once(
    '''            game_clock: String(ev.game_clock || '10:00'),''',
    '''            game_clock: String(ev.game_clock || this._secondsToClock(ev.timeRemaining ?? this._getPeriodDuration(ev.period || this.currentPeriod))),''',
    "event clock",
)

# Final save uses V21 for an existing game, preserving administrative metadata and preventing duplicates.
replace_once(
    '''        try {
          await DataStore.saveGameAndStats(gameData, statsList, computedPeriodScores, formattedEvents);
          await DataStore.init(activeTeamId, true);

          alert("✅ Partido, cuartos y jugadas registradas con éxito.");
          
          if (window.location.hash === "#/games") {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          } else {
            window.location.hash = "#/games";
          }
        } catch (err) {''',
    '''        try {
          let savedGameId = this.gameId;
          let transitionedToFinished = false;
          if (this.isExistingGame) {
            await this.captureService.saveCapture({
              gameId: this.gameId,
              teamScore: this.teamScore,
              opponentScore: this.opponentScore,
              starterIds: gameData.starter_ids,
              stats: statsList,
              periods: computedPeriodScores,
              events: formattedEvents
            });
            transitionedToFinished = await this._finishExistingGameIfAllowed();
          } else {
            savedGameId = await DataStore.saveGameAndStats(gameData, statsList, computedPeriodScores, formattedEvents);
            await DataStore.init(activeTeamId, true);
          }

          alert(transitionedToFinished
            ? "✅ Partido guardado y finalizado correctamente."
            : "✅ Partido, cuartos y jugadas guardados correctamente.");

          if (savedGameId && this._can(Permission.VIEW_BOXSCORE)) {
            window.location.hash = `#/boxscore/${savedGameId}`;
          } else {
            window.location.hash = "#/dashboard";
          }
        } catch (err) {''',
    "scoped final save",
)

PATH.write_text(text, encoding="utf-8", newline="\n")
print("V21 HUD patch OK")
