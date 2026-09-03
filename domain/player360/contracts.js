/**
 * Provider-agnostic contracts for Player 360 observations and AI evidence.
 *
 * IMPORTANT:
 * - Measurements and AI interpretations are different resources.
 * - AI output must never be normalized as an objective observation.
 */

import {
  PLAYER360_CONFIG,
  PLAYER360_MODULE,
  PLAYER360_SOURCE_TYPE,
  PLAYER360_SENSITIVITY
} from "../../config/player360.config.js";

const MODULE_VALUES = new Set(Object.values(PLAYER360_MODULE));
const SOURCE_VALUES = new Set(Object.values(PLAYER360_SOURCE_TYPE));
const SENSITIVITY_VALUES = new Set(Object.values(PLAYER360_SENSITIVITY));

function requireNonEmpty(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`Player360Observation: ${label} es obligatorio.`);
  }
  return normalized;
}

function normalizeOptionalUuidLike(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function normalizeUnitInterval(value, fallback, label) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new Error(`Player360Observation: ${label} debe estar entre 0 y 1.`);
  }
  return number;
}

function normalizeOccurredAt(value) {
  const normalized = requireNonEmpty(value, "occurred_at");
  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    throw new Error("Player360Observation: occurred_at debe ser una fecha ISO válida.");
  }
  return new Date(timestamp).toISOString();
}

export function normalizePlayer360Observation(input = {}) {
  const moduleCode = requireNonEmpty(input.module, "module").toLowerCase();
  if (!MODULE_VALUES.has(moduleCode)) {
    throw new Error(`Player360Observation: módulo no soportado (${moduleCode}).`);
  }

  const sourceType = requireNonEmpty(input.source_type, "source_type").toUpperCase();
  if (!SOURCE_VALUES.has(sourceType)) {
    throw new Error(`Player360Observation: source_type no soportado (${sourceType}).`);
  }

  const sensitivity = String(
    input.sensitivity
      || PLAYER360_CONFIG.modules[moduleCode]?.sensitivity
      || PLAYER360_SENSITIVITY.STANDARD
  ).toUpperCase();

  if (!SENSITIVITY_VALUES.has(sensitivity)) {
    throw new Error(`Player360Observation: sensitivity no soportada (${sensitivity}).`);
  }

  const metricCode = requireNonEmpty(input.metric_code, "metric_code").toUpperCase();
  const playerId = requireNonEmpty(input.player_id, "player_id");

  return Object.freeze({
    contract_version: PLAYER360_CONFIG.contractVersion,
    module: moduleCode,
    player_id: playerId,
    team_season_id: normalizeOptionalUuidLike(input.team_season_id),
    occurred_at: normalizeOccurredAt(input.occurred_at),
    source_type: sourceType,
    source_id: normalizeOptionalUuidLike(input.source_id),
    metric_code: metricCode,
    value: input.value ?? null,
    unit: input.unit ? String(input.unit) : null,
    quality: normalizeUnitInterval(
      input.quality,
      PLAYER360_CONFIG.coverage.qualityDefault,
      "quality"
    ),
    confidence: normalizeUnitInterval(input.confidence, null, "confidence"),
    sensitivity,
    captured_by: normalizeOptionalUuidLike(input.captured_by),
    provenance: input.provenance && typeof input.provenance === "object"
      ? { ...input.provenance }
      : {},
    metadata: input.metadata && typeof input.metadata === "object"
      ? { ...input.metadata }
      : {}
  });
}

export function buildInsightEvidenceBundle({
  playerId,
  teamSeasonId = null,
  period = null,
  facts = [],
  missingData = [],
  limitations = [],
  calculationVersion = null,
  generatedAt = new Date().toISOString()
} = {}) {
  const normalizedPlayerId = requireNonEmpty(playerId, "playerId");

  return Object.freeze({
    evidence_version: PLAYER360_CONFIG.insightEvidenceVersion,
    player_id: normalizedPlayerId,
    team_season_id: normalizeOptionalUuidLike(teamSeasonId),
    period: period && typeof period === "object" ? { ...period } : null,
    facts: Array.isArray(facts) ? facts.map(item => ({ ...item })) : [],
    missing_data: Array.isArray(missingData) ? [...missingData] : [],
    limitations: Array.isArray(limitations) ? [...limitations] : [],
    calculation_version: calculationVersion ? String(calculationVersion) : null,
    generated_at: normalizeOccurredAt(generatedAt)
  });
}
