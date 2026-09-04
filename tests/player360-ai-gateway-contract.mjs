import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PLAYER360_AI_GATEWAY_CONFIG,
  assertEvidenceAllowedForAi,
  getEvidenceModules,
  sanitizeEvidenceForAiProvider,
  normalizeAiInsightContent
} from "../config/player360-ai-gateway.config.js";
import { Player360AiGatewayService } from "../services/player360/Player360AiGatewayService.js";

const edgeSource = fs.readFileSync("supabase/functions/player360-ai-insight/index.ts", "utf8");
const clientSource = fs.readFileSync("services/player360/Player360AiGatewayService.js", "utf8");
const player360ViewSource = fs.readFileSync("views/Player360View.js", "utf8");
const panelSource = fs.readFileSync("views/player360/LongitudinalAnalyticsPanel.js", "utf8");

assert.equal(PLAYER360_AI_GATEWAY_CONFIG.generationEnabled, false, "deployment gate must remain closed by default");
assert.deepEqual(PLAYER360_AI_GATEWAY_CONFIG.allowedAudiences, ["STAFF"]);

const safeEvidence = {
  evidence_version: "PLAYER360_EVIDENCE_V1",
  calculation_version: "v1",
  player_id: "player-secret-id",
  team_season_id: "team-season-secret-id",
  generated_at: "2026-09-04T00:00:00Z",
  facts: [
    {
      fact_type: "LONGITUDINAL_TREND",
      metric_key: "training.SESSION_LOAD",
      direction: "UP",
      source_id: "must-not-leave-iqbasket"
    },
    { fact_type: "LONGITUDINAL_TREND", metric_key: "competition.EVALUATION", direction: "STABLE" },
    {
      fact_type: "DESCRIPTIVE_ASSOCIATION",
      left_metric_key: "training.SESSION_LOAD",
      right_metric_key: "competition.EVALUATION",
      causal_claim_allowed: false
    }
  ],
  missing_data: [],
  limitations: ["No causalidad"]
};
assert.deepEqual(getEvidenceModules(safeEvidence), ["competition", "training"]);
assert.deepEqual(assertEvidenceAllowedForAi(safeEvidence).modules, ["competition", "training"]);

const providerEvidence = sanitizeEvidenceForAiProvider(safeEvidence);
assert.equal(providerEvidence.evidence_version, "PLAYER360_EVIDENCE_V1");
assert.equal(providerEvidence.calculation_version, "v1");
assert.equal("player_id" in providerEvidence, false, "provider payload must remove player id");
assert.equal("team_season_id" in providerEvidence, false, "provider payload must remove team-season id");
assert.equal("generated_at" in providerEvidence, false, "provider payload must remove timestamps not needed for interpretation");
assert.equal("source_id" in providerEvidence.facts[0], false, "provider fact allowlist must remove source ids");
assert.deepEqual(providerEvidence.facts[0], {
  fact_type: "LONGITUDINAL_TREND",
  metric_key: "training.SESSION_LOAD",
  direction: "UP"
});

assert.throws(() => assertEvidenceAllowedForAi({
  ...safeEvidence,
  facts: [{ metric_key: "nutrition.DAILY_ENERGY" }]
}), /AI_RESTRICTED_EVIDENCE_REQUIRES_ABAC/);

// Even an unavailable restricted metric must not silently enter the generic
// sport-only gateway; restricted AI processing gets its own ABAC phase.
assert.throws(() => assertEvidenceAllowedForAi({
  ...safeEvidence,
  facts: [],
  missing_data: [{ metric_key: "recovery.READINESS", reason: "NO_DATA" }]
}), /AI_RESTRICTED_EVIDENCE_REQUIRES_ABAC/);

assert.throws(() => assertEvidenceAllowedForAi({
  ...safeEvidence,
  facts: [{ metric_key: "unknown.SCORE" }]
}), /AI_EVIDENCE_MODULE_UNSUPPORTED/);

const normalized = normalizeAiInsightContent({
  summary: " Resumen trazable ",
  interpretation: "Interpretación no causal",
  priorities: ["P1", "P2"],
  recommendations: ["R1"],
  action_plan: ["A1"],
  evidence_refs: ["training.SESSION_LOAD"],
  limitations: ["Muestra limitada"],
  injected: "must disappear"
});
assert.equal(normalized.summary, "Resumen trazable");
assert.equal("injected" in normalized, false);

let invoked = null;
const mockClient = {
  functions: {
    async invoke(name, options) {
      invoked = { name, options };
      return {
        data: {
          success: true,
          insight_id: "insight-1",
          status: "DRAFT",
          provider: "PROVIDER",
          model_name: "MODEL",
          prompt_version: "PROMPT",
          usage: { used: 1, limit: 10 }
        },
        error: null
      };
    }
  }
};

const disabled = new Player360AiGatewayService(mockClient);
await assert.rejects(() => disabled.generateInsight({ snapshotId: "s1" }), /AI_GATEWAY_NOT_ENABLED/);
assert.equal(invoked, null);

