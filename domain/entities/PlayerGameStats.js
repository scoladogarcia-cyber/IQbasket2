/**
 * @fileoverview Entidad del Dominio: Estadísticas de Jugador por Partido.
 * @description Mapeo exacto con la tabla `player_game_stats` de Supabase.
 */

export class PlayerGameStats {
  constructor({
    id = null,
    gameId = null,
    playerId = null,
    starter = false,
    minutes = 0,
    points = 0,
    fg2Made = 0,
    fg2Attempted = 0,
    fg3Made = 0,
    fg3Attempted = 0,
    ftMade = 0,
    ftAttempted = 0,
    offReb = 0,
    defReb = 0,
    assists = 0,
    steals = 0,
    blocksMade = 0,
    blocksReceived = 0,
    turnovers = 0,
    foulsCommitted = 0,
    foulsDrawn = 0,
    plusMinus = 0,
    evaluation = 0
  } = {}) {
    this.id = id;
    this.gameId = gameId;
    this.playerId = playerId;
    this.starter = Boolean(starter);
    this.minutes = Number(minutes);
    this.points = Number(points);
    this.fg2Made = Number(fg2Made);
    this.fg2Attempted = Number(fg2Attempted);
    this.fg3Made = Number(fg3Made);
    this.fg3Attempted = Number(fg3Attempted);
    this.ftMade = Number(ftMade);
    this.ftAttempted = Number(ftAttempted);
    this.offReb = Number(offReb);
    this.defReb = Number(defReb);
    this.assists = Number(assists);
    this.steals = Number(steals);
    this.blocksMade = Number(blocksMade);
    this.blocksReceived = Number(blocksReceived);
    this.turnovers = Number(turnovers);
    this.foulsCommitted = Number(foulsCommitted);
    this.foulsDrawn = Number(foulsDrawn);
    this.plusMinus = Number(plusMinus);
    this.evaluation = Number(evaluation);
  }

  get totalRebounds() {
    return this.offReb + this.defReb;
  }

  toJSON() {
    return {
      id: this.id,
      game_id: this.gameId,
      player_id: this.playerId,
      starter: this.starter,
      minutes: this.minutes,
      points: this.points,
      fg2_made: this.fg2Made,
      fg2_attempted: this.fg2Attempted,
      fg3_made: this.fg3Made,
      fg3_attempted: this.fg3Attempted,
      ft_made: this.ftMade,
      ft_attempted: this.ftAttempted,
      off_reb: this.offReb,
      def_reb: this.defReb,
      assists: this.assists,
      steals: this.steals,
      blocks_made: this.blocksMade,
      blocks_received: this.blocksReceived,
      turnovers: this.turnovers,
      fouls_committed: this.foulsCommitted,
      fouls_drawn: this.foulsDrawn,
      plus_minus: this.plusMinus,
      evaluation: this.evaluation
    };
  }
}