/**
 * Deterministic Training V55 focus analytics.
 *
 * Important semantic rule:
 * - focusSessionMinutes = total duration of sessions that CONTAIN a focus.
 * - playerExposureMinutes = a player's participated minutes in sessions that
 *   CONTAIN a focus.
 *
 * Neither metric means that every minute was spent on that focus unless a future
 * coach explicitly allocates focus-specific minutes. This module never makes
 * causal claims about training and match performance.
 */

function rows(value) { return Array.isArray(value) ? value : []; }
function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function focusCodes(session = {}) {
  const raw = session?.metadata?.training_focus_codes;
  return [...new Set(rows(raw).map(code => String(code || "").trim().toUpperCase()).filter(Boolean))];
}
function duration(session = {}) {
  const stored = finite(session.duration_minutes);
  if (stored !== null && stored > 0) return stored;
  const parse = value => {
    const match = String(value || "").match(/^(\d{2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const start = parse(session.start_time), end = parse(session.end_time);
  return start !== null && end !== null && end > start ? end - start : 0;
}
function participantMinutes(participant = {}, sessionMinutes = 0) {
  const status = String(participant.attendance_status || "").toUpperCase();
  if (["ABSENT","EXCUSED"].includes(status)) return 0;
  const explicit = finite(participant.participated_minutes);
  if (explicit !== null) return Math.max(0, explicit);
  return status === "PRESENT" ? Math.max(0, sessionMinutes) : 0;
}

export function buildTrainingFocusAnalytics(sessions = []) {
  const active = rows(sessions).filter(session => String(session?.status || "").toUpperCase() !== "ARCHIVED");
  const focusMap = new Map();
  const playerMap = new Map();

  for (const session of active) {
    const codes = focusCodes(session);
    const minutes = duration(session);
    for (const code of codes) {
      if (!focusMap.has(code)) focusMap.set(code, { code, sessions: 0, focusSessionMinutes: 0 });
      const target = focusMap.get(code);
      target.sessions += 1;
      target.focusSessionMinutes += minutes;
    }

    for (const participant of rows(session.participants)) {
      const playerId = String(participant?.player_id || participant?.playerId || "");
      if (!playerId) continue;
      const pMinutes = participantMinutes(participant, minutes);
      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, {
          playerId,
          sessions: 0,
          participatedMinutes: 0,
          focuses: new Map()
        });
      }
      const player = playerMap.get(playerId);
      if (pMinutes > 0) {
        player.sessions += 1;
        player.participatedMinutes += pMinutes;
      }
      for (const code of codes) {
        if (!player.focuses.has(code)) {
          player.focuses.set(code, { code, sessions: 0, playerExposureMinutes: 0 });
        }
        const focus = player.focuses.get(code);
        if (pMinutes > 0) focus.sessions += 1;
        focus.playerExposureMinutes += pMinutes;
      }
    }
  }

  return Object.freeze({
    semantics: Object.freeze({
      focusSessionMinutes: "SESSION_DURATION_WITH_FOCUS_NOT_FOCUS_ALLOCATION",
      playerExposureMinutes: "PLAYER_MINUTES_IN_SESSION_WITH_FOCUS_NOT_FOCUS_ALLOCATION",
      causalClaimAllowed: false
    }),
    totals: Object.freeze({
      sessions: active.length,
      sessionMinutes: active.reduce((sum, session) => sum + duration(session), 0)
    }),
    focuses: Object.freeze([...focusMap.values()].sort((a,b) => b.sessions - a.sessions || a.code.localeCompare(b.code))),
    players: Object.freeze([...playerMap.values()].map(player => Object.freeze({
      playerId: player.playerId,
      sessions: player.sessions,
      participatedMinutes: player.participatedMinutes,
      focuses: Object.freeze([...player.focuses.values()].sort((a,b) => b.sessions - a.sessions || a.code.localeCompare(b.code)))
    })))
  });
}

export default buildTrainingFocusAnalytics;
