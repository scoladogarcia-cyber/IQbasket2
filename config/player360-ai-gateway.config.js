/**
 * @fileoverview Contrato compartido de la pasarela IA de Player 360.
 * @description Centraliza límites de payload, módulos autorizados y esquema de
 * salida. No contiene secretos, URLs de proveedor ni decisiones de acceso.
 */

export const PLAYER360_AI_GATEWAY_CONFIG = Object.freeze({
  gatewayVersion: "PLAYER360_AI_GATEWAY_V1",
  outputContractVersion: "PLAYER360_AI_INSIGHT_V1",
  edgeFunctionName: "player360-ai-insight",
  promptVersion: "PLAYER360_STAFF_ES_V2",
  /**
   * Se mantiene a false hasta que la Edge Function y sus secretos estén
   * desplegados y validados. El backend sigue siendo la autoridad aunque la UI
   * se habilite posteriormente.
   */
  generationEnabled: false,
  allowedAudiences: Object.freeze(["STAFF"]),
  allowedEvidenceModules: Object.freeze([
    "competition",
    "training",
    "external_development",
    "evaluation"
  ]),
  restrictedEvidenceModules: Object.freeze([
    "nutrition",
    "recovery",
    "neuro_cognitive"
  ]),
  maxEvidenceBytes: 64 * 1024,
  maxListItems: 8,
  maxTextLength: 2400
});

export const PLAYER360_AI_OUTPUT_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "interpretation",
    "priorities",
    "recommendations",
    "action_plan",
    "evidence_refs",
    "limitations"
  ],
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 1200 },
    interpretation: { type: "string", minLength: 1, maxLength: 2400 },
    priorities: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 400 }
    },
    recommendations: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 500 }
    },
    action_plan: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 500 }
    },
    evidence_refs: {
      type: "array",
      maxItems: 12,
      items: { type: "string", minLength: 1, maxLength: 240 }
    },
    limitations: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 500 }
    }
  }
});

const PROVIDER_EVIDENCE_FIELDS = Object.freeze(new Set([
  "fact_type",
  "evidence_type",
  "metric_key",
  "left_metric_key",
  "right_metric_key",
  "unit",
  "aggregation",
  "sample_size",
  "direction",
  "slope_per_week",
  "first_value",
  "last_value",
  "absolute_change",
  "relative_change_pct",
  "coverage_pct",
  "lag_buckets",
  "coefficient",
  "strength",
  "causal_claim_allowed",
  "status",
  "series_total",
  "series_with_data",
  "observed_buckets",
  "minimum_buckets",
  "observed_pairs",
  "minimum_pairs",
  "reason"
]));

function normalizeModule(value) {
  return String(value || "").trim().toLowerCase();
}

function addMetricModule(modules, value) {
  const key = String(value || "").trim();
  if (!key) return;
  const prefix = normalizeModule(key.split(".")[0]);
  if (prefix) modules.add(prefix);
}

function collectModulesFromRecord(modules, record = {}) {
  const explicit = normalizeModule(record?.module);
  if (explicit) modules.add(explicit);

  addMetricModule(modules, record?.key);
  addMetricModule(modules, record?.metric_key);
  addMetricModule(modules, record?.left_metric_key);
  addMetricModule(modules, record?.right_metric_key);
}

/**
 * Extrae módulos de hechos y ausencias de datos. Revisar también `missing_data`
 * evita que un módulo restringido entre por el gateway genérico únicamente
 * porque no dispone de muestra suficiente para convertirse en hecho.
 * @param {Record<string, any>} evidenceBundle
 * @returns {string[]}
 */
export function getEvidenceModules(evidenceBundle = {}) {
  const modules = new Set();
  const facts = Array.isArray(evidenceBundle?.facts) ? evidenceBundle.facts : [];
  const missingData = Array.isArray(evidenceBundle?.missing_data)
    ? evidenceBundle.missing_data
    : [];

  for (const fact of facts) collectModulesFromRecord(modules, fact);
  for (const missing of missingData) collectModulesFromRecord(modules, missing);

  return [...modules].sort();
}

/**
 * Defensa en profundidad: la primera versión real del gateway no procesa
 * Nutrition/Recovery/Neuro. Esos módulos requieren un flujo AI_PROCESS ABAC
 * explícito y se incorporarán en una fase independiente.
 * @param {Record<string, any>} evidenceBundle
 * @returns {{modules:string[], bytes:number}}
 */
