from pathlib import Path


def replace_one(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_one(
    "services/ApprovalCenterService.js",
    '''    if (item.type === RequestType.TEAM_SEASON_FREEZE) {
      return this.seasonFreezeService.resolveRequest(item.id, "REJECTED", note || null);
    }

    throw new Error("Tipo de solicitud no soportado.");''',
    '''    if (item.type === RequestType.PLAYER_DATA_SUBMISSION) {
      const rejectionNote = String(note || "").trim();
      if (!rejectionNote) {
        throw new Error("Indica el motivo del rechazo.");
      }
      return this.playerSubmissionService.review({
        submissionId: item.id,
        decision: "REJECTED",
        note: rejectionNote
      });
    }

    if (item.type === RequestType.TEAM_SEASON_FREEZE) {
      return this.seasonFreezeService.resolveRequest(item.id, "REJECTED", note || null);
    }

    throw new Error("Tipo de solicitud no soportado.");'''
)

replace_one(
    "views/ApprovalCenterView.js",
    '''      : item.type === RequestType.PLAYER_DATA_SUBMISSION
        ? `#/player/${item.playerId || ""}`
        : `#/settings`;''',
    '''      : item.type === RequestType.PLAYER_DATA_SUBMISSION
        ? `#/player360/${item.playerId || ""}`
        : `#/settings`;'''
)

replace_one(
    "views/GameBoxScoreView.js",
    '''        try {
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
          await this.render(containerId, currentGame.id);''',
    '''        try {
          if (this.isGameScopedOnly) {
            const snapshot = await this.captureService.saveCapture({
              gameId: currentGame.id,
              starterIds,
              stats: statsList
            });
            this.gameScopedSnapshot = snapshot || this.gameScopedSnapshot;
            this.games = [this.gameScopedSnapshot.game];
            this.players = this.gameScopedSnapshot.players || this.players;
            this.gameStats = this.gameScopedSnapshot.stats || statsList;
          } else {
            // Preserve the established team-scoped save path for normal staff.
            // The V21 RPC is reserved for users whose only authorization is the
            // explicit per-game delegation, avoiding a regression in existing
            // trainer/admin workflows and keeping DataStore as their boundary.
            const gameData = {
              ...currentGame,
              starter_ids: starterIds
            };
            await DataStore.saveGameAndStats(gameData, statsList);
          }

          alert("✅ " + this.t("boxscore_saved_msg", "BoxScore guardado y métricas recalculadas exitosamente."));
          await this.render(containerId, currentGame.id);'''
)

print("V21_TESTER_REGRESSION_PATCH_OK")
