/**
 * @fileoverview Estado de ciclo de vida de una cuenta IQBasket.
 * @description Separa la seguridad de acceso del estado legacy de alta/aprobación
 * almacenado en user_profiles.status. Un estado desconocido explícito falla cerrado.
 */

export const AccountStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DISABLED: "DISABLED",
  PENDING_ACTIVATION: "PENDING_ACTIVATION"
});

const VALID_ACCOUNT_STATUSES = new Set(Object.values(AccountStatus));

/**
 * Normaliza el estado de cuenta. La ausencia de valor se considera ACTIVE para
 * mantener compatibilidad durante el despliegue aditivo; un valor desconocido
 * se trata como DISABLED para no abrir acceso por una mala configuración.
 */
export function normalizeAccountStatus(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return AccountStatus.ACTIVE;
  }

  const normalized = String(value).trim().toUpperCase();
  return VALID_ACCOUNT_STATUSES.has(normalized)
    ? normalized
    : AccountStatus.DISABLED;
}

export function isAccountStatusActive(value) {
  return normalizeAccountStatus(value) === AccountStatus.ACTIVE;
}

/** Error tipado para que la capa de autenticación pueda cerrar la sesión y dar UX específica. */
export class AccountAccessError extends Error {
  constructor(accountStatus) {
    const normalizedStatus = normalizeAccountStatus(accountStatus);
    super(`ACCOUNT_NOT_ACTIVE:${normalizedStatus}`);
    this.name = "AccountAccessError";
    this.code = "ACCOUNT_NOT_ACTIVE";
    this.accountStatus = normalizedStatus;
  }
}

export function assertAccountActive(accountStatus) {
  if (!isAccountStatusActive(accountStatus)) {
    throw new AccountAccessError(accountStatus);
  }
  return true;
}
