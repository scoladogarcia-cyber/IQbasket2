/**
 * @fileoverview Configuración central del gateway IA de Player 360.
 * @description El MVP solo admite LLMs sin coste variable de API y nunca
 * expone credenciales en el navegador. La disponibilidad real se resuelve en
 * backend mediante Supabase Edge Functions.
 */

export const PLAYER360_AI_COST_CLASS = Object.freeze({
  FREE: "FREE"
});

export const PLAYER360_AI_PROVIDER = Object.freeze({
  /**
   * Endpoint OpenAI-compatible autogestionado (Ollama, llama.cpp u otro LLM
   * local/controlado por la organización). No se habilitan proveedores de pago.
   */
  LOCAL_OPENAI_COMPATIBLE: "LOCAL_OPENAI_COMPATIBLE"
});

export const PLAYER360_AI_GATEWAY_CONFIG = Object.freeze({
  contractVersion: "PLAYER360_AI_GATEWAY_V1",
  edgeFunctionName: "player360-ai-insight",
  promptVersion: "PLAYER360_STAFF_ES_V2",
  freeOnly: true,
  allowedCostClasses: Object.freeze([
    PLAYER360_AI_COST_CLASS.FREE
  ]),
  allowedProviders: Object.freeze([
    PLAYER360_AI_PROVIDER.LOCAL_OPENAI_COMPATIBLE
  ]),
  supportedAudiences: Object.freeze([
    "STAFF",
    "PLAYER",
    "FAMILY",
    "EXECUTIVE"
  ]),
  supportedPurposes: Object.freeze([
    "SPORT_PERFORMANCE",
    "OPERATIONS"
  ]),
  defaultAudience: "STAFF",
  defaultPurpose: "SPORT_PERFORMANCE"
});

export default PLAYER360_AI_GATEWAY_CONFIG;
