from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "views/GameLiveEditorView.js"
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
    'import { GameCaptureDelegationPanel } from "../components/games/GameCaptureDelegationPanel.js";\n',
    "import",
)

replace_once(
    '''    this.pendingLockRequests = [];
    this.gameLockService = new GameLockService(this.supabase, this.auth);
  }''',
    '''    this.pendingLockRequests = [];
    this.gameLockService = new GameLockService(this.supabase, this.auth);
    this.gameCaptureDelegationPanel = new GameCaptureDelegationPanel(this.supabase, this.auth);
  }''',
    "constructor",
)

replace_once(
    '''      teamId: game?.team_id || game?.teamId || this.teamId || DataStore.getActiveTeamId(),
      seasonId: game?.season_id || game?.seasonId || null,
      teamSeasonId: game?.team_season_id || game?.teamSeasonId || DataStore.getActiveTeamSeasonId?.()
    };''',
    '''      teamId: game?.team_id || game?.teamId || this.teamId || DataStore.getActiveTeamId(),
      seasonId: game?.season_id || game?.seasonId || null,
      teamSeasonId: game?.team_season_id || game?.teamSeasonId || DataStore.getActiveTeamSeasonId?.(),
      gameId: game?.id || null
    };''',
    "game context",
)

replace_once(
    '''      const canDelete = this._canDeleteGame(game);

      const lifecycleBadge = locked''',
    '''      const canDelete = this._canDeleteGame(game);
      const canCaptureGame = !seasonFrozen && !locked
        && Boolean(this.auth?.canPreview?.(Permission.RECORD_LIVE_GAME, this._gameContext(game)));
      const delegationAction = this.gameCaptureDelegationPanel.buttonMarkup(game, {
        disabled: seasonFrozen || locked
      });

      const lifecycleBadge = locked''',
    "card permissions",
)

replace_once(
    '''            <button onclick="window.location.hash='#/boxscore/${game.id}'" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;">📋 Boxscore</button>
            <button onclick="window.location.hash='#/reports'" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;">📊 Informe</button>
            ${lifecycleAction}''',
    '''            <button type="button" class="btn-live-existing-game" data-id="${game.id}" ${canCaptureGame ? "" : "disabled"} style="background:${canCaptureGame ? "#0f766e" : "#f1f5f9"};color:${canCaptureGame ? "#ffffff" : "#94a3b8"};border:1px solid ${canCaptureGame ? "#0f766e" : "#cbd5e1"};padding:8px 14px;border-radius:8px;font-size:12px;font-weight:800;cursor:${canCaptureGame ? "pointer" : "not-allowed"};min-height:44px;">⚡ Captura</button>
            <button onclick="window.location.hash='#/boxscore/${game.id}'" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;">📋 Boxscore</button>
            <button onclick="window.location.hash='#/reports'" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;min-height:44px;">📊 Informe</button>
            ${delegationAction}
            ${lifecycleAction}''',
    "card actions",
)

replace_once(
    '''    this._bindGameLockEvents(container, teamId);

    container.querySelector("#btn-create-game-hud")?.addEventListener("click", () => {''',
    '''    this._bindGameLockEvents(container, teamId);
    this.gameCaptureDelegationPanel.bind(container, this.games);

    container.querySelectorAll(".btn-live-existing-game").forEach(button => {
      button.addEventListener("click", event => {
        const gameId = event.currentTarget.dataset.id;
        const game = this.games.find(item => String(item.id) === String(gameId));
        if (!game || this._isGameLocked(game) || this._isTeamSeasonFrozen(teamId)) return;
        if (!this.auth?.canPreview?.(Permission.RECORD_LIVE_GAME, this._gameContext(game))) return;
        window.location.hash = `#/live/${gameId}`;
      });
    });

    container.querySelector("#btn-create-game-hud")?.addEventListener("click", () => {''',
    "bind panel",
)

PATH.write_text(text, encoding="utf-8", newline="\n")
print("V21 game manager patch OK")
