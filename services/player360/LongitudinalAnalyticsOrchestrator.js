/**
 * Application orchestration for deterministic Player 360 longitudinal analytics.
 *
 * Responsibilities:
 * - load authorized source records from existing services/DataStore;
 * - preserve roster-stint eligibility;
 * - normalize records through Player360ObservationAssembler;
 * - calculate deterministic longitudinal evidence;
 * - persist immutable snapshots through LongitudinalAnalyticsService.
 *
 * It never calls an AI provider and never puts provider secrets in the browser.
 */

import { PLAYER360_CONFIG } from "../../config/player360.config.js";
import { PLAYER360_LONGITUDINAL_CONFIG } from "../../config/player360-analytics.config.js";
import { LongitudinalAnalyticsCalculator } from "../../domain/player360/LongitudinalAnalyticsCalculator.js";
import { LongitudinalEvidenceAssembler } from "../../domain/player360/LongitudinalEvidenceAssembler.js";
import { Player360ObservationAssembler } from "./Player360ObservationAssembler.js";

function isoDay(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const timestamp = Date.parse(text.length === 10 ? `${text}T00:00:00.000Z` : text);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString().slice(0, 10);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") {
    throw new Error("LongitudinalAnalyticsOrchestrator: Web Crypto no disponible.");
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function temporalCoverage(snapshot) {
  const series = Array.isArray(snapshot?.series) ? snapshot.series : [];
  if (!series.length) {
    return {
      status: "NO_DATA",
      coverage_pct: 0,
      series_total: 0,
      series_with_data: 0
    };
  }

  const coveragePct = Math.round(
    (series.reduce((sum, item) => sum + (Number(item?.coverage?.coverage_pct) || 0), 0)
      / series.length) * 100
  ) / 100;
  const thresholds = PLAYER360_CONFIG.coverage.thresholds;
  const status = coveragePct <= thresholds.NONE_MAX
    ? "NO_DATA"
    : coveragePct <= thresholds.LOW_MAX
      ? "LOW"
      : coveragePct <= thresholds.PARTIAL_MAX
        ? "PARTIAL"
        : coveragePct <= thresholds.GOOD_MAX
          ? "GOOD"
          : "COMPLETE";

  return {
    status,
    coverage_pct: coveragePct,
    series_total: series.length,
    series_with_data: series.filter(item => (item?.points || []).length > 0).length
  };
}

function observationSortKey(item = {}) {
  return [
    item.module,
    item.metric_code,
    item.occurred_at,
    item.source_type,
    item.source_id,
    String(item.value)
  ].join("|");
}

function definitionSortKey(item = {}) {
  return [item.module, item.metric_code, item.aggregation, item.unit].join("|");
}

export class LongitudinalAnalyticsOrchestrator {
  constructor({
    dataStore,
    trainingService,
    evaluationService,
    analyticsService
  } = {}) {
    this.dataStore = dataStore;
    this.trainingService = trainingService;
    this.evaluationService = evaluationService;
    this.analyticsService = analyticsService;
  }

  _assertDependencies() {
    if (!this.dataStore || !this.trainingService || !this.evaluationService || !this.analyticsService) {
      throw new Error("LongitudinalAnalyticsOrchestrator: dependencias incompletas.");
    }
  }

  _eligibilityPeriods(teamId, playerId) {
    const participant = (this.dataStore.getSeasonParticipantPlayers?.(teamId) || [])
      .find(player => String(player?.id || "") === String(playerId));

    return (participant?.roster_stints || participant?.rosterStints || [])
      .map(stint => ({
        from: isoDay(stint?.valid_from || stint?.validFrom),
        to: isoDay(stint?.valid_until || stint?.validUntil)
      }))
      .filter(period => period.from);
  }

  async loadSourceBundle({
    teamId,
    teamSeasonId,
    playerId,
    periodStart,
    periodEnd
  } = {}) {
    this._assertDependencies();
    if (!teamId || !teamSeasonId || !playerId || !periodStart || !periodEnd) {
      throw new Error("LongitudinalAnalyticsOrchestrator: contexto y periodo son obligatorios.");
    }

    const eligibleGames = this.dataStore.getEligibleGamesForPlayer?.(playerId, teamId) || [];
    const eligibleGameIds = new Set(eligibleGames.map(game => String(game.id)));
    const playerGameStats = (this.dataStore.getPlayerGameStats?.(playerId) || [])
      .filter(stat => eligibleGameIds.has(String(stat?.game_id || stat?.gameId || "")));

    const [trainingSessions, externalSessions, evaluations, evaluationMetrics] = await Promise.all([
      this.trainingService.listSessions({
        teamSeasonId,
        fromDate: periodStart,
        toDate: periodEnd,
        includeArchived: false,
        limit: 500
      }),
      this.trainingService.listExternalDevelopment({
        teamSeasonId,
        playerId,
        fromDate: periodStart,
        toDate: periodEnd,
        limit: 500
      }),
      this.evaluationService.listEvaluations({
        teamSeasonId,
        playerId,
        includeHistory: false,
        includeArchived: false,
        limit: 500
      }),
      this.evaluationService.listMetrics({ teamSeasonId })
    ]);

    return {
      eligibleGames,
      playerGameStats,
      trainingSessions,
      externalSessions,
      evaluations,
      evaluationMetrics,
      eligibilityPeriods: this._eligibilityPeriods(teamId, playerId)
    };
  }

  async buildSnapshotCandidate({
    teamId,
    teamSeasonId,
    playerId,
    periodStart,
    periodEnd
  } = {}) {
    const sourceBundle = await this.loadSourceBundle({
      teamId,
      teamSeasonId,
      playerId,
      periodStart,
      periodEnd
    });

    const assembled = Player360ObservationAssembler.assemble({
      playerId,
      teamSeasonId,
      eligibleGames: sourceBundle.eligibleGames,
      playerGameStats: sourceBundle.playerGameStats,
      trainingSessions: sourceBundle.trainingSessions,
      externalSessions: sourceBundle.externalSessions,
      evaluations: sourceBundle.evaluations,
      evaluationMetrics: sourceBundle.evaluationMetrics
    });

    if (!assembled.observations.length) {
      throw new Error("No hay observaciones Player 360 disponibles para el periodo seleccionado.");
    }

    const observations = [...assembled.observations]
      .sort((left, right) => observationSortKey(left).localeCompare(observationSortKey(right)));
    const metricDefinitions = [...assembled.metricDefinitions]
      .sort((left, right) => definitionSortKey(left).localeCompare(definitionSortKey(right)));
    const associationDefinitions = [...assembled.associationDefinitions]
      .sort((left, right) =>
        `${left.left}|${left.right}|${left.lag_buckets}`
          .localeCompare(`${right.left}|${right.right}|${right.lag_buckets}`)
      );

    const snapshot = LongitudinalAnalyticsCalculator.calculate({
      playerId,
      teamSeasonId,
      period: { from: periodStart, to: periodEnd },
      observations,
      metricDefinitions,
      associationDefinitions,
      eligibilityPeriods: sourceBundle.eligibilityPeriods
    });
    const coverage = temporalCoverage(snapshot);
    const evidenceBundle = LongitudinalEvidenceAssembler.build({
      snapshot,
      coverage
    });

    const fingerprintPayload = canonicalize({
      contract_version: snapshot.contract_version,
      calculation_version: snapshot.calculation_version,
      player_id: playerId,
      team_season_id: teamSeasonId,
      period: snapshot.period,
      eligibility_periods: snapshot.eligibility_periods,
      observations,
      metric_definitions: metricDefinitions,
      association_definitions: associationDefinitions
    });
    const sourceFingerprint = `sha256:${await sha256Hex(JSON.stringify(fingerprintPayload))}`;

    return Object.freeze({
      snapshot,
      evidenceBundle,
      sourceFingerprint,
      metricLabels: assembled.metricLabels,
      sourceCounts: Object.freeze({
        competition_games: sourceBundle.eligibleGames.length,
        competition_stat_rows: sourceBundle.playerGameStats.length,
        training_sessions: sourceBundle.trainingSessions.length,
        external_sessions: sourceBundle.externalSessions.length,
        evaluations: sourceBundle.evaluations.length,
        observations: observations.length
      })
    });
  }

  async generateAndSaveSnapshot(context = {}) {
    const candidate = await this.buildSnapshotCandidate(context);
    const snapshotId = await this.analyticsService.saveSnapshot({
      teamSeasonId: context.teamSeasonId,
      playerId: context.playerId,
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
      calculationVersion: PLAYER360_LONGITUDINAL_CONFIG.calculationVersion,
      sourceRevision: null,
      sourceFingerprint: candidate.sourceFingerprint,
      snapshot: candidate.snapshot,
      evidenceBundle: candidate.evidenceBundle,
      rejectedObservations: candidate.snapshot.rejected_observations
    });

    return Object.freeze({
      ...candidate,
      snapshotId
    });
  }
}

export default LongitudinalAnalyticsOrchestrator;
