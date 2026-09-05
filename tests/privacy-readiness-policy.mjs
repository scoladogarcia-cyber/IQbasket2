import {
  PrivacyAgeBand,
  ProcessingAuthorizationType,
  PROCESSING_AUTHORIZATION_TYPES,
  calculateAgeYears,
  classifyPrivacyAgeBand,
  describePrivacyAgeReadiness,
  getActiveGuardians,
  requiresGuardianRepresentative,
  isSupportedAuthorizationType
} from "../domain/privacy/PrivacyReadinessPolicy.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const reference = new Date("2026-09-05T10:00:00Z");
assert(calculateAgeYears("2012-09-06", reference) === 13, "Edad antes de cumpleaños incorrecta");
assert(calculateAgeYears("2012-09-05", reference) === 14, "Edad en cumpleaños incorrecta");
assert(classifyPrivacyAgeBand("2012-01-01", reference).band === PrivacyAgeBand.MINOR, "Menor no clasificado");
assert(classifyPrivacyAgeBand("2000-01-01", reference).band === PrivacyAgeBand.ADULT, "Adulto no clasificado");
assert(classifyPrivacyAgeBand(null, reference).band === PrivacyAgeBand.UNKNOWN, "Edad desconocida no preservada");
const relationships = [
  { user_id: "guardian-active", player_id: "p1", relationship_type: "GUARDIAN", status: "ACTIVE", valid_until: null },
  { user_id: "guardian-expired", player_id: "p1", relationship_type: "GUARDIAN", status: "ACTIVE", valid_until: "2026-01-01T00:00:00Z" },
  { user_id: "self", player_id: "p1", relationship_type: "SELF", status: "ACTIVE" },
  { user_id: "other-player", player_id: "p2", relationship_type: "GUARDIAN", status: "ACTIVE" }
];
const guardians = getActiveGuardians(relationships, "p1", reference);
assert(guardians.length === 1 && guardians[0].user_id === "guardian-active", "Filtro de tutor activo incorrecto");
assert(requiresGuardianRepresentative(ProcessingAuthorizationType.GUARDIAN_CONSENT), "GUARDIAN_CONSENT debe exigir representante");
assert(!requiresGuardianRepresentative(ProcessingAuthorizationType.CONSENT), "CONSENT no debe exigir representante tutor");
assert(PROCESSING_AUTHORIZATION_TYPES.length === 3, "Catálogo de tipos de autorización inesperado");
for (const type of PROCESSING_AUTHORIZATION_TYPES) assert(isSupportedAuthorizationType(type), `Tipo no soportado: ${type}`);
assert(!isSupportedAuthorizationType("DIRECT_CONSENT"), "DIRECT_CONSENT legacy no debe aceptarse");

const minor = describePrivacyAgeReadiness("2012-01-01", reference);
assert(minor.label.includes("Menor de edad"), "Mensaje de menor ausente");
assert(minor.guidance.includes("no decide automáticamente"), "La UI no debe inferir base jurídica");

console.log("PRIVACY_READINESS_POLICY_OK");
