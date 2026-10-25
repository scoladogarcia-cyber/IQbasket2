/** Canonical source rule for training-as-development evidence.
 * A player listed on a planned session or marked absent has NOT trained.
 * A confirmed participant contributes only with strictly positive real minutes.
 * This is intentionally separate from roster inclusion and absence records.
 */
export const TRAINED_STATUSES = Object.freeze(['PRESENT', 'PARTIAL']);

export function attendedTraining(participant) {
  return TRAINED_STATUSES.includes(String(participant?.attendance_status ?? participant?.status ?? '').toUpperCase())
    && Number(participant?.participated_minutes ?? participant?.minutes ?? 0) > 0;
}

export function trainingAttendanceImpact(participants = []) {
  const confirmed = participants.filter(attendedTraining);
  return Object.freeze({
    attended: confirmed.length,
    minutes: confirmed.reduce((sum, p) => sum + Number(p.participated_minutes ?? p.minutes ?? 0), 0),
    listed: participants.length
  });
}
