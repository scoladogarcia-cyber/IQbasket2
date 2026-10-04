/**
 * @fileoverview Date-derived age utilities for Player Passport.
 * @description Age is never persisted: players.birth_date is canonical.
 */
export function ageOnDate(birthDate, referenceDate = new Date()) {
  if (!birthDate) return null;
  const birth = new Date(`${String(birthDate).slice(0, 10)}T00:00:00`);
  const reference = referenceDate instanceof Date
    ? referenceDate
    : new Date(`${String(referenceDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime()) || reference < birth) return null;
  let age = reference.getFullYear() - birth.getFullYear();
  const monthDelta = reference.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && reference.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function formatAge(birthDate, referenceDate = new Date()) {
  const age = ageOnDate(birthDate, referenceDate);
  return age === null ? "—" : `${age} años`;
}
