/**
 * @fileoverview Entidad del Dominio: PlayerGameStats (Estadísticas de Jugador por Partido).
 * @description Mapeo exacto de la tabla `player_game_stats` de Supabase / SQLite local.
 * Actúa como DTO de persistencia y snapshot consolidado de la actuación de un jugador en un partido.
 * 
 * NOTA DE ARQUITECTURA:
 * Esta entidad NO realiza cálculos analíticos por sí misma. Todos los valores (PTS, PIR, EFF,
 * eFG%, porcentajes de tiro, minutos reales y +/-) son calculados de forma pura por StatsEngine.js
 * a partir de la lista inmutable de eventos (GameEvents) y el registro de sustituciones.
 */

export class PlayerGameStats {
  /**
   * Crea una instancia de PlayerGameStats.
   * @param {Object} params - Métricas y relaciones del jugador en el partido.
   * @param {string|null} [params.id=null] - UUID del registro estadístico.
   * @param {string|null} [params.gameId=null] - ID del partido asociado.
   * @param {string|null} [params.playerId=null] - ID del jugador asociado.
   * @param {string|null} [params.teamId=null] - ID del equipo al que pertenece el jugador.
   * @param {string|null} [params.seasonId=null] - ID de la temporada.
   * @param {boolean} [params.starter=false] - Indica si formó parte del quinteto titular del Q1.
   * @param {number} [params.minutesSeconds=0] - Tiempo jugado en segundos exactos (ej. 1204 s = 20:04 min).
   * @param {number} [params.minutes=0] - Tiempo jugado en minutos decimales (ej. 20.07 min).
   * @param {number} [params.points=0] - Total de puntos anotados (PTS).
   * @param {number} [params.fg2Made=0] - Canastas de 2 anotadas (2PM).
   * @param {number} [params.fg2Attempted=0] - Tiros de 2 intentados (2PA).
   * @param {number} [params.fg3Made=0] - Triples anotados (3PM).
   * @param {number} [params.fg3Attempted=0] - Triples intentados (3PA).
   * @param {number} [params.ftMade=0] - Tiros libres anotados (FTM).
   * @param {number} [params.ftAttempted=0] - Tiros libres intentados (FTA).
   * @param {number} [params.offReb=0] - Rebotes ofensivos (ORB).
   * @param {number} [params.defReb=0] - Rebotes defensivos (DRB).
   * @param {number} [params.assists=0] - Asistencias directas (AST).
   * @param {number} [params.steals=0] - Recuperaciones / robos de balón (STL).
   * @param {number} [params.blocksMade=0] - Tapones realizados a favor (BLK).
   * @param {number} [params.blocksReceived=0] - Tapones recibidos (BA / SR).
   * @param {number} [params.turnovers=0] - Pérdidas de balón (TOV).
   * @param {number} [params.foulsCommitted=0] - Faltas personales cometidas (PF).
   * @param {number} [params.foulsDrawn=0] - Faltas recibidas (FD / PFD).
   * @param {number} [params.plusMinus=0] - Balance de puntos con el jugador en pista (+/-).
   * @param {number} [params.pir=0] - Valoración oficial FIBA/ACB (Performance Index Rating).
   * @param {number} [params.efficiency=0] - Eficiencia estándar NBA (EFF).
   * @param {number} [params.gameScore=0] - Puntuación de impacto Game Score (Hollinger).
   * @param {Object} [params.shotDetails={}] - Desglose de tipos de tiro (bandejas, mates, pull up, etc.).
   * @param {Object} [params.turnoverDetails={}] - Desglose de pérdidas (mal pase, pasos, 3s, etc.).
   * @param {Object} [params.foulDetails={}] - Desglose de faltas (defensivas, ofensivas, técnicas, etc.).
   * @param {string|null} [params.createdAt=null] - Timestamp ISO de creación.
   * @param {string|null} [params.updatedAt=null] - Timestamp ISO de actualización.
   */
  constructor({
    id = null,
    gameId = null,
    playerId = null,
    teamId = null,
    seasonId = null,
    starter = false,
    minutesSeconds = 0,
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
    pir = 0,
    efficiency = 0,
    gameScore = 0,
    shotDetails = {},
    turnoverDetails = {},
    foulDetails = {},
    createdAt = null,
    updatedAt = null
  } = {}) {
    // Identificadores y contexto
    this.id = id;
    this.gameId = gameId;
    this.playerId = playerId;
    this.teamId = teamId;
    this.seasonId = seasonId;
    this.starter = Boolean(starter);

    // Minutos reales en pista
    this.minutesSeconds = Number(minutesSeconds) || 0;
    this.minutes = Number(minutes) || (this.minutesSeconds > 0 ? Number((this.minutesSeconds / 60).toFixed(2)) : 0);

    // Producción básica
    this.points = Number(points) || 0;
    this.fg2Made = Number(fg2Made) || 0;
    this.fg2Attempted = Number(fg2Attempted) || 0;
    this.fg3Made = Number(fg3Made) || 0;
    this.fg3Attempted = Number(fg3Attempted) || 0;
    this.ftMade = Number(ftMade) || 0;
    this.ftAttempted = Number(ftAttempted) || 0;
    this.offReb = Number(offReb) || 0;
    this.defReb = Number(defReb) || 0;
    this.assists = Number(assists) || 0;
    this.steals = Number(steals) || 0;
    this.blocksMade = Number(blocksMade) || 0;
    this.blocksReceived = Number(blocksReceived) || 0;
    this.turnovers = Number(turnovers) || 0;
    this.foulsCommitted = Number(foulsCommitted) || 0;
    this.foulsDrawn = Number(foulsDrawn) || 0;

    // Métricas de impacto consolidado
    this.plusMinus = Number(plusMinus) || 0;
    this.pir = Number(pir) || 0;
    this.efficiency = Number(efficiency) || 0;
    this.gameScore = Number(gameScore) || 0;

    // Desgloses cualitativos seguros
    this.shotDetails = this._parseObjectSafe(shotDetails);
    this.turnoverDetails = this._parseObjectSafe(turnoverDetails);
    this.foulDetails = this._parseObjectSafe(foulDetails);

    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  /**
   * Helper privado para parsear objetos JSON de forma segura.
   * @private
   * @param {Object|string|null} input - Objeto o string JSON.
   * @returns {Object} Objeto plano resultante.
   */
  _parseObjectSafe(input) {
    if (typeof input === "string") {
      try {
        const parsed = JSON.parse(input);
        return typeof parsed === "object" && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }
    return typeof input === "object" && input !== null ? input : {};
  }

  /**
   * Formatea los segundos de juego a formato de visualización estándar de acta (MM:SS).
   * @returns {string} Ejemplo: "26:24" o "00:00".
   */
  get formattedMinutes() {
    const totalSec = Math.round(this.minutesSeconds);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  /**
   * Rebotes totales calculados como suma de ofensivos y defensivos.
   * @returns {number} TRB (Total Rebounds).
   */
  get totalRebounds() {
    return this.offReb + this.defReb;
  }

  /**
   * Tiros de campo totales anotados (FGM = 2PM + 3PM).
   * @returns {number} FGM.
   */
  get fgMade() {
    return this.fg2Made + this.fg3Made;
  }

  /**
   * Tiros de campo totales intentados (FGA = 2PA + 3PA).
   * @returns {number} FGA.
   */
  get fgAttempted() {
    return this.fg2Attempted + this.fg3Attempted;
  }

  /**
   * Serializa la entidad a snake_case para persistencia exacta en Supabase y SQLite.
   * @returns {Object} Objeto plano serializable.
   */
  toJSON() {
    return {
      id: this.id,
      game_id: this.gameId,
      player_id: this.playerId,
      team_id: this.teamId,
      season_id: this.seasonId,
      starter: this.starter,
      minutes_seconds: this.minutesSeconds,
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
      pir: this.pir,
      evaluation: this.pir, // Compatibilidad con esquemas heredados
      efficiency: this.efficiency,
      game_score: this.gameScore,
      shot_details: JSON.stringify(this.shotDetails),
      turnover_details: JSON.stringify(this.turnoverDetails),
      foul_details: JSON.stringify(this.foulDetails),
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * Reconstruye una instancia de PlayerGameStats desde una fila de base de datos o JSON.
   * @param {Object} row - Fila en snake_case o camelCase.
   * @returns {PlayerGameStats} Nueva instancia de PlayerGameStats.
   */
  static fromJSON(row = {}) {
    return new PlayerGameStats({
      id: row.id,
      gameId: row.game_id ?? row.gameId,
      playerId: row.player_id ?? row.playerId,
      teamId: row.team_id ?? row.teamId,
      seasonId: row.season_id ?? row.seasonId,
      starter: row.starter,
      minutesSeconds: row.minutes_seconds ?? row.minutesSeconds ?? (row.minutes ? Number(row.minutes) * 60 : 0),
      minutes: row.minutes,
      points: row.points,
      fg2Made: row.fg2_made ?? row.fg2Made,
      fg2Attempted: row.fg2_attempted ?? row.fg2Attempted,
      fg3Made: row.fg3_made ?? row.fg3Made,
      fg3Attempted: row.fg3_attempted ?? row.fg3Attempted,
      ftMade: row.ft_made ?? row.ftMade,
      ftAttempted: row.ft_attempted ?? row.ftAttempted,
      offReb: row.off_reb ?? row.offReb,
      defReb: row.def_reb ?? row.defReb,
      assists: row.assists,
      steals: row.steals,
      blocksMade: row.blocks_made ?? row.blocksMade,
      blocksReceived: row.blocks_received ?? row.blocksReceived,
      turnovers: row.turnovers,
      foulsCommitted: row.fouls_committed ?? row.foulsCommitted,
      foulsDrawn: row.fouls_drawn ?? row.foulsDrawn,
      plusMinus: row.plus_minus ?? row.plusMinus,
      pir: row.pir ?? row.evaluation ?? 0,
      efficiency: row.efficiency,
      gameScore: row.game_score ?? row.gameScore,
      shotDetails: row.shot_details ?? row.shotDetails,
      turnoverDetails: row.turnover_details ?? row.turnoverDetails,
      foulDetails: row.foul_details ?? row.foulDetails,
      createdAt: row.created_at ?? row.createdAt,
      updatedAt: row.updated_at ?? row.updatedAt
    });
  }
}