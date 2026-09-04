/**
 * @fileoverview Provider-neutral commercial entitlement adapter.
 * @description The client asks about a sports subject. The backend validates
 * account state, sports access and the effective commercial subscription.
 */

import {
  normalizeBillingSubjectType,
  normalizeEntitlementCode
} from "../../security/entitlements.js";

export class EntitlementService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  _requireClient() {
    if (!this.supabase?.rpc) throw new Error("ENTITLEMENT_BACKEND_UNAVAILABLE");
  }

  _normalizeSubject(subjectType, subjectId) {
    const type = normalizeBillingSubjectType(subjectType);
    const id = String(subjectId || "").trim();
    if (!type || !id) throw new Error("ENTITLEMENT_SUBJECT_REQUIRED");
    return { type, id };
  }
  async check({
    subjectType,
    subjectId,
    entitlementCode,
    teamSeasonId = null,
    requiredUnits = 1
  }) {
    this._requireClient();
    const subject = this._normalizeSubject(subjectType, subjectId);
    const code = normalizeEntitlementCode(entitlementCode);
    if (!code) throw new Error("ENTITLEMENT_CODE_REQUIRED");

    const { data, error } = await this.supabase.rpc("iq_saas_entitlement_check", {
      p_subject_type: subject.type,
      p_subject_id: subject.id,
      p_team_season_id: teamSeasonId || null,
      p_entitlement_code: code,
      p_required_units: Number.isFinite(Number(requiredUnits)) ? Number(requiredUnits) : 1
    });
    if (error) {
      const wrapped = new Error(error.message || "ENTITLEMENT_CHECK_FAILED");
      wrapped.code = "ENTITLEMENT_CHECK_FAILED";
      wrapped.cause = error;
      throw wrapped;
    }
    return data || { allowed: false, entitlement_code: code };
  }
  async has(subjectContext, entitlementCode) {
    const result = await this.check({
      ...subjectContext,
      entitlementCode,
      requiredUnits: 1
    });
    return Boolean(result?.allowed);
  }

  async getSnapshot({ subjectType, subjectId, teamSeasonId = null }) {
    this._requireClient();
    const subject = this._normalizeSubject(subjectType, subjectId);
    const { data, error } = await this.supabase.rpc("iq_saas_entitlement_snapshot", {
      p_subject_type: subject.type,
      p_subject_id: subject.id,
      p_team_season_id: teamSeasonId || null
    });
    if (error) {
      const wrapped = new Error(error.message || "ENTITLEMENT_SNAPSHOT_FAILED");
      wrapped.code = "ENTITLEMENT_SNAPSHOT_FAILED";
      wrapped.cause = error;
      throw wrapped;
    }
    return data || { licensed: false, entitlements: {} };
  }
}

export default EntitlementService;
