/**
 * @fileoverview Pure privacy-readiness helpers for family/minor workflows.
 * @description Provides factual age bands and guardian relationship filtering
 * without inferring legal basis or replacing administrative/legal review.
 */

export const PrivacyAgeBand = Object.freeze({
  UNKNOWN: "UNKNOWN",
  MINOR: "MINOR",
  ADULT: "ADULT"
});

export const ProcessingAuthorizationType = Object.freeze({
  CONSENT: "CONSENT",
  GUARDIAN_CONSENT: "GUARDIAN_CONSENT",
  OTHER_DOCUMENTED_BASIS: "OTHER_DOCUMENTED_BASIS"
});

export const PROCESSING_AUTHORIZATION_TYPES = Object.freeze([
  ProcessingAuthorizationType.CONSENT,
  ProcessingAuthorizationType.GUARDIAN_CONSENT,
  ProcessingAuthorizationType.OTHER_DOCUMENTED_BASIS
]);
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Returns completed years, or null when the birth date cannot be trusted. */
export function calculateAgeYears(birthDate, referenceDate = new Date()) {
  const birth = toDate(birthDate);
  const reference = toDate(referenceDate);
  if (!birth || !reference || birth > reference) return null;

  let years = reference.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = reference.getUTCMonth() < birth.getUTCMonth()
    || (reference.getUTCMonth() === birth.getUTCMonth()
      && reference.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years >= 0 ? years : null;
}

export function classifyPrivacyAgeBand(birthDate, referenceDate = new Date()) {
  const ageYears = calculateAgeYears(birthDate, referenceDate);
  if (ageYears === null) return { band: PrivacyAgeBand.UNKNOWN, ageYears: null };
  return {
    band: ageYears < 18 ? PrivacyAgeBand.MINOR : PrivacyAgeBand.ADULT,
    ageYears
  };
}
function relationshipIsActive(row = {}, referenceDate = new Date()) {
  if (String(row.status || "").toUpperCase() !== "ACTIVE") return false;
  const now = toDate(referenceDate);
  if (!now) return false;
  const validFrom = toDate(row.valid_from);
  const validUntil = toDate(row.valid_until);
  if (validFrom && validFrom > now) return false;
  if (validUntil && validUntil <= now) return false;
  return true;
}

/** Returns active GUARDIAN relationships for one player only. */
export function getActiveGuardians(relationships = [], playerId, referenceDate = new Date()) {
  const target = String(playerId || "");
  if (!target) return [];
  return (Array.isArray(relationships) ? relationships : []).filter(row =>
    String(row.player_id || "") === target
    && String(row.relationship_type || "").toUpperCase() === "GUARDIAN"
    && relationshipIsActive(row, referenceDate)
  );
}

export function requiresGuardianRepresentative(authorizationType) {
  return String(authorizationType || "").toUpperCase()
    === ProcessingAuthorizationType.GUARDIAN_CONSENT;
}
export function describePrivacyAgeReadiness(birthDate, referenceDate = new Date()) {
  const { band, ageYears } = classifyPrivacyAgeBand(birthDate, referenceDate);
  if (band === PrivacyAgeBand.MINOR) {
    return {
      band,
      ageYears,
      label: `Menor de edad${ageYears === null ? "" : ` · ${ageYears} años`}`,
      guidance: "Revisa representación, base jurídica y evidencia antes de registrar la autorización. IQBasket no decide automáticamente quién debe consentir."
    };
  }
  if (band === PrivacyAgeBand.ADULT) {
    return {
      band,
      ageYears,
      label: `Mayor de edad${ageYears === null ? "" : ` · ${ageYears} años`}`,
      guidance: "Documenta la base jurídica y la evidencia aplicables; la edad no sustituye la revisión de finalidad y categoría de datos."
    };
  }
  return {
    band,
    ageYears: null,
    label: "Edad no verificada",
    guidance: "Falta una fecha de nacimiento fiable. Revisa la representación y la base jurídica antes de continuar."
  };
}

export function isSupportedAuthorizationType(value) {
  return PROCESSING_AUTHORIZATION_TYPES.includes(String(value || "").toUpperCase());
}
