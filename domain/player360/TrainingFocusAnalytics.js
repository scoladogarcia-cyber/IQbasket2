/**
 * Deterministic Training V58 focus analytics.
 *
 * Default semantics remain lightweight: a focus checkbox means the player was
 * exposed to a session containing that focus. When the coach optionally records
 * focus-specific minutes, those minutes become the preferred descriptive dose.
 * Neither mode implies causality with later performance.
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
function focusAllocation(session = {}) {
  const raw = session?.metadata?.training_focus_minutes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw)
    .map(([code,value]) => [String(code || "").toUpperCase(), finite(value)])
    .filter(([,value]) => value !== null && value >= 0));
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
  let sessionsWithExplicitAllocation = 0;

  for (const session of active) {
    const codes = focusCodes(session);
    const minutes = duration(session);
    const allocation = focusAllocation(session);
    const hasAllocation = Object.keys(allocation).length > 0;
    if (hasAllocation) sessionsWithExplicitAllocation += 1;

    for (const code of codes) {
      if (!focusMap.has(code)) {
        focusMap.set(code, {
          code, sessions: 0, focusSessionMinutes: 0,
          explicitAllocatedMinutes: 0, sessionExposureMinutes: 0,
          explicitSessions: 0, fallbackSessions: 0
        });
      }
      const target = focusMap.get(code);
      const allocated = finite(allocation[code]);
      target.sessions += 1;
      target.sessionExposureMinutes += minutes;
      if (allocated !== null) {
        target.focusSessionMinutes += allocated;
        target.explicitAllocatedMinutes += allocated;
        target.explicitSessions += 1;
      } else {
        target.focusSessionMinutes += minutes;
        target.fallbackSessions += 1;
      }
    }

    for (const participant of rows(session.participants)) {
      const playerId = String(participant?.player_id || participant?.playerId || "");
      if (!playerId) continue;
      const pMinutes = participantMinutes(participant, minutes);
      const participationRatio = minutes > 0 ? Math.min(1, Math.max(0, pMinutes / minutes)) : 0;
      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, {
          playerId, sessions: 0, participatedMinutes: 0, focuses: new Map()
        });
      }
      const player = playerMap.get(playerId);
      if (pMinutes > 0) {
        player.sessions += 1;
        player.participatedMinutes += pMinutes;
      }

      for (const code of codes) {
        if (!player.focuses.has(code)) {
          player.focuses.set(code, {
            code, sessions: 0, playerExposureMinutes: 0,
            explicitDoseMinutes: 0, sessionExposureMinutes: 0,
            explicitSessions: 0, fallbackSessions: 0
          });
        }
        const focus = player.focuses.get(code);
        const allocated = finite(allocation[code]);
        if (pMinutes > 0) focus.sessions += 1;
        focus.sessionExposureMinutes += pMinutes;
        if (allocated !== null) {
          const dose = allocated * participationRatio;
          focus.playerExposureMinutes += dose;
          focus.explicitDoseMinutes += dose;
          focus.explicitSessions += 1;
        } else {
          focus.playerExposureMinutes += pMinutes;
          focus.fallbackSessions += 1;
        }
      }
    }
  }

  return Object.freeze({
    semantics: Object.freeze({
      focusSessionMinutes: "EXPLICIT_FOCUS_MINUTES_WHEN_AVAILABLE_ELSE_SESSION_DURATION_WITH_FOCUS",
      playerExposureMinutes: "PROPORTIONAL_EXPLICIT_FOCUS_DOSE_WHEN_AVAILABLE_ELSE_PLAYER_MINUTES_IN_SESSION_WITH_FOCUS",
      causalClaimAllowed: false
    }),
    totals: Object.freeze({
      sessions: active.length,
      sessionMinutes: active.reduce((sum, session) => sum + duration(session), 0),
      sessionsWithExplicitAllocation,
      explicitAllocationCoveragePct: active.length
        ? Number(((sessionsWithExplicitAllocation / active.length) * 100).toFixed(1))
        : 0
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
