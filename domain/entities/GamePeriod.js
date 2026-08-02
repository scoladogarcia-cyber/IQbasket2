/**
 * @fileoverview Entidad del Dominio: Parcial de Periodo / Prórroga.
 * @description Modela cada cuarto o prórroga de un partido de forma relacional.
 */

export class GamePeriod {
  constructor({
    period = 1,
    teamScore = 0,
    opponentScore = 0
  } = {}) {
    this.period = Number(period);
    this.teamScore = Number(teamScore);
    this.opponentScore = Number(opponentScore);
  }

  get isOvertime() {
    return this.period > 4;
  }

  get overtimeNumber() {
    return this.isOvertime ? this.period - 4 : 0;
  }

  toJSON() {
    return {
      period: this.period,
      team_score: this.teamScore,
      opponent_score: this.opponentScore
    };
  }
}