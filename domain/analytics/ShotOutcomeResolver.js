/**
 * @fileoverview Normalización canónica del resultado de un tiro.
 * @description Resuelve si un evento de tiro fue anotado o fallado sin depender
 * del origen del evento (Live HUD, registro rápido, fixtures demo o legacy).
 *
 * Prioridad de fuentes:
 * 1. Resultado explícito (`made`, `is_made`, `isMade`, `coordinates.made`).
 * 2. Puntos positivos.
 * 3. Semántica textual del tipo de acción/evento.
 *
 * El resultado explícito es autoritativo incluso si otros campos son
 * inconsistentes, evitando reinterpretaciones destructivas de datos históricos.
 */

const TRUE_VALUES = new Set(["true", "1", "yes", "y", "made", "in", "anotado", "anotada"]);
const FALSE_VALUES = new Set(["false", "0", "no", "n", "missed", "out", "fallado", "fallada"]);

/**
 * Convierte un valor boolean-like a booleano real.
 * @param {unknown} value
 * @returns {boolean|null} null cuando el valor no es interpretable.
 */
export function parseBooleanLike(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

/**
 * Determina si un tiro fue anotado.
 * @param {Record<string, any>} event
 * @returns {boolean}
 */
export function resolveShotMade(event = {}) {
  const explicitCandidates = [
    event.made,
    event.is_made,
    event.isMade,
    event.coordinates?.made
  ];

  for (const candidate of explicitCandidates) {
    const parsed = parseBooleanLike(candidate);
    if (parsed !== null) return parsed;
  }

  if (Number(event.points ?? 0) > 0) return true;

  const action = String(
    event.action_type ?? event.action ?? event.event_type ?? ""
  ).trim().toLowerCase();

  if (/made|anotad|encestad|canasta|converted|scored/.test(action)) return true;
  if (/attempted|missed|fallo|fallad|errad|out/.test(action)) return false;

  return false;
}

export default resolveShotMade;
