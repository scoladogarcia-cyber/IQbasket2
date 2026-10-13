/**
 * @fileoverview Domain helpers for safe recovery of basketball playing time.
 * @description Pure functions only: expected team minutes, direct-minute
 * validation and deterministic minutes reconstructed from complete lineup
 * segments. No persistence or UI dependencies.
 */

const FIVE = 5;
const OVERTIME_MINUTES = 5;

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function regulationPeriods(game = {}) {
  return Math.max(1, Math.trunc(number(game.periods_count ?? game.periodsCount, 4)));
}

export function regulationMinutes(game = {}) {
  return Math.max(1, Math.trunc(number(game.period_minutes ?? game.periodMinutes, 10)));
}

export function overtimeCount(game = {}) {
  return Math.max(0, Math.trunc(number(game.overtime_count ?? game.overtimeCount, 0)));
}

export function actualPeriodCount(game = {}) {
  return regulationPeriods(game) + overtimeCount(game);
}

export function periodDurationSeconds(game = {}, periodNumber = 1) {
  return (Number(periodNumber) <= regulationPeriods(game) ? regulationMinutes(game) : OVERTIME_MINUTES) * 60;
}

export function expectedTeamMinutes(game = {}) {
  const gameMinutes = (regulationPeriods(game) * regulationMinutes(game))
    + (overtimeCount(game) * OVERTIME_MINUTES);
  return gameMinutes * FIVE;
}

export function parseClock(value, maxSeconds = 3600) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error(`Reloj inválido: "${raw}". Usa MM:SS.`);
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds > 59) throw new Error(`Reloj inválido: "${raw}".`);
  const total = minutes * 60 + seconds;
  if (total < 0 || total > maxSeconds) throw new Error(`Reloj fuera de rango: "${raw}".`);
  return total;
}

