/**
 * @fileoverview Deterministic live-minute projection from persisted lineup changes.
 * @description Keeps playing-time calculation independent from the UI so live
 * recovery, final acta and future analytics can share one source of truth.
 */

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizedLineup(event = {}) {
  const values = Array.isArray(event.onCourt)
    ? event.onCourt
    : Array.isArray(event.on_court_player_ids)
      ? event.on_court_player_ids
      : [];
  return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))];
}

/**
 * Projects played seconds/minutes from ordered lineup states.
 * Each lineup event represents the five players active from its timestamp until
 * the next lineup state in the same period. The remaining time after the final
 * event is credited to that final five, matching the existing acta convention.
 */
export function calculateLiveMinutes({
  playerIds = [],
  lineupEvents = [],
  periodNames = [],
  getPeriodDuration = () => 0
} = {}) {
  const secondsByPlayer = new Map((playerIds || []).map(id => [String(id), 0]));
  let hasTimeline = false;

  for (const periodName of periodNames || []) {
    const periodSeconds = Math.max(0, finite(getPeriodDuration(periodName), 0));
    const events = (lineupEvents || [])
      .map((event, index) => ({ ...event, __index: index }))
      .filter(event => String(event.period || "") === String(periodName))
      .sort((a, b) => {
        const sa = finite(a.event_sequence ?? a.eventSequence, a.__index + 1);
        const sb = finite(b.event_sequence ?? b.eventSequence, b.__index + 1);
        return sa - sb;
      });

    if (!events.length) continue;
    const firstFive = normalizedLineup(events[0]);
    if (firstFive.length !== 5) continue;
    hasTimeline = true;

    let currentFive = firstFive;
    let lastRemaining = periodSeconds;

    for (const event of events) {
      const remaining = Math.max(0, Math.min(periodSeconds, finite(
        event.timeRemaining ?? event.remaining_seconds,
        lastRemaining
      )));
      const duration = Math.max(0, lastRemaining - remaining);
      for (const playerId of currentFive) {
        secondsByPlayer.set(playerId, finite(secondsByPlayer.get(playerId), 0) + duration);
      }
      const nextFive = normalizedLineup(event);
      if (nextFive.length === 5) currentFive = nextFive;
      lastRemaining = remaining;
    }

    for (const playerId of currentFive) {
      secondsByPlayer.set(playerId, finite(secondsByPlayer.get(playerId), 0) + lastRemaining);
    }
  }

  const minutesByPlayer = new Map();
  for (const [playerId, seconds] of secondsByPlayer.entries()) {
    minutesByPlayer.set(playerId, Math.round(seconds / 60));
  }

  return {
    hasTimeline,
    secondsByPlayer,
    minutesByPlayer,
    totalRoundedMinutes: [...minutesByPlayer.values()].reduce((sum, value) => sum + value, 0)
  };
}

export default calculateLiveMinutes;
