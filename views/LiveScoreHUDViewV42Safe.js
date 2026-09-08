/**
 * @fileoverview Score-safe adapter for the recovered V42 live scorer.
 * @description Preserves authoritative historical game scores when an older
 * game has missing or partial play-by-play, while allowing live PBP edits and
 * annulments to recalculate deterministically from the preserved baseline.
 */

import { LiveScoreHUDViewV42 } from "./LiveScoreHUDViewV42.js";

function scoreFromEvents(events = [], opponent = false) {
  return (events || []).reduce((sum, event) => {
    if (Boolean(event?.isOpponent) !== Boolean(opponent)) return sum;
    return sum + Number(event?.points || 0);
  }, 0);
}

export class LiveScoreHUDViewV42Safe extends LiveScoreHUDViewV42 {
  constructor(authController = null, gameId = null) {
    super(authController, gameId);
    this.scoreBaselineTeam = 0;
    this.scoreBaselineOpponent = 0;
    this.scoreBaselineInitialized = false;
  }

  async _loadExistingGameSnapshot() {
    await super._loadExistingGameSnapshot();
    if (this.scoreBaselineInitialized) return;

    const storedTeam = Math.max(0, Number(this.gameSnapshot?.game?.team_score || 0));
    const storedOpponent = Math.max(0, Number(this.gameSnapshot?.game?.opponent_score || 0));
    const pbpTeam = scoreFromEvents(this.playByPlayEvents, false);
    const pbpOpponent = scoreFromEvents(this.playByPlayEvents, true);

    // If historical PBP is incomplete, preserve the unexplained points as a
    // baseline. Fully captured games naturally resolve to a zero baseline.
    this.scoreBaselineTeam = Math.max(0, storedTeam - pbpTeam);
    this.scoreBaselineOpponent = Math.max(0, storedOpponent - pbpOpponent);
    this.scoreBaselineInitialized = true;
    this._normalizeRunningScores();
  }

  _normalizeRunningScores() {
    let team = Number(this.scoreBaselineTeam || 0);
    let opponent = Number(this.scoreBaselineOpponent || 0);

    this.playByPlayEvents.forEach(event => {
      const points = Number(event?.points || 0);
      if (event?.isOpponent) opponent += points;
      else team += points;
      event.teamScore = team;
      event.opponentScore = opponent;
    });

    this.teamScore = team;
    this.opponentScore = opponent;
  }
}

export default LiveScoreHUDViewV42Safe;
