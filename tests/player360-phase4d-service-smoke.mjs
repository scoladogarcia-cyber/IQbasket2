import assert from "node:assert/strict";
import { PLAYER360_LONGITUDINAL_CONFIG } from "../config/player360-analytics.config.js";
import { LongitudinalAnalyticsService } from "../services/player360/LongitudinalAnalyticsService.js";

function queryResult(data = []) {
  const calls = [];
  const query = {
    calls,
    select(...args) { calls.push(["select", ...args]); return query; },
    eq(...args) { calls.push(["eq", ...args]); return query; },
    order(...args) { calls.push(["order", ...args]); return query; },
    limit(...args) { calls.push(["limit", ...args]); return query; },
    then(resolve) { return Promise.resolve({ data, error: null }).then(resolve); }
  };
  return query;
}

const rpcCalls = [];
const tableQueries = new Map();
const client = {
  rpc(name, args) {
    rpcCalls.push({ name, args });
    if (name === "iq_v4_longitudinal_capabilities") {
      return Promise.resolve({ data: { ready: true }, error: null });
    }
    return Promise.resolve({ data: name.includes("review") ? true : "saved-id", error: null });
  },
  from(table) {
    const query = queryResult([{ id: `${table}-id` }]);
    tableQueries.set(table, query);
    return query;
  }
};

const service = new LongitudinalAnalyticsService(client);
assert.deepEqual(await service.getCapabilities(), { ready: true });
assert.deepEqual(await service.getCapabilities(), { ready: true });
assert.equal(rpcCalls.filter(call => call.name === "iq_v4_longitudinal_capabilities").length, 1);

const calculationVersion = PLAYER360_LONGITUDINAL_CONFIG.calculationVersion;
const snapshot = {
  contract_version: PLAYER360_LONGITUDINAL_CONFIG.contractVersion,
  calculation_version: calculationVersion
};
const evidenceBundle = {
  evidence_version: "PLAYER360_EVIDENCE_V1",
  calculation_version: calculationVersion
};

assert.equal(await service.saveSnapshot({
  teamSeasonId: "season-1", playerId: "player-1",
  periodStart: "2026-08-01", periodEnd: "2026-08-31",
  sourceFingerprint: "sha256:test", snapshot, evidenceBundle,
  rejectedObservations: -4
}), "saved-id");
const saveSnapshotCall = rpcCalls.find(call => call.name === "iq_v4_save_longitudinal_snapshot");
assert.equal(saveSnapshotCall.args.p_rejected_observations, 0);
assert.equal(saveSnapshotCall.args.p_contract_version, "PLAYER360_LONGITUDINAL_V1");

await service.listSnapshots({ teamSeasonId: "season-1", playerId: "player-1", limit: 500 });
assert.ok(tableQueries.get("player_longitudinal_snapshots").calls.some(
  call => call[0] === "limit" && call[1] === 200
));
await service.listInsights({ snapshotId: "snapshot-1", audience: "staff", status: "draft" });
const insightCalls = tableQueries.get("player_ai_insights").calls;
assert.ok(insightCalls.some(call => call[0] === "eq" && call[1] === "audience" && call[2] === "STAFF"));
assert.ok(insightCalls.some(call => call[0] === "eq" && call[1] === "status" && call[2] === "DRAFT"));

await service.saveAiInsight({
  snapshotId: "snapshot-1", audience: "player", provider: "provider",
  modelName: "model", promptVersion: "prompt-v1",
  content: { summary: "Interpretación trazable" }
});
assert.equal(rpcCalls.find(call => call.name === "iq_v4_save_ai_insight").args.p_audience, "PLAYER");
assert.equal(await service.reviewAiInsight({ insightId: "insight-1", status: "approved" }), true);
await assert.rejects(
  () => service.reviewAiInsight({ insightId: "insight-1", status: "draft" }),
  /estado de revisión no permitido/
);
await assert.rejects(
  () => service.saveSnapshot({
    teamSeasonId: "season-1", playerId: "player-1",
    periodStart: "2026-08-01", periodEnd: "2026-08-31",
    sourceFingerprint: "sha256:test",
    snapshot: { ...snapshot, calculation_version: "wrong" }, evidenceBundle
  }),
  /versión de cálculo inconsistente/
);

console.log("PLAYER360_PHASE4D_SERVICE_OK");