export function assertEvidenceAllowedForAi(evidenceBundle = {}) {
  if (!evidenceBundle || typeof evidenceBundle !== "object" || Array.isArray(evidenceBundle)) {
    throw new Error("AI_EVIDENCE_INVALID");
  }
  if (evidenceBundle.evidence_version !== "PLAYER360_EVIDENCE_V1") {
    throw new Error("AI_EVIDENCE_VERSION_UNSUPPORTED");
  }

  const serialized = JSON.stringify(evidenceBundle);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > PLAYER360_AI_GATEWAY_CONFIG.maxEvidenceBytes) {
    throw new Error("AI_EVIDENCE_TOO_LARGE");
  }

  const modules = getEvidenceModules(evidenceBundle);
  const restricted = modules.filter(module =>
    PLAYER360_AI_GATEWAY_CONFIG.restrictedEvidenceModules.includes(module)
  );
  if (restricted.length) {
    throw new Error("AI_RESTRICTED_EVIDENCE_REQUIRES_ABAC");
  }

  const unsupported = modules.filter(module =>
    !PLAYER360_AI_GATEWAY_CONFIG.allowedEvidenceModules.includes(module)
  );
  if (unsupported.length) {
    throw new Error("AI_EVIDENCE_MODULE_UNSUPPORTED");
  }

  return { modules, bytes };
}

function cleanProviderRecord(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (!PROVIDER_EVIDENCE_FIELDS.has(key)) continue;
    if (
      item === null
      || typeof item === "string"
      || typeof item === "number"
      || typeof item === "boolean"
    ) {
      output[key] = item;
    }
  }
  return Object.keys(output).length ? output : null;
}

/**
 * Construye el único payload de evidencia que puede abandonar IQBasket.
 * Identificadores internos, procedencia, timestamps y cualquier campo futuro no
 * expresamente permitido se eliminan por allowlist antes de invocar proveedor.
 * @param {Record<string, any>} evidenceBundle
 * @returns {Record<string, any>}
 */
export function sanitizeEvidenceForAiProvider(evidenceBundle = {}) {
  assertEvidenceAllowedForAi(evidenceBundle);

  const facts = (Array.isArray(evidenceBundle.facts) ? evidenceBundle.facts : [])
    .map(cleanProviderRecord)
    .filter(Boolean);
  const missingData = (Array.isArray(evidenceBundle.missing_data) ? evidenceBundle.missing_data : [])
    .map(cleanProviderRecord)
    .filter(Boolean);
  const limitations = (Array.isArray(evidenceBundle.limitations) ? evidenceBundle.limitations : [])
    .map(item => String(item ?? "").trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, PLAYER360_AI_GATEWAY_CONFIG.maxListItems);

  return {
    evidence_version: evidenceBundle.evidence_version,
    calculation_version: String(evidenceBundle.calculation_version || "").slice(0, 160),
    facts,
    missing_data: missingData,
    limitations
  };
}

function cleanString(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanStringArray(value, maxItems, maxLength) {
  return (Array.isArray(value) ? value : [])
    .map(item => cleanString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

/**
 * Valida y normaliza la respuesta del proveedor antes de persistirla.
 * @param {Record<string, any>} value
 * @returns {Record<string, any>}
 */
export function normalizeAiInsightContent(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI_OUTPUT_INVALID");
  }

  const summary = cleanString(value.summary, 1200);
  const interpretation = cleanString(value.interpretation, 2400);
  if (!summary || !interpretation) throw new Error("AI_OUTPUT_REQUIRED_TEXT_MISSING");

  const maxItems = PLAYER360_AI_GATEWAY_CONFIG.maxListItems;
  return {
    summary,
    interpretation,
    priorities: cleanStringArray(value.priorities, maxItems, 400),
    recommendations: cleanStringArray(value.recommendations, maxItems, 500),
    action_plan: cleanStringArray(value.action_plan, maxItems, 500),
    evidence_refs: cleanStringArray(value.evidence_refs, 12, 240),
    limitations: cleanStringArray(value.limitations, maxItems, 500)
  };
}

export default PLAYER360_AI_GATEWAY_CONFIG;
