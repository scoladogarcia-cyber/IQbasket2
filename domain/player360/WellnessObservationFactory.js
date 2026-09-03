/**
 * Builds validated WELLNESS_RESTRICTED observations from catalog metrics.
 *
 * The resulting object uses the common PLAYER360_OBSERVATION_V1 contract so
 * longitudinal analytics remains source-agnostic.
 */

import {
  PLAYER360_WELLNESS_CONFIG,
  WELLNESS_VALUE_TYPE
} from "../../config/player360-wellness.config.js";
import { normalizePlayer360Observation } from "./contracts.js";

function requiredText(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`WellnessObservationFactory: ${label} es obligatorio.`);
  return normalized;
}

function finite(value, label) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") {
    throw new Error(`WellnessObservationFactory: ${label} debe ser numérico.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`WellnessObservationFactory: ${label} debe ser numérico.`);
  }
  return number;
}

function normalizeMetric(metric = {}) {
  const moduleCode = requiredText(metric.module, "metric.module").toLowerCase();
  const code = requiredText(metric.code ?? metric.metric_code, "metric.code").toUpperCase();
  const valueType = requiredText(metric.value_type, "metric.value_type").toUpperCase();

  if (!PLAYER360_WELLNESS_CONFIG.supportedModules.includes(moduleCode)) {
    throw new Error(`WellnessObservationFactory: módulo no soportado (${moduleCode}).`);
  }
  if (!PLAYER360_WELLNESS_CONFIG.supportedValueTypes.includes(valueType)) {
    throw new Error(`WellnessObservationFactory: tipo no soportado (${valueType}).`);
  }
  if (String(metric.sensitivity || "WELLNESS_RESTRICTED").toUpperCase() !== "WELLNESS_RESTRICTED") {
    throw new Error("WellnessObservationFactory: una métrica wellness debe ser WELLNESS_RESTRICTED.");
  }

  return {
    ...metric,
    module: moduleCode,
    code,
    value_type: valueType,
    sensitivity: "WELLNESS_RESTRICTED"
  };
}

function validateValue(metric, value) {
  if (metric.value_type === WELLNESS_VALUE_TYPE.BOOLEAN) {
    if (typeof value !== "boolean") {
      throw new Error(`WellnessObservationFactory: ${metric.code} debe ser booleano.`);
    }
    return value;
  }

  if (
    metric.value_type === WELLNESS_VALUE_TYPE.NUMBER
    || metric.value_type === WELLNESS_VALUE_TYPE.SCALE
  ) {
    const number = finite(value, metric.code);
    const min = metric.min_value === null || metric.min_value === undefined
      ? null
      : Number(metric.min_value);
    const max = metric.max_value === null || metric.max_value === undefined
      ? null
      : Number(metric.max_value);

    if (Number.isFinite(min) && number < min) {
      throw new Error(`WellnessObservationFactory: ${metric.code} está por debajo del mínimo.`);
    }
    if (Number.isFinite(max) && number > max) {
      throw new Error(`WellnessObservationFactory: ${metric.code} supera el máximo.`);
    }
    return number;
  }

  if (metric.value_type === WELLNESS_VALUE_TYPE.CHOICE) {
    const code = requiredText(value, metric.code).toUpperCase();
    const options = (Array.isArray(metric.options) ? metric.options : [])
      .map(option => String(option).trim().toUpperCase())
      .filter(Boolean);
    if (!options.length || !options.includes(code)) {
      throw new Error(`WellnessObservationFactory: opción no válida para ${metric.code}.`);
    }
    return code;
  }

  throw new Error(`WellnessObservationFactory: tipo no soportado (${metric.value_type}).`);
}

export class WellnessObservationFactory {
  static create({
    metric,
    playerId,
    teamSeasonId,
    occurredAt,
    sourceType,
    sourceId = null,
    value,
    quality = 1,
    capturedBy = null,
    provenance = {},
    metadata = {}
  } = {}) {
    const normalizedMetric = normalizeMetric(metric);
    const normalizedValue = validateValue(normalizedMetric, value);

    return normalizePlayer360Observation({
      module: normalizedMetric.module,
      player_id: playerId,
      team_season_id: teamSeasonId,
      occurred_at: occurredAt,
      source_type: sourceType,
      source_id: sourceId,
      metric_code: normalizedMetric.code,
      value: normalizedValue,
      unit: normalizedMetric.unit || null,
      quality,
      sensitivity: "WELLNESS_RESTRICTED",
      captured_by: capturedBy,
      provenance: {
        catalog_contract: PLAYER360_WELLNESS_CONFIG.contractVersion,
        value_type: normalizedMetric.value_type,
        ...provenance
      },
      metadata
    });
  }
}

export default WellnessObservationFactory;
