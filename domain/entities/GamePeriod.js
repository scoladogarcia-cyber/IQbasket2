/**
 * @fileoverview Entidad del Dominio: GamePeriod (Periodo de Partido).
 * @description Modela cada cuarto reglamentario o prórroga ilimitada de un partido.
 * Almacena los metadatos del periodo, duración reglamentaria, quinteto inicial confirmado
 * para arrancar el cuarto y snapshots de marcador parcial derivados del motor de eventos (StatsEngine).
 * 
 * Soporta:
 * - Periodos reglamentarios flexibles (Q1-Q4 o partes).
 * - Prórrogas ilimitadas (OT1, OT2, OT3...).
 * - Claves de traducción i18n para nombres de periodos.
 * - Validación y trazabilidad del quinteto inicial del periodo.
 */

/**
 * Tipos de periodo reglamentario.
 * @readonly
 * @enum {string}
 */
export const PeriodType = {
  REGULAR: "REGULAR",   // Cuarto reglamentario
  OVERTIME: "OVERTIME"  // Prórroga / Tiempo extra
};

export class GamePeriod {
  /**
   * Crea una instancia de GamePeriod.
   * @param {Object} params - Parámetros de inicialización.
   * @param {number} [params.period=1] - Número secuencial del periodo (1, 2, 3, 4, 5=OT1, etc.).
   * @param {string|null} [params.code=null] - Código del periodo ('Q1', 'Q2', 'Q3', 'Q4', 'OT1', 'OT2'...).
   * @param {number} [params.teamScore=0] - Puntos parciales anotados por el equipo propio en este periodo.
   * @param {number} [params.opponentScore=0] - Puntos parciales anotados por el rival en este periodo.
   * @param {number} [params.durationMinutes=10] - Duración reglamentaria del periodo en minutos.
   * @param {Array<string>} [params.starterIds=[]] - IDs de los 5 jugadores que arrancan en pista este periodo.
   * @param {boolean} [params.isFinished=false] - Indica si el periodo ha concluido.
   * @param {string|null} [params.periodType=null] - Tipo: 'REGULAR' | 'OVERTIME'.
   */
  constructor({
    period = 1,
    code = null,
    teamScore = 0,
    opponentScore = 0,
    durationMinutes = 10,
    starterIds = [],
    isFinished = false,
    periodType = null
  } = {}) {
    this.period = Number(period) || 1;
    this.teamScore = Number(teamScore) || 0;
    this.opponentScore = Number(opponentScore) || 0;
    this.durationMinutes = Number(durationMinutes) || (this.isOvertime ? 5 : 10);
    this.isFinished = Boolean(isFinished);

    // Tipo de periodo explícito o derivado del número de cuarto
    this.periodType = periodType || (this.period > 4 ? PeriodType.OVERTIME : PeriodType.REGULAR);

    // Código identificativo estándar (Q1..Q4, OT1..OTn)
    if (code) {
      this.code = code;
    } else {
      this.code = this.isOvertime ? `OT${this.period - 4}` : `Q${this.period}`;
    }

    // Parseo seguro de quinteto que inicia el periodo
    if (typeof starterIds === "string") {
      try {
        const parsed = JSON.parse(starterIds);
        this.starterIds = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.starterIds = [];
      }
    } else {
      this.starterIds = Array.isArray(starterIds) ? starterIds : [];
    }
  }

  /**
   * Determina si el periodo actual corresponde a una prórroga.
   * @returns {boolean} True si es prórroga (periodo > 4 o tipo OVERTIME).
   */
  get isOvertime() {
    return this.period > 4 || this.periodType === PeriodType.OVERTIME;
  }

  /**
   * Retorna el número secuencial de la prórroga (1 para OT1, 2 para OT2, etc.).
   * @returns {number} Número de prórroga o 0 si es reglamentario.
   */
  get overtimeNumber() {
    return this.isOvertime ? Math.max(1, this.period - 4) : 0;
  }

  /**
   * Retorna la clave de internacionalización (i18n) para la etiqueta del periodo.
   * Permite renderizar "1º Cuarto", "1st Quarter", "1r Quart" o "1ª Prórroga" sin hardcode.
   * @returns {string} Clave i18n para resolver en I18nService.
   */
  get i18nKey() {
    if (this.isOvertime) {
      return "periods.overtime";
    }
    return `periods.quarter_${this.period}`;
  }

  /**
   * Retorna el total de segundos reglamentarios de este periodo.
   * Denominador base para el cálculo de minutos y posesiones normalizadas.
   * @returns {number} Duración en segundos (ej. 600 s para 10 min, 300 s para 5 min).
   */
  get totalSeconds() {
    return this.durationMinutes * 60;
  }

  /**
   * Valida si el periodo tiene exactamente 5 jugadores confirmados para arrancar.
   * @returns {boolean} True si el quinteto inicial es válido (5 jugadores).
   */
  hasValidStarters() {
    return Array.isArray(this.starterIds) && this.starterIds.length === 5;
  }

  /**
   * Asigna el quinteto confirmado que inicia este periodo.
   * @param {Array<string>} playerIds - Array de 5 IDs de jugadores convocados.
   */
  setStarters(playerIds) {
    if (Array.isArray(playerIds)) {
      this.starterIds = [...playerIds];
    }
  }

  /**
   * Convierte la entidad a un objeto plano preparado para serialización y persistencia.
   * @returns {Object} Representación serializable en snake_case.
   */
  toJSON() {
    return {
      period: this.period,
      code: this.code,
      team_score: this.teamScore,
      opponent_score: this.opponentScore,
      duration_minutes: this.durationMinutes,
      starter_ids: JSON.stringify(this.starterIds),
      is_finished: this.isFinished,
      period_type: this.periodType
    };
  }

  /**
   * Reconstruye una instancia de GamePeriod a partir de un objeto JSON o fila de BD.
   * @param {Object} data - Datos en camelCase o snake_case.
   * @returns {GamePeriod} Nueva instancia de GamePeriod.
   */
  static fromJSON(data = {}) {
    return new GamePeriod({
      period: data.period,
      code: data.code,
      teamScore: data.team_score ?? data.teamScore,
      opponentScore: data.opponent_score ?? data.opponentScore,
      durationMinutes: data.duration_minutes ?? data.durationMinutes,
      starterIds: data.starter_ids ?? data.starterIds,
      isFinished: data.is_finished ?? data.isFinished,
      periodType: data.period_type ?? data.periodType
    });
  }
}