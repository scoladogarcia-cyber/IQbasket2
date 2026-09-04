/**
 * @fileoverview Adaptador de estado de cuenta para Supabase.
 * @description Obtiene el estado de seguridad desde el RPC dedicado; nunca usa
 * user_profiles.status, que pertenece al flujo legacy de alta/aprobación.
 */

import { AccountStatus, normalizeAccountStatus } from "../../security/accountStatus.js";

export class AccountStatusService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  async getCurrentState() {
    if (!this.supabase?.rpc) {
      throw new Error("ACCOUNT_STATUS_BACKEND_UNAVAILABLE");
    }

    const { data, error } = await this.supabase.rpc("iq_current_account_state");
    if (error) {
      const wrapped = new Error(error.message || "ACCOUNT_STATUS_LOOKUP_FAILED");
      wrapped.code = "ACCOUNT_STATUS_LOOKUP_FAILED";
      wrapped.cause = error;
      throw wrapped;
    }

    const rawStatus = data?.account_status ?? data?.accountStatus;
    const accountStatus = normalizeAccountStatus(rawStatus);
    return {
      active: Boolean(data?.active) && accountStatus === AccountStatus.ACTIVE,
      accountStatus,
      changedAt: data?.changed_at ?? data?.changedAt ?? null,
      reasonCode: data?.reason_code ?? data?.reasonCode ?? null
    };
  }
}

export default AccountStatusService;
