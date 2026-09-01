/**
 * @fileoverview Catálogo único de roles de IQ Basket.
 * @description Los roles se normalizan aquí para evitar divergencias entre vistas.
 */

export const UNIQUE_SUPERADMIN_EMAIL = "scolado@nechigroup.com";

export const UserRole = Object.freeze({
  SUPERADMIN: "SUPERADMIN",
  ADMIN: "ADMIN",
  ENTRENADOR: "ENTRENADOR",
  ANALISTA: "ANALISTA",
  PREPARADOR_FISICO: "PREPARADOR_FISICO",
  JUGADOR: "JUGADOR",
  FAMILIA_TUTOR: "FAMILIA_TUTOR",
  VISOR: "VISOR",
  INVITADO: "INVITADO"
});

const LEGACY_ROLE_ALIASES = Object.freeze({
  SCOUT: UserRole.ANALISTA,
  VIEWER: UserRole.VISOR,
  FAMILY: UserRole.FAMILIA_TUTOR,
  FAMILIA: UserRole.FAMILIA_TUTOR,
  TUTOR: UserRole.FAMILIA_TUTOR,
  PREPARADOR: UserRole.PREPARADOR_FISICO,
  PREPARADOR_FÍSICO: UserRole.PREPARADOR_FISICO,
  "PREPARADOR FISICO": UserRole.PREPARADOR_FISICO,
  "PREPARADOR FÍSICO": UserRole.PREPARADOR_FISICO
});

export function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

export function normalizeRole(role, email = "") {
  const normalizedEmail = normalizeEmail(email);
  const rawRole = String(role || UserRole.INVITADO).trim().toUpperCase();
  const aliasedRole = LEGACY_ROLE_ALIASES[rawRole] || rawRole;
  const knownRole = Object.values(UserRole).includes(aliasedRole)
    ? aliasedRole
    : UserRole.INVITADO;

  // Regla de seguridad: solo una identidad concreta puede ser SUPERADMIN.
  if (knownRole === UserRole.SUPERADMIN && normalizedEmail !== UNIQUE_SUPERADMIN_EMAIL) {
    return UserRole.INVITADO;
  }

  // La cuenta maestra conserva SUPERADMIN aunque un perfil remoto esté incompleto.
  if (normalizedEmail === UNIQUE_SUPERADMIN_EMAIL) {
    return UserRole.SUPERADMIN;
  }

  return knownRole;
}

export function isUniqueSuperadmin(email = "") {
  return normalizeEmail(email) === UNIQUE_SUPERADMIN_EMAIL;
}

export const ASSIGNABLE_STANDARD_ROLES = Object.freeze([
  UserRole.ENTRENADOR,
  UserRole.ANALISTA,
  UserRole.PREPARADOR_FISICO,
  UserRole.JUGADOR,
  UserRole.FAMILIA_TUTOR,
  UserRole.VISOR,
  UserRole.INVITADO
]);

export default UserRole;