const enabled = new Player360AiGatewayService(mockClient, { generationEnabled: true });
const result = await enabled.generateInsight({
  snapshotId: "s1",
  audience: "staff",
  locale: "es",
  idempotencyKey: "11111111-1111-4111-8111-111111111111"
});
assert.equal(result.insightId, "insight-1");
assert.equal(result.idempotencyKey, "11111111-1111-4111-8111-111111111111");
assert.equal(invoked.name, PLAYER360_AI_GATEWAY_CONFIG.edgeFunctionName);
assert.deepEqual(invoked.options.body, {
  snapshot_id: "s1",
  idempotency_key: "11111111-1111-4111-8111-111111111111",
  audience: "STAFF",
  locale: "es"
});
assert.doesNotMatch(clientSource, /api\.openai\.com|IQB_AI_API_KEY|Bearer\s+\$\{apiKey\}/i);

// Edge boundary: authenticated caller context reads evidence and rechecks the
// existing DB permission immediately before the provider call and persistence.
assert.match(edgeSource, /callerClient\.auth\.getUser\(\)/);
assert.match(edgeSource, /callerClient[\s\S]*?from\("player_longitudinal_snapshots"\)/);
assert.match(edgeSource, /iq_v4_can_generate_ai_insights/);
assert.match(edgeSource, /sanitizeEvidenceForAiProvider/);
assert.match(edgeSource, /IQB_AI_GENERATION_ENABLED/);
assert.match(edgeSource, /AI_GATEWAY_NOT_ENABLED/);
assert.match(edgeSource, /PLAYER360_AI_GATEWAY_CONFIG\.generationEnabled === true/);
assert.match(edgeSource, /!environmentGenerationEnabled \|\| !configurationGenerationEnabled/);
const serverGateIndex = edgeSource.indexOf('Deno.env.get("IQB_AI_GENERATION_ENABLED")');
const providerRuntimeIndex = edgeSource.indexOf('providerRuntime = resolveProviderRuntimeConfig()');
const usageReservationIndex = edgeSource.indexOf('"iq_ai_reserve_usage"');
assert.ok(serverGateIndex >= 0 && providerRuntimeIndex > serverGateIndex);
assert.ok(usageReservationIndex > providerRuntimeIndex);
assert.match(edgeSource, /idempotency_key/);
assert.match(edgeSource, /IQB_AI_MONTHLY_LIMITS_JSON/);
assert.match(edgeSource, /AI_QUOTA_NOT_CONFIGURED/);
assert.match(edgeSource, /iq_ai_reserve_usage/);
assert.match(edgeSource, /iq_ai_mark_provider_started/);
assert.match(edgeSource, /iq_ai_complete_usage/);
assert.match(edgeSource, /iq_ai_fail_usage/);
assert.match(edgeSource, /iq_v4_save_ai_insight/);
assert.doesNotMatch(edgeSource, /from\("player_ai_insights"\)[\s\S]{0,250}count:\s*"exact"/);
assert.match(edgeSource, /Deno\.env\.get\("IQB_AI_API_KEY"\)/);
assert.doesNotMatch(edgeSource, /adminClient\.rpc\(\s*["']iq_v4_save_ai_insight["']/);

// Provider hardening: stateless Responses API call, bounded output/timeout,
// HTTPS endpoint allowlist and explicit incomplete/refusal handling.
assert.match(edgeSource, /store:\s*false/);
assert.match(edgeSource, /max_output_tokens:\s*maxOutputTokens/);
assert.match(edgeSource, /IQB_AI_TIMEOUT_MS/);
assert.match(edgeSource, /IQB_AI_MAX_OUTPUT_TOKENS/);
assert.match(edgeSource, /url\.protocol\s*!==\s*"https:"/);
assert.match(edgeSource, /AI_PROVIDER_ENDPOINT_NOT_ALLOWED/);
assert.match(edgeSource, /AI_PROVIDER_OUTPUT_INCOMPLETE/);
assert.match(edgeSource, /AI_PROVIDER_REFUSED/);
assert.match(edgeSource, /type\s*===\s*"refusal"/);
assert.match(edgeSource, /resolveProviderRuntimeConfig\(\)/);
assert.match(edgeSource, /usage_ledger_id/);
assert.match(edgeSource, /AI_USAGE_FINALIZE_FAILED/);

// UI integration: Player360 owns the gateway dependency, the panel checks the
// granular generate permission, and the button can exist only behind the
// double deployment gate. The feature remains incapable of paid calls in Gate A.
assert.match(player360ViewSource, /new Player360AiGatewayService\(this\.supabase\)/);
assert.match(player360ViewSource, /aiGatewayService:\s*this\.aiGatewayService/);
assert.match(panelSource, /Permission\.GENERATE_AI_INSIGHTS/);
assert.match(panelSource, /PLAYER360_AI_UI_CONFIG\.generationEnabled[\s\S]*aiGatewayService\?\.isEnabled/);
assert.match(panelSource, /id="p360d-generate-ai"/);
assert.match(panelSource, /aiGatewayService\.generateInsight\(\{/);
assert.match(panelSource, /audience:\s*"STAFF"/);
assert.doesNotMatch(panelSource, /api\.openai\.com|IQB_AI_API_KEY|Authorization:\s*`Bearer/i);

console.log("Player 360 AI gateway contract: OK");
