/**
 * @fileoverview Frontera cliente para el gateway IA seguro de Player 360.
 * @description La UI nunca llama a un proveedor LLM directamente. Todas las
 * peticiones pasan por una Supabase Edge Function autenticada que aplica RBAC,
 * ABAC, minimización de datos, cuotas y la política FREE_ONLY.
 */

import { PLAYER360_AI_GATEWAY_CONFIG } from "../../config/player360-ai.config.js";

function required(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`AiInsightGatewayService: ${label} es obligatorio.`);
  }
  return value;
}

function normalizeAudience(value) {
  const normalized = String(value || PLAYER360_AI_GATEWAY_CONFIG.defaultAudience)
    .trim()
    .toUpperCase();
  if (!PLAYER360_AI_GATEWAY_CONFIG.supportedAudiences.includes(normalized)) {
    throw new Error("AiInsightGatewayService: audiencia no permitida.");
  }
  return normalized;
}

function normalizePurpose(value) {
  const normalized = String(value || PLAYER360_AI_GATEWAY_CONFIG.defaultPurpose)
    .trim()
    .toUpperCase();
  if (!PLAYER360_AI_GATEWAY_CONFIG.supportedPurposes.includes(normalized)) {
    throw new Error("AiInsightGatewayService: finalidad no permitida.");
  }
  return normalized;
}

export class AiInsightGatewayService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  _assertReady() {
    if (!this.supabase?.functions?.invoke) {
      throw new Error("AiInsightGatewayService: Supabase Functions no disponible.");
    }
  }

  async _invoke(body) {
    this._assertReady();
    const { data, error } = await this.supabase.functions.invoke(
      PLAYER360_AI_GATEWAY_CONFIG.edgeFunctionName,
      { body }
    );
    if (error) throw error;
    return data || {};
  }

  /**
   * Consulta capacidad sin activar ninguna generación.
   * Si la función no está desplegada/configurada, el llamador puede tratar la
   * IA como no disponible sin romper el resto de Player 360.
   */
  async getCapabilities() {
    try {
      const data = await this._invoke({ action: "capabilities" });
      return {
        available: Boolean(data.available),
        freeOnly: data.free_only !== false,
        provider: data.provider || null,
        modelName: data.model_name || null,
        promptVersion: data.prompt_version || PLAYER360_AI_GATEWAY_CONFIG.promptVersion,
        reason: data.reason || null
      };
    } catch (error) {
      return {
        available: false,
        freeOnly: true,
        provider: null,
        modelName: null,
        promptVersion: PLAYER360_AI_GATEWAY_CONFIG.promptVersion,
        reason: error?.message || "AI_GATEWAY_UNAVAILABLE"
      };
    }
  }

  async generateInsight({
    snapshotId,
    audience = PLAYER360_AI_GATEWAY_CONFIG.defaultAudience,
    locale = "es",
    purpose = PLAYER360_AI_GATEWAY_CONFIG.defaultPurpose
  } = {}) {
    required(snapshotId, "snapshotId");
    const normalizedLocale = String(locale || "es").trim().toLowerCase().slice(0, 10);

    const data = await this._invoke({
      action: "generate",
      snapshot_id: snapshotId,
      audience: normalizeAudience(audience),
      locale: normalizedLocale || "es",
      purpose: normalizePurpose(purpose)
    });

    if (!data?.success) {
      throw new Error(data?.error || "No se pudo generar la interpretación IA.");
    }

    return {
      insightId: data.insight_id || null,
      requestId: data.request_id || null,
      status: data.status || "DRAFT",
      deduplicated: Boolean(data.deduplicated),
      provider: data.provider || null,
      modelName: data.model_name || null,
      promptVersion: data.prompt_version || null,
      freeOnly: data.free_only !== false,
      estimatedCostEurMicros: Number(data.estimated_cost_eur_micros || 0)
    };
  }
}

export default AiInsightGatewayService;
