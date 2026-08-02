/**
 * @fileoverview Entidad del Dominio: Partido.
 * @description Mapeo de la tabla `games` con soporte para prórrogas ilimitadas relacionales.
 */

import { GamePeriod } from "./GamePeriod.js";

export class Game {
  constructor({
    id = null,
    teamId = null,
    seasonId = null,
    date = null,
    time = "",
    opponent = "",
    competition = "",
    round = "",
    venue = "Local",
    venueName = "",
    periodsCount = 4,
    periodMinutes = 10,
    status = "Programado",
    teamScore = 0,
    opponentScore = 0,
    periods = [],
    starterIds = [],
    observations = "",
    videoUrl = null,
    notes = "",
    createdAt = null,
    updatedAt = null
  } = {}) {
    this.id = id;
    this.teamId = teamId;
    this.seasonId = seasonId;
    this.date = date;
    this.time = time;
    this.opponent = opponent;
    this.competition = competition;
    this.round = round;
    this.venue = venue;
    this.venueName = venueName;
    this.periodsCount = Number(periodsCount);
    this.periodMinutes = Number(periodMinutes);
    this.status = status;
    this.teamScore = Number(teamScore);
    this.opponentScore = Number(opponentScore);

    let rawPeriods = periods;
    if (typeof periods === "string") {
      try {
        rawPeriods = JSON.parse(periods);
      } catch (e) {
        rawPeriods = [];
      }
    }
    this.periods = Array.isArray(rawPeriods) ? rawPeriods.map((p) => new GamePeriod(p)) : [];

    if (typeof starterIds === "string") {
      try {
        this.starterIds = JSON.parse(starterIds);
      } catch (e) {
        this.starterIds = [];
      }
    } else {
      this.starterIds = Array.isArray(starterIds) ? starterIds : [];
    }

    this.observations = observations;
    this.videoUrl = videoUrl;
    this.notes = notes;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  addPeriodScore(teamPts, oppPts) {
    const nextPeriodNum = this.periods.length + 1;
    const newPeriod = new GamePeriod({
      period: nextPeriodNum,
      teamScore: teamPts,
      opponentScore: oppPts
    });
    this.periods.push(newPeriod);
    this.periodsCount = this.periods.length;
    
    this.teamScore = this.periods.reduce((acc, p) => acc + p.teamScore, 0);
    this.opponentScore = this.periods.reduce((acc, p) => acc + p.opponentScore, 0);
  }

  toJSON() {
    return {
      id: this.id,
      team_id: this.teamId,
      season_id: this.seasonId,
      date: this.date,
      time: this.time,
      opponent: this.opponent,
      competition: this.competition,
      round: this.round,
      venue: this.venue,
      venue_name: this.venueName,
      periods_count: this.periodsCount,
      period_minutes: this.periodMinutes,
      status: this.status,
      team_score: this.teamScore,
      opponent_score: this.opponentScore,
      periods: JSON.stringify(this.periods.map((p) => p.toJSON())),
      starter_ids: JSON.stringify(this.starterIds),
      observations: this.observations,
      video_url: this.videoUrl,
      notes: this.notes,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }
}