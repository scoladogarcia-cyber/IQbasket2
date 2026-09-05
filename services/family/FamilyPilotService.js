/**
 * @fileoverview Client data boundary for the closed IQBasket Family pilot.
 * @description All authorization and commercial mutations remain server-side.
 * This service only invokes explicit RPCs and normalizes their results.
 */

import { FAMILY_PILOT_CONFIG } from "../../config/family-pilot.config.js";

function requireRpcClient(client) {
  if (!client || typeof client.rpc !== "function") {
    throw new Error("FAMILY_PILOT_BACKEND_UNAVAILABLE");
  }
}

function requireUuid(value, code) {
  const normalized = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(code);
  }
  return normalized;
}

export class FamilyPilotService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async getSnapshot() {
    requireRpcClient(this.supabase);
    const { data, error } = await this.supabase.rpc("iq_v11_family_pilot_snapshot");
    if (error) throw error;
    return {
      pilotCode: data?.pilot_code || FAMILY_PILOT_CONFIG.pilotCode,
      activeCount: Number(data?.active_count || 0),
      expiredCount: Number(data?.expired_count || 0),
      revokedCount: Number(data?.revoked_count || 0),
      candidates: Array.isArray(data?.candidates) ? data.candidates : [],
      enrollments: Array.isArray(data?.enrollments) ? data.enrollments : [],
      includesAi: Boolean(data?.ai_included),
      includesSensitiveModules: Boolean(data?.sensitive_modules_included)
    };
  }

  async enroll({ ownerUserId, playerId, trialDays = FAMILY_PILOT_CONFIG.defaultTrialDays } = {}) {
    requireRpcClient(this.supabase);
    const days = Number(trialDays);
    if (!FAMILY_PILOT_CONFIG.allowedTrialDays.includes(days)) {
      throw new Error("FAMILY_PILOT_DURATION_INVALID");
    }

    const { data, error } = await this.supabase.rpc("iq_v11_family_pilot_enroll", {
      p_owner_user_id: requireUuid(ownerUserId, "FAMILY_PILOT_OWNER_REQUIRED"),
      p_player_id: requireUuid(playerId, "FAMILY_PILOT_PLAYER_REQUIRED"),
      p_trial_days: days
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.reason_code || "FAMILY_PILOT_ENROLL_FAILED");
    return data;
  }

  async revoke({ enrollmentId, reason = "SUPERADMIN_REVOKE" } = {}) {
    requireRpcClient(this.supabase);
    const normalizedReason = String(reason || "SUPERADMIN_REVOKE").trim().slice(0, 500) || "SUPERADMIN_REVOKE";
    const { data, error } = await this.supabase.rpc("iq_v11_family_pilot_revoke", {
      p_enrollment_id: requireUuid(enrollmentId, "FAMILY_PILOT_ENROLLMENT_REQUIRED"),
      p_reason: normalizedReason
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.reason_code || "FAMILY_PILOT_REVOKE_FAILED");
    return data;
  }
}

export default FamilyPilotService;
