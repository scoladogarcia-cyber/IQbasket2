/**
 * @fileoverview First-party product analytics boundary for IQBasket.
 * @description Sends only whitelisted, non-sensitive product events through RPC.
 * Analytics failures are non-blocking for the user experience.
 */
function requireClient(client) {
  if (!client || typeof client.rpc !== "function") {
    throw new Error("ProductAnalyticsService: cliente de datos no disponible.");
  }
}

function normalizeText(value, max = 64) {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

export class ProductAnalyticsService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async track(event = {}) {
    requireClient(this.supabase);
    const { data, error } = await this.supabase.rpc("iq_v9_track_product_event", {
      p_event_code: normalizeText(event.eventCode),
      p_player_id: event.playerId || null,
      p_surface: normalizeText(event.surface) || "FAMILY_WORKSPACE",
      p_placement: normalizeText(event.placement),
      p_target_plan_code: normalizeText(event.targetPlanCode),
      p_experiment_key: normalizeText(event.experimentKey),
      p_variant_key: normalizeText(event.variantKey),
      p_evidence_count: Number.isFinite(Number(event.evidenceCount)) ? Number(event.evidenceCount) : null
    });
    if (error) throw error;
    return data;
  }

  async trackSafely(event = {}) {
    try {
      return await this.track(event);
    } catch (error) {
      console.warn("[ProductAnalytics] event ignored", event?.eventCode, error?.message || error);
      return null;
    }
  }
}

export default ProductAnalyticsService;

// Session-level deduplication is UX telemetry hygiene, not an authorization control.
ProductAnalyticsService.prototype.trackOncePerSession = async function trackOncePerSession(event = {}) {
  const key = [event.eventCode,event.playerId,event.surface,event.placement,event.targetPlanCode]
    .map(value => String(value || "-")).join(":");
  const storageKey = `iq_product_event:${key}`;
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(storageKey)) return null;
    const result = await this.trackSafely(event);
    if (result && typeof sessionStorage !== "undefined") sessionStorage.setItem(storageKey,"1");
    return result;
  } catch {
    return null;
  }
};
