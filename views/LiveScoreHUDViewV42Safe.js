/**
 * @fileoverview Score-safe adapter for the recovered V42 live scorer.
 * @description Preserves authoritative historical game scores when an older
 * game has missing or partial play-by-play, while allowing live PBP edits and
 * annulments to recalculate deterministically from the preserved baseline.
 * Venue only affects presentation: canonical team/opponent scores never swap.
 */

import { LiveScoreHUDViewV42 } from "./LiveScoreHUDViewV42.js";
import { orientGameScore } from "../domain/games/GameScoreOrientation.js";

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

  /**
   * V38 already places the home/away names correctly, but always paints
   * teamScore on the left. Correct only those two DOM values after its render;
   * never swap game state, events, periods, stats or synchronization payloads.
   * V44 invokes this through super._renderHUD() on every live action/resume.
   */
  _renderHUD() {
    super._renderHUD();
    const scorebar = this.container?.querySelector?.(".v38-scorebar");
    if (!scorebar) return;
    const homeValue = scorebar.querySelector(".v38-team-home strong");
    const awayValue = scorebar.querySelector(".v38-team-away strong");
    if (!homeValue || !awayValue) return;
    const display = orientGameScore(this.config?.venue, this.teamScore, this.opponentScore);
    homeValue.textContent = String(display.homeScore);
    awayValue.textContent = String(display.awayScore);
  }

  /**
   * The final acta's original `teamScore-opponentScore vs Rival` is own-team
   * first, unlike the live home-away scoreboard. Name both sides explicitly
   * without modifying the authoritative totals or the save handler.
   */
  _renderPostGameActa() {
    super._renderPostGameActa();
    const title = this.container?.querySelector?.("h1");
    if (!title?.textContent?.includes("Acta Oficial")) return;
    const result = title.parentElement?.querySelector?.("span");
    if (!result?.textContent?.includes("Resultado Final:")) return;
    const display = orientGameScore(this.config?.venue, this.teamScore, this.opponentScore);
    const opponent = String(this.config?.opponent || "Rival");
    const home = display.isAway ? opponent : "Mi equipo";
    const away = display.isAway ? "Mi equipo" : opponent;
    result.textContent = `Resultado final (local – visitante): ${home} ${display.homeScore} – ${display.awayScore} ${away}`;
  }
}

export default LiveScoreHUDViewV42Safe;