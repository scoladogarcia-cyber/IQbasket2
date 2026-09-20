/**
 * @fileoverview Coordenadas canónicas de tiros por equipo y partido.
 * @description Los tiros libres rivales no tienen localización de campo;
 * nunca se inventan intentos fallados ni se convierten en mapas de eficiencia.
 */
import { resolveShotMade } from "./ShotOutcomeResolver.js";

const coordinate = (row, key, alias) => {
  const raw = row?.[key] ?? row?.[alias] ?? row?.coordinates?.[key === "coord_x" ? "x" : "y"];
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
};

/** @returns {{our: object, opponent: object}} Solo el encuentro seleccionado. */
export function buildGameShotMaps(events = [], gameId = null) {
  const our = [], opponent = [];
  let ownShots = 0, opponentScores = 0, opponentFreeThrows = 0;
  let opponentPoints = 0;
  for (const event of Array.isArray(events) ? events : []) {
    if (gameId && String(event.game_id ?? event.gameId) !== String(gameId)) continue;
    const action = String(event.action_type ?? event.action ?? event.event_type ?? "").toLowerCase();
    const isOpponent = action.startsWith("opp_") || event.is_opponent === true || event.isOpponent === true;
    const ownShot = /^(fg[23]_(made|attempted)|t[23]_(made|attempted))$/.test(action)
      || (!isOpponent && /(?:shot|tiro|triple)/.test(action));
    const opponentScore = isOpponent && (/^opp_pts$/.test(action) || /opp_.*(?:made|scored|canasta)/.test(action));
    if (!ownShot && !opponentScore) continue;
    const x = coordinate(event, "coord_x", "coordX");
    const y = coordinate(event, "coord_y", "coordY");
    const points = Number(event.points ?? 0);
    if (isOpponent) {
      if (points === 1) { opponentFreeThrows += 1; continue; }
      if (points !== 2 && points !== 3) continue;
      opponentScores += 1;
      opponentPoints += points;
      if (x !== null && y !== null) opponent.push({ x, y, made: true, points });
    } else {
      ownShots += 1;
      if (x !== null && y !== null) our.push({ x, y, made: resolveShotMade(event), points });
    }
  }
  return {
    our: { shots: our, observed: ownShots, located: our.length, made: our.filter(shot => shot.made).length,
      coverage: ownShots ? `${our.length}/${ownShots} tiros localizados` : "No hay tiros registrados",
      completeOutcomes: ownShots > 0 && ownShots === our.length },
    opponent: { shots: opponent, observed: opponentScores, located: opponent.length, made: opponent.length,
      freeThrows: opponentFreeThrows, points: opponentPoints,
      locatedPoints: opponent.reduce((sum, shot) => sum + shot.points, 0),
      coverage: opponentScores ? `${opponent.length} canastas de campo localizadas de ${opponentScores} registradas; ${opponentFreeThrows} TL sin posición` : `${opponentFreeThrows} TL; no hay canastas de campo registradas`,
      completeOutcomes: false,
      note: "Azul = 2 puntos; ámbar = 3 puntos. Se muestran únicamente canastas de campo con coordenadas. Sin fallos rivales no hay porcentajes por zonas." }
  };
}
