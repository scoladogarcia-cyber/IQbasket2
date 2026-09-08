/**
 * @fileoverview Deterministic projection from live PBP events to player_game_stats.
 * @description Keeps live capture and BoxScore on one source of truth. Existing
 * stats that cannot be explained by historical PBP are preserved as a baseline,
 * so older/partial games are never reset when the live scorer is reopened.
 */

const ADDITIVE_FIELDS = Object.freeze([
  "points",
  "fg2_made",
  "fg2_attempted",
  "fg3_made",
  "fg3_attempted",
  "ft_made",
  "ft_attempted",
  "off_reb",
  "def_reb",
  "assists",
  "steals",
  "blocks",
  "blocks_made",
  "blocks_received",
  "turnovers",
  "fouls_committed",
  "fouls_drawn"
]);

function numeric(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function playerIdOf(event = {}) {
  return String(event.player_id || event.playerId || "").trim();
}

function actionOf(event = {}) {
  return String(event.action_type || event.action || event.event_type || "").trim();
}

function emptyCounters() {
  return Object.fromEntries(ADDITIVE_FIELDS.map(field => [field, 0]));
}

function increment(counters, field, amount = 1) {
  if (!(field in counters)) return;
  counters[field] = numeric(counters[field]) + numeric(amount);
}

/**
 * Projects only statistics that are explicitly evidenced by the PBP.
 * Opponent events and unattributed team events are deliberately ignored.
 */
export function projectPbpCounters(events = []) {
  const byPlayer = new Map();

  for (const event of events || []) {
    if (event?.isOpponent || event?.is_opponent) continue;
    const playerId = playerIdOf(event);
    if (!playerId) continue;
    if (!byPlayer.has(playerId)) byPlayer.set(playerId, emptyCounters());
    const counters = byPlayer.get(playerId);
    const action = actionOf(event);

    switch (action) {
      case "fg2_made":
        increment(counters, "fg2_made");
        increment(counters, "fg2_attempted");
        increment(counters, "points", numeric(event.points) || 2);
        break;
      case "fg2_attempted":
        increment(counters, "fg2_attempted");
        break;
      case "fg3_made":
        increment(counters, "fg3_made");
        increment(counters, "fg3_attempted");
        increment(counters, "points", numeric(event.points) || 3);
        break;
      case "fg3_attempted":
        increment(counters, "fg3_attempted");
        break;
      case "ft_made":
        increment(counters, "ft_made");
        increment(counters, "ft_attempted");
        increment(counters, "points", numeric(event.points) || 1);
        break;
      case "ft_attempted":
        increment(counters, "ft_attempted");
        break;
      case "off_reb":
        increment(counters, "off_reb");
        break;
      case "def_reb":
        increment(counters, "def_reb");
        break;
      case "assists":
        increment(counters, "assists");
        break;
      case "steals":
        increment(counters, "steals");
        break;
      case "blocks_made":
        increment(counters, "blocks");
        increment(counters, "blocks_made");
        break;
      case "blocks_received":
        increment(counters, "blocks_received");
        break;
      case "turnovers":
        increment(counters, "turnovers");
        break;
      case "fouls_committed":
        increment(counters, "fouls_committed");
        break;
      case "fouls_drawn":
        increment(counters, "fouls_drawn");
        break;
      default:
        break;
    }
  }

  return byPlayer;
}

/**
 * Builds non-destructive baselines for games whose stored BoxScore predates or
 * exceeds their available PBP. Only unexplained additive counters are retained.
 */
export function buildPlayerStatBaselines(existingStats = [], loadedEvents = []) {
  const derived = projectPbpCounters(loadedEvents);
  const baselines = new Map();

  for (const row of existingStats || []) {
    const playerId = String(row.player_id || row.playerId || "").trim();
    if (!playerId) continue;
    const fromPbp = derived.get(playerId) || emptyCounters();
    const baseline = emptyCounters();

    for (const field of ADDITIVE_FIELDS) {
      baseline[field] = Math.max(0, numeric(row[field]) - numeric(fromPbp[field]));
    }

    baseline.minutes = Math.max(0, numeric(row.minutes));
    baseline.plus_minus = numeric(row.plus_minus ?? row.plusMinus);
    baselines.set(playerId, baseline);
  }

  return baselines;
}

function plusMinusFromCurrentEvents(events = [], playerId) {
  let value = 0;
  for (const event of events || []) {
    const activeIds = Array.isArray(event?.onCourt) ? event.onCourt.map(String) : [];
    if (!activeIds.includes(String(playerId))) continue;
    const points = numeric(event.points);
    if (event.isOpponent || event.is_opponent) value -= points;
    else value += points;
  }
  return value;
}

/**
 * Produces the exact snake_case payload accepted by iq_v28_save_game_capture.
 * The roster determines which player rows exist; the PBP determines live stats.
 */
export function projectLivePlayerStats({ roster = [], events = [], baselines = new Map() } = {}) {
  const derived = projectPbpCounters(events);

  return (roster || [])
    .filter(player => player?.isConvoked !== false)
    .map(player => {
      const playerId = String(player.id || "").trim();
      const baseline = baselines.get(playerId) || emptyCounters();
      const current = derived.get(playerId) || emptyCounters();
      const result = {
        player_id: playerId,
        starter: Boolean(player.isStarter),
        minutes: Math.max(0, numeric(baseline.minutes)),
        plus_minus: numeric(baseline.plus_minus) + plusMinusFromCurrentEvents(events, playerId)
      };

      for (const field of ADDITIVE_FIELDS) {
        result[field] = numeric(baseline[field]) + numeric(current[field]);
      }
      return result;
    });
}

export const LiveCaptureStatFields = ADDITIVE_FIELDS;