export function formatClock(seconds = 0) {
  const safe = Math.max(0, Math.trunc(number(seconds, 0)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function validateDirectMinutes(entries = [], game = {}) {
  const expected = expectedTeamMinutes(game);
  const seen = new Set();
  const normalized = (entries || []).map(entry => {
    const playerId = String(entry?.player_id ?? entry?.playerId ?? "").trim();
    if (!playerId) throw new Error("Hay una fila de minutaje sin jugador.");
    if (seen.has(playerId)) throw new Error("Hay jugadores duplicados en el minutaje.");
    seen.add(playerId);
    const minutes = Number(entry?.minutes);
    if (!Number.isInteger(minutes) || minutes < 0) {
      throw new Error("Los minutos deben ser números enteros iguales o superiores a 0.");
    }
    const maxIndividual = (regulationPeriods(game) * regulationMinutes(game)) + (overtimeCount(game) * OVERTIME_MINUTES);
    if (minutes > maxIndividual) {
      throw new Error(`Un jugador no puede superar ${maxIndividual} minutos en este partido.`);
    }
    return { player_id: playerId, minutes };
  });
  const total = normalized.reduce((sum, row) => sum + row.minutes, 0);
  return {
    entries: normalized,
    total,
    expected,
    valid: total === expected,
    difference: expected - total
  };
}

function normalizeSegment(segment, game) {
  const period = Math.trunc(number(segment?.period, 0));
  if (period < 1 || period > actualPeriodCount(game)) {
    throw new Error(`Periodo inválido en un tramo: Q${period || "?"}.`);
  }
  const max = periodDurationSeconds(game, period);
  const start = typeof segment?.startSeconds === "number"
    ? segment.startSeconds
    : parseClock(segment?.start_clock ?? segment?.startClock, max);
  const end = typeof segment?.endSeconds === "number"
    ? segment.endSeconds
    : parseClock(segment?.end_clock ?? segment?.endClock, max);
  if (start <= end) {
    throw new Error(`En Q${period}, el reloj inicial debe ser mayor que el final.`);
  }
  const onCourt = [...new Set((segment?.on_court ?? segment?.onCourt ?? []).map(String).filter(Boolean))];
  if (onCourt.length !== FIVE) {
    throw new Error(`Cada tramo debe contener exactamente 5 jugadores distintos (Q${period} ${formatClock(start)}–${formatClock(end)}).`);
  }
  return { period, startSeconds: start, endSeconds: end, onCourt };
}

function allocateWholeMinutes(secondsByPlayer, expected) {
  const exact = [...secondsByPlayer.entries()].map(([playerId, seconds]) => {
    const exactMinutes = seconds / 60;
    const base = Math.floor(exactMinutes);
    return { playerId, seconds, exactMinutes, base, fraction: exactMinutes - base };
  });
  const baseTotal = exact.reduce((sum, row) => sum + row.base, 0);
  let remaining = expected - baseTotal;
  if (remaining < 0 || remaining > exact.length) {
    throw new Error("No se pudo redondear el minutaje manteniendo el total reglamentario.");
  }
  exact.sort((a, b) => b.fraction - a.fraction || a.playerId.localeCompare(b.playerId));
  exact.forEach((row, index) => {
    row.minutes = row.base + (index < remaining ? 1 : 0);
  });
  exact.sort((a, b) => a.playerId.localeCompare(b.playerId));
  return exact;
}

/**
 * Reconstructs whole player minutes from complete, non-overlapping lineup
 * segments. Every period must be covered from its full clock down to 00:00.
 */
export function buildMinutesFromSegments({ segments = [], playerIds = [], game = {} } = {}) {
  const knownPlayers = new Set((playerIds || []).map(String));
  const normalized = (segments || []).map(segment => normalizeSegment(segment, game));
  if (!normalized.length) throw new Error("Añade al menos un tramo de quinteto.");

  for (const segment of normalized) {
    for (const playerId of segment.onCourt) {
      if (knownPlayers.size && !knownPlayers.has(playerId)) {
        throw new Error("Un tramo contiene un jugador que no pertenece al acta del partido.");
      }
    }
  }

  const periodCount = actualPeriodCount(game);
  for (let period = 1; period <= periodCount; period += 1) {
    const max = periodDurationSeconds(game, period);
    const rows = normalized
      .filter(segment => segment.period === period)
      .sort((a, b) => b.startSeconds - a.startSeconds || b.endSeconds - a.endSeconds);

    if (!rows.length) throw new Error(`Falta reconstruir Q${period}.`);
    if (rows[0].startSeconds !== max) {
      throw new Error(`Q${period} debe empezar en ${formatClock(max)}.`);
    }
    if (rows.at(-1).endSeconds !== 0) {
      throw new Error(`Q${period} debe terminar en 00:00.`);
    }
    for (let index = 1; index < rows.length; index += 1) {
      if (rows[index - 1].endSeconds !== rows[index].startSeconds) {
        throw new Error(`Hay un hueco o solape en Q${period} entre ${formatClock(rows[index - 1].endSeconds)} y ${formatClock(rows[index].startSeconds)}.`);
      }
    }
  }

  const secondsByPlayer = new Map((playerIds || []).map(id => [String(id), 0]));
  for (const segment of normalized) {
    const duration = segment.startSeconds - segment.endSeconds;
    for (const playerId of segment.onCourt) {
      secondsByPlayer.set(playerId, (secondsByPlayer.get(playerId) || 0) + duration);
    }
  }

  const expected = expectedTeamMinutes(game);
  const totalSeconds = [...secondsByPlayer.values()].reduce((sum, value) => sum + value, 0);
  if (totalSeconds !== expected * 60) {
    throw new Error("Los tramos no cubren exactamente los minutos reglamentarios del equipo.");
  }

  const allocated = allocateWholeMinutes(secondsByPlayer, expected);
  const lineups = normalized
    .sort((a, b) => a.period - b.period || b.startSeconds - a.startSeconds)
    .map((segment, index) => ({
      id: `recovery-${segment.period}-${segment.startSeconds}-${index + 1}`,
      type: "RECOVERY_LINEUP",
      period: segment.period,
      game_clock: formatClock(segment.startSeconds),
      remaining_seconds: segment.startSeconds,
      players_in: [],
      players_out: [],
      on_court: segment.onCourt
    }));

  return {
    expected,
    totalSeconds,
    minutes: allocated.map(row => ({
      player_id: row.playerId,
      minutes: row.minutes,
      seconds: row.seconds
    })),
    lineups,
    segments: normalized
  };
}
