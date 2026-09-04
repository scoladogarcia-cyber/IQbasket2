/**
 * @fileoverview Frontera cliente para generación IA de Player 360.
 * @description El navegador solo invoca la Edge Function de IQBasket. Nunca
 * conoce proveedor, endpoint ni secretos de modelo.
 */

import { PLAYER360_AI_GATEWAY_CONFIG } from "../../config/player360-ai-gateway.config.js";

function required(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`Player360AiGatewayService: ${label} es obligatorio.`);
  }
  return value;
}

function assertClient(client) {
  if (!client?.functions || typeof client.functions.invoke !== "function") {
    throw new Error("Player360AiGatewayService: cliente de Edge Functions no disponible.");
  }
}

function resolveIdempotencyKey(value = null) {
  if (value) return String(value).trim();
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  throw new Error("AI_IDEMPOTENCY_KEY_UNAVAILABLE");
}

export class Player360AiGatewayService {
  constructor(supabaseClient = null, options = {}) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.edgeFunctionName = options.edgeFunctionName
      || PLAYER360_AI_GATEWAY_CONFIG.edgeFunctionName;
    this.generationEnabled = options.generationEnabled
      ?? PLAYER360_AI_GATEWAY_CONFIG.generationEnabled;
  }

  isEnabled() {
    return Boolean(this.generationEnabled);
  }

  async generateInsight({ snapshotId, audience = "STAFF", locale = "es", idempotencyKey = null } = {}) {
    assertClient(this.supabase);
    required(snapshotId, "snapshotId");

    if (!this.isEnabled()) {
      throw new Error("AI_GATEWAY_NOT_ENABLED");
    }

    const normalizedAudience = String(audience || "STAFF").trim().toUpperCase();
    if (!PLAYER360_AI_GATEWAY_CONFIG.allowedAudiences.includes(normalizedAudience)) {
      throw new Error("AI_AUDIENCE_UNSUPPORTED");
    }
    const requestKey = resolveIdempotencyKey(idempotencyKey);

    const { data, error } = await this.supabase.functions.invoke(this.edgeFunctionName, {
      body: {
        snapshot_id: snapshotId,
        idempotency_key: requestKey,
        audience: normalizedAudience,
        locale: String(locale || "es").trim().toLowerCase()
      }
    });

    if (error) throw error;
    if (!data?.success || !data?.insight_id) {
      const code = data?.error_code || "AI_GATEWAY_GENERATION_FAILED";
      const message = data?.message ? `: ${data.message}` : "";
      throw new Error(`${code}${message}`);
    }

    return {
      insightId: data.insight_id,
      status: data.status || "DRAFT",
      provider: data.provider || null,
      modelName: data.model_name || null,
      promptVersion: data.prompt_version || null,
      usage: data.usage || null,
      usageLedgerId: data.usage_ledger_id || null,
      idempotencyKey: requestKey,
      replayed: Boolean(data.replayed)
    };
  }
}

export default Player360AiGatewayService;
