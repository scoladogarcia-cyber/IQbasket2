/**
 * Converts authorized IQBasket source records into the provider-agnostic
 * PLAYER360_OBSERVATION_V1 contract.
 *
 * This adapter contains source-shape knowledge. The longitudinal calculator,
 * persistence service and UI remain independent from raw application tables.
 */

import { normalizePlayer360Observation } from "../../domain/player360/contracts.js";
import {
  PLAYER360_LONGITUDINAL_ASSOCIATIONS,
  PLAYER360_LONGITUDINAL_SOURCE_METRICS,
  PLAYER360_TRAINING_FOCUS_ASSOCIATIONS
} from "../../config/player360-analytics.config.js";
import { TRAINING_FOCUS_LABELS } from "../../config/trainingEditV54.config.js";
import {
  PLAYER360_SOURCE_TYPE,
  PLAYER360_SENSITIVITY
} from "../../config/player360.config.js";

function finite(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isoInstant(value, fallbackTime = "12:00:00.000Z") {
  const text = String(value || "").trim();
  if (!text) return null;
  const timestamp = Date.parse(text.length === 10 ? `${text}T${fallbackTime}` : text);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function normalizedSourceType(value, fallback) {
  const candidate = String(value || fallback || "").toUpperCase();
  return Object.values(PLAYER360_SOURCE_TYPE).includes(candidate)
    ? candidate
    : fallback;
}

function addMappedObservations({
  target,
  source,
  sourceId,
  occurredAt,
  playerId,
  teamSeasonId,
  module,
  sourceType,
  sensitivity,
  mappings,
  provenance = {}
}) {
  if (!occurredAt) return;

  (mappings || []).forEach(mapping => {
    const value = finite(source?.[mapping.source_field]);
    if (value === null) return;

    target.push(normalizePlayer360Observation({
      module,
      player_id: playerId,
      team_season_id: teamSeasonId,
      occurred_at: occurredAt,
      source_type: sourceType,
      source_id: sourceId,
      metric_code: mapping.metric_code,
      value,
      unit: mapping.unit,
      quality: 1,
      sensitivity,
      provenance
    }));
  });
}

function uniqueDefinitions(definitions = []) {
  const map = new Map();
  definitions.forEach(definition => {
    const key = `${String(definition.module).toLowerCase()}.${String(definition.metric_code).toUpperCase()}`;
    if (!map.has(key)) map.set(key, definition);
  });
  return [...map.values()];
}

export class Player360ObservationAssembler {
  static assemble({
    playerId,
    teamSeasonId,
    eligibleGames = [],
    playerGameStats = [],
    trainingSessions = [],
    externalSessions = [],
    evaluations = [],
    evaluationMetrics = []
  } = {}) {
    if (!playerId || !teamSeasonId) {
      throw new Error("Player360ObservationAssembler: playerId y teamSeasonId son obligatorios.");
    }

    const observations = [];
    const definitions = [];
    const labels = {};

    Object.entries(PLAYER360_LONGITUDINAL_SOURCE_METRICS).forEach(([module, mappings]) => {
      mappings.forEach(mapping => {
        definitions.push({
          module,
          metric_code: mapping.metric_code,
          unit: mapping.unit,
          aggregation: mapping.aggregation
        });
        labels[`${module}.${mapping.metric_code}`] = mapping.label;
      });
    });

    const gameById = new Map(
      (eligibleGames || [])
        .filter(game => game?.id)
        .map(game => [String(game.id), game])
    );

    (playerGameStats || [])
      .filter(stat => String(stat?.player_id || stat?.playerId || "") === String(playerId))
      .forEach(stat => {
        const gameId = String(stat?.game_id || stat?.gameId || "");
        const game = gameById.get(gameId);
        if (!game) return;

        addMappedObservations({
          target: observations,
          source: stat,
          sourceId: gameId,
          occurredAt: isoInstant(game.date),
          playerId,
          teamSeasonId,
          module: "competition",
          sourceType: PLAYER360_SOURCE_TYPE.GAME_SYSTEM,
          sensitivity: PLAYER360_SENSITIVITY.STANDARD,
          mappings: PLAYER360_LONGITUDINAL_SOURCE_METRICS.competition,
          provenance: { source_table: "player_game_stats", game_id: gameId }
        });
      });

    (trainingSessions || []).forEach(session => {
      const participant = (session?.participants || []).find(row =>
        String(row?.player_id || row?.playerId || "") === String(playerId)
      );
      if (!participant) return;

      const occurredAt = isoInstant(session.session_date);
      addMappedObservations({
        target: observations,
        source: participant,
        sourceId: session.id,
        occurredAt,
        playerId,
        teamSeasonId,
        module: "training",
        sourceType: PLAYER360_SOURCE_TYPE.CLUB_COACH,
        sensitivity: PLAYER360_SENSITIVITY.STANDARD,
        mappings: PLAYER360_LONGITUDINAL_SOURCE_METRICS.training,
        provenance: {
          source_table: "training_participants",
          training_session_id: session.id,
          attendance_status: participant.attendance_status || null
        }
      });

      const participatedMinutes = finite(participant?.participated_minutes);
      const focusCodes = [...new Set(
        (Array.isArray(session?.metadata?.training_focus_codes)
          ? session.metadata.training_focus_codes
          : [])
          .map(code => String(code || "").trim().toUpperCase())
          .filter(Boolean)
      )];

      if (occurredAt && participatedMinutes !== null && participatedMinutes > 0) {
        const sessionMinutes = finite(session?.duration_minutes);
        const allocation = session?.metadata?.training_focus_minutes;
        const allocationObject = allocation && typeof allocation === "object" && !Array.isArray(allocation)
          ? allocation
          : {};
        const participationRatio = sessionMinutes && sessionMinutes > 0
          ? Math.min(1, Math.max(0, participatedMinutes / sessionMinutes))
          : 1;

        focusCodes.forEach(focusCode => {
          const metricCode = `FOCUS_${focusCode}_MINUTES`;
          const explicitFocusMinutes = finite(allocationObject?.[focusCode]);
          const exposureMinutes = explicitFocusMinutes !== null
            ? explicitFocusMinutes * participationRatio
            : participatedMinutes;
          const semantics = explicitFocusMinutes !== null
            ? "PROPORTIONAL_EXPLICIT_FOCUS_DOSE"
            : "PLAYER_MINUTES_IN_SESSION_CONTAINING_FOCUS";

          definitions.push({
            module: "training",
            metric_code: metricCode,
            unit: "MIN",
            aggregation: "SUM"
          });
          labels[`training.${metricCode}`] =
            `Exposición ${TRAINING_FOCUS_LABELS[focusCode] || focusCode}`;

          observations.push(normalizePlayer360Observation({
            module: "training",
            player_id: playerId,
            team_season_id: teamSeasonId,
            occurred_at: occurredAt,
            source_type: PLAYER360_SOURCE_TYPE.CLUB_COACH,
            source_id: session.id,
            metric_code: metricCode,
            value: exposureMinutes,
            unit: "MIN",
            quality: explicitFocusMinutes !== null ? 1 : 0.75,
            sensitivity: PLAYER360_SENSITIVITY.STANDARD,
            provenance: {
              source_table: "training_sessions",
              training_session_id: session.id,
              focus_code: focusCode,
              semantics,
              explicit_focus_minutes: explicitFocusMinutes,
              participation_ratio: participationRatio
            }
          }));
        });
      }
    });

    (externalSessions || [])
      .filter(row => String(row?.player_id || row?.playerId || "") === String(playerId))
      .forEach(row => {
        addMappedObservations({
          target: observations,
          source: row,
          sourceId: row.id,
          occurredAt: isoInstant(row.activity_date),
          playerId,
          teamSeasonId,
          module: "external_development",
          sourceType: normalizedSourceType(row.source_type, PLAYER360_SOURCE_TYPE.EXTERNAL_COACH),
          sensitivity: PLAYER360_SENSITIVITY.PRIVATE_SPORTING,
          mappings: PLAYER360_LONGITUDINAL_SOURCE_METRICS.external_development,
          provenance: {
            source_table: "external_development_sessions",
            provider_type: row.provider_type || null
          }
        });
      });

    const metricCatalog = new Map(
      (evaluationMetrics || []).map(metric => [
        String(metric?.code || metric?.metric_code || "").toUpperCase(),
        metric
      ])
    );

    (evaluations || []).forEach(evaluation => {
      const occurredAt = isoInstant(evaluation.evaluation_date);
      if (!occurredAt) return;

      (evaluation.scores || []).forEach(score => {
        const metricCode = String(score?.metric_code || score?.code || "").toUpperCase();
        const value = finite(score?.score);
        if (!metricCode || value === null) return;

        const catalogMetric = metricCatalog.get(metricCode);
        definitions.push({
          module: "evaluation",
          metric_code: metricCode,
          unit: "SCORE_0_10",
          aggregation: "LAST"
        });
        labels[`evaluation.${metricCode}`] =
          catalogMetric?.name || score.metric_name || metricCode;

        observations.push(normalizePlayer360Observation({
          module: "evaluation",
          player_id: playerId,
          team_season_id: teamSeasonId,
          occurred_at: occurredAt,
          source_type: normalizedSourceType(
            evaluation.source_type,
            PLAYER360_SOURCE_TYPE.CLUB_COACH
          ),
          source_id: evaluation.id,
          metric_code: metricCode,
          value,
          unit: "SCORE_0_10",
          quality: 1,
          sensitivity: String(
            catalogMetric?.sensitivity
            || PLAYER360_SENSITIVITY.PRIVATE_SPORTING
          ).toUpperCase(),
          provenance: {
            source_table: "player_evaluation_scores",
            evaluation_id: evaluation.id,
            domain_code: score.domain_code || catalogMetric?.domain_code || null
          }
        }));
      });
    });

    const metricDefinitions = uniqueDefinitions(definitions);
    const definitionKeys = new Set(metricDefinitions.map(
      definition => `${definition.module}.${definition.metric_code}`
    ));
    const configuredAssociations = PLAYER360_LONGITUDINAL_ASSOCIATIONS
      .filter(definition =>
        definitionKeys.has(definition.left)
        && definitionKeys.has(definition.right)
      )
      .map(({ left, right, lag_buckets }) => ({ left, right, lag_buckets }));

    const focusMetricKeys = metricDefinitions
      .filter(definition => definition.module === "training" && String(definition.metric_code || "").startsWith("FOCUS_"))
      .map(definition => `${definition.module}.${definition.metric_code}`);
    const focusAssociations = [];
    focusMetricKeys.forEach(left => {
      PLAYER360_TRAINING_FOCUS_ASSOCIATIONS.outcomes.forEach(right => {
        if (!definitionKeys.has(right)) return;
        PLAYER360_TRAINING_FOCUS_ASSOCIATIONS.lags.forEach(lag_buckets => {
          focusAssociations.push({ left, right, lag_buckets });
        });
      });
    });

    const associationDefinitions = [...configuredAssociations, ...focusAssociations];

    return Object.freeze({
      observations: Object.freeze(observations),
      metricDefinitions: Object.freeze(metricDefinitions),
      metricLabels: Object.freeze({ ...labels }),
      associationDefinitions: Object.freeze(associationDefinitions)
    });
  }
}

export default Player360ObservationAssembler;
