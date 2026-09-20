/**
 * @fileoverview Presentación local/visitante de un marcador sin modificar el modelo.
 * @description teamScore siempre corresponde al equipo gestionado y
 * opponentScore siempre al rival. venue solo determina el lado visual.
 */

/**
 * @param {string} venue Condición del equipo gestionado.
 * @param {number} teamScore Puntos del equipo gestionado (modelo canónico).
 * @param {number} opponentScore Puntos del rival (modelo canónico).
 * @returns {{isAway:boolean, homeScore:number, awayScore:number}}
 */
export function orientGameScore(venue, teamScore, opponentScore) {
  const isAway = /^(visitante|visitant|away)$/i.test(String(venue ?? "").trim());
  return {
    isAway,
    homeScore: isAway ? teamScoreNumber(opponentScore) : teamScoreNumber(teamScore),
    awayScore: isAway ? teamScoreNumber(teamScore) : teamScoreNumber(opponentScore)
  };
}

function teamScoreNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
