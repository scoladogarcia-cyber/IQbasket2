from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "views/GameBoxScoreView.js"
text = PATH.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    'import { GameLockService } from "../services/games/GameLockService.js";\n',
    'import { GameLockService } from "../services/games/GameLockService.js";\n'
    'import { GameCaptureDelegationService } from "../services/games/GameCaptureDelegationService.js";\n',
    "import",
)

replace_once(
    '''    this.auth = authController;
    this.games = [];
    this.players = [];
    this.selectedGameId = null;
    this.gameStats = [];
  }''',
    '''    this.auth = authController;
    this.captureService = new GameCaptureDelegationService(this.supabase);
    this.games = [];
    this.players = [];
    this.selectedGameId = null;
    this.gameStats = [];
    this.gameScopedSnapshot = null;
    this.isGameScopedOnly = false;
  }''',
    "constructor",
)

replace_once(
    '''  _isTeamSeasonFrozen(game = {}) {
    const { teamId } = this._gameContext(game);
    const context = DataStore.getActiveSeasonContext?.(teamId) || null;
    return String(context?.data_status || context?.dataStatus || "ACTIVE").toUpperCase() === "FROZEN";
  }''',
    '''  _isTeamSeasonFrozen(game = {}) {
    const embeddedStatus = game.team_season_data_status || game.teamSeasonDataStatus;
    if (embeddedStatus) return String(embeddedStatus).toUpperCase() === "FROZEN";
    const { teamId } = this._gameContext(game);
    const context = DataStore.getActiveSeasonContext?.(teamId) || null;
    return String(context?.data_status || context?.dataStatus || "ACTIVE").toUpperCase() === "FROZEN";
  }

  async _loadGameScopedSnapshot(gameId) {
    const snapshot = await this.captureService.getSnapshot(gameId);
    if (!snapshot?.game?.id) throw new Error("No se pudo cargar el partido solicitado.");
    this.gameScopedSnapshot = snapshot;
    this.isGameScopedOnly = true;
    this.games = [snapshot.game];
    this.players = Array.isArray(snapshot.players) ? snapshot.players : [];
    this.gameStats = Array.isArray(snapshot.stats) ? snapshot.stats : [];
    return snapshot;
  }''',
    "snapshot helper",
)

replace_once(
    '''    this.games = DataStore.getGames() || [];
    this.players = DataStore.getSeasonParticipantPlayers?.(DataStore.getActiveTeamId?.())
      || DataStore.getPlayers()
      || [];

    if (this.games.length === 0) {
      container.innerHTML = `''',
    '''    this.games = DataStore.getGames() || [];
    this.players = DataStore.getSeasonParticipantPlayers?.(DataStore.getActiveTeamId?.())
      || DataStore.getPlayers()
      || [];
    this.gameScopedSnapshot = null;
    this.isGameScopedOnly = false;

    if (targetGameId && !this.games.some(game => String(game.id) === String(targetGameId))) {
      try {
        await this._loadGameScopedSnapshot(targetGameId);
      } catch (error) {
        container.innerHTML = `
          <div style="padding:24px;color:#991b1b;background:white;border:1px solid #fecaca;border-radius:12px;text-align:center;">
            <strong>No se pudo abrir este BoxScore.</strong>
            <div style="margin-top:6px;font-size:13px;">${String(error?.message || error)}</div>
          </div>`;
        return;
      }
    }

    if (this.games.length === 0) {
      container.innerHTML = `''',
    "render snapshot fallback",
)

replace_once(
    '''  _renderGameBoxScoreDetail(container, containerId) {
    const currentGame = this.games.find(g => String(g.id) === String(this.selectedGameId)) || this.games[0];
    this.gameStats = DataStore.getPlayerGameStats(null, currentGame.id) || [];''',
    '''  _renderGameBoxScoreDetail(container, containerId) {
    const currentGame = this.games.find(g => String(g.id) === String(this.selectedGameId)) || this.games[0];
    this.gameStats = this.isGameScopedOnly
      ? (this.gameScopedSnapshot?.stats || [])
      : (DataStore.getPlayerGameStats(null, currentGame.id) || []);''',
    "detail stats",
)

replace_once(
    '''    const optionsMarkup = this.games.map(g => `''',
    '''    const backHref = this.isGameScopedOnly ? "#/dashboard" : "#/boxscore";
    const optionsMarkup = this.games.map(g => `''',
    "back href var",
)
replace_once(
    '''            <a href="#/boxscore" style="background: #f1f5f9;''',
    '''            <a href="${backHref}" style="background: #f1f5f9;''',
    "back href",
)

# A scoped delegate must not be offered a misleading game switcher.
replace_once(
    '''          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
            <span style="font-size: 18px;">🏆</span>
            <div style="flex: 1; max-width: 500px;">
              <label style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">${this.t("change_game", "CAMBIAR DE PARTIDO")}:</label>
              <select id="select-game-bs" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; background: white; min-height: 44px;">
                ${optionsMarkup}
              </select>
            </div>
          </div>''',
    '''          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
            <span style="font-size: 18px;">🏆</span>
            ${this.isGameScopedOnly ? `
              <div style="font-size:13px;font-weight:800;color:#334155;">
                Acceso delegado · ${currentGame.date || ''} vs ${currentGame.opponent || this.t("opponent", "Rival")}
              </div>
            ` : `
              <div style="flex: 1; max-width: 500px;">
                <label style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">${this.t("change_game", "CAMBIAR DE PARTIDO")}:</label>
                <select id="select-game-bs" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; background: white; min-height: 44px;">
                  ${optionsMarkup}
                </select>
              </div>
            `}
          </div>''',
    "scoped selector",
)

# Enforce the same starter bound in client UX as the backend.
replace_once(
    '''        const gameData = {
          ...currentGame,
          starter_ids: starterIds
        };

        await DataStore.saveGameAndStats(gameData, statsList);

        alert("✅ " + this.t("boxscore_saved_msg", "BoxScore guardado y métricas recalculadas exitosamente."));
        this.render(containerId, currentGame.id);''',
    '''        if (starterIds.length > 5) {
          alert("Solo puede haber un máximo de 5 titulares.");
          return;
        }

        const saveButton = container.querySelector("#btn-save-boxscore");
        if (saveButton) saveButton.disabled = true;
        try {
          const snapshot = await this.captureService.saveCapture({
            gameId: currentGame.id,
            starterIds,
            stats: statsList
          });

          if (this.isGameScopedOnly) {
            this.gameScopedSnapshot = snapshot || this.gameScopedSnapshot;
            this.games = [this.gameScopedSnapshot.game];
            this.players = this.gameScopedSnapshot.players || this.players;
            this.gameStats = this.gameScopedSnapshot.stats || statsList;
          } else {
            await DataStore.init(DataStore.getActiveTeamId?.(), true);
          }

          alert("✅ " + this.t("boxscore_saved_msg", "BoxScore guardado y métricas recalculadas exitosamente."));
          await this.render(containerId, currentGame.id);
        } catch (error) {
          alert(`❌ No se pudo guardar el BoxScore: ${error.message || error}`);
          if (saveButton) saveButton.disabled = false;
        }''',
    "scoped save",
)

PATH.write_text(text, encoding="utf-8", newline="\n")
print("V21 BoxScore patch OK")
