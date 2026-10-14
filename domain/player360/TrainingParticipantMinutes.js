/**
 * Individual training-time rules, independent of any club/team membership.
 * A null override inherits the session duration; zero is an explicit value.
 * Minutes are only accrued for confirmed attendance and validated sessions.
 */
export const ACCRUABLE_ATTENDANCE = new Set(['PRESENT', 'PARTIAL']);

export function validateTrainingMinutes(value, { allowNull = false } = {}) {
  if (allowNull && (value === null || value === undefined || value === '')) return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > 600)
    throw new RangeError('TRAINING_MINUTES_INVALID');
  return number;
}

export function resolveParticipantMinutes(sessionMinutes, overrideMinutes = null) {
  const total = validateTrainingMinutes(sessionMinutes);
  const adjusted = validateTrainingMinutes(overrideMinutes, { allowNull: true });
  if (adjusted !== null && adjusted > total)
    throw new RangeError('TRAINING_PARTICIPANT_EXCEEDS_SESSION');
  return adjusted ?? total;
}

/** Store null when a player inherits the main duration; preserve explicit zero. */
export function normalizeParticipantOverride(sessionMinutes, participantMinutes) {
  const total = validateTrainingMinutes(sessionMinutes);
  const own = validateTrainingMinutes(participantMinutes, { allowNull: true });
  if (own === null || own === total) return null;
  if (own > total) throw new RangeError('TRAINING_PARTICIPANT_EXCEEDS_SESSION');
  return own;
}

/** Return accrued minutes; never infer attendance from being selected/planned. */
export function accruedTrainingMinutes({ sessionMinutes, overrideMinutes = null, attendanceStatus,
  sessionValidated = false } = {}) {
  if (!sessionValidated || !ACCRUABLE_ATTENDANCE.has(String(attendanceStatus || '').toUpperCase())) return 0;
  return resolveParticipantMinutes(sessionMinutes, overrideMinutes);
}

/** New cloned sessions inherit invitees/durations, not actual attendance or RPE. */
export function cloneTrainingParticipants(participants = []) {
  return participants.map(({ player_id, playerId, duration_override_minutes, participated_minutes }) => ({
    player_id: player_id ?? playerId,
    duration_override_minutes: duration_override_minutes ?? participated_minutes ?? null,
    attendance_status: 'PLANNED',
    participated_minutes: null,
    rpe: null,
    notes: null
  }));
}
