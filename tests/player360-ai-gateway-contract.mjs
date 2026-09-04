import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PLAYER360_AI_GATEWAY_CONFIG,
  assertEvidenceAllowedForAi,
  getEvidenceModules,
  normalizeAiInsightContent
} from "../config/player360-ai-gateway.config.js";
import { Player360AiGatewayService } from "../services/player360/Player360AiGatewayService.js";

const edgeSource = fs.readFileSync("supabase/functions/player360-ai-insight/index.ts", "utf8");
const clientSource = fs.readFileSync("services/player360/Player360AiGatewayService.js", "utf8");

assert.equal(PLAYER360_AI_GATEWAY_CONFIG.generationEnabled, false, "deployment gate must remain closed by default");
assert.deepEqual(PLAYER360_AI_GATEWAY_CONFIG.allowedAudiences, ["STAFF"]);

const safeEvidence = {
  evidence_version: "PLAYER360_EVIDENCE_V1",
  calculation_version: "v1",
  facts: [
    { fact_type: "LONGITUDINAL_TREND", metric_key: "training.SESSION_LOAD", direction: "UP" },
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
const result = await enabled.generateInsight({ snapshotId: "s1", audience: "staff", locale: "es" });
assert.equal(result.insightId, "insight-1");
assert.equal(invoked.name, PLAYER360_AI_GATEWAY_CONFIG.edgeFunctionName);
assert.deepEqual(invoked.options.body, { snapshot_id: "s1", audience: "STAFF", locale: "es" });
assert.doesNotMatch(clientSource, /api\.openai\.com|IQB_AI_API_KEY|Bearer\s+\$\{apiKey\}/i);

// Edge boundary: authenticated caller context reads evidence and rechecks the
// existing DB permission immediately before the provider call and persistence.
assert.match(edgeSource, /callerClient\.auth\.getUser\(\)/);
assert.match(edgeSource, /callerClient[\s\S]*?from\("player_longitudinal_snapshots"\)/);
assert.match(edgeSource, /iq_v4_can_generate_ai_insights/);
assert.match(edgeSource, /assertEvidenceAllowedForAi/);
assert.match(edgeSource, /IQB_AI_MONTHLY_LIMITS_JSON/);
assert.match(edgeSource, /AI_QUOTA_NOT_CONFIGURED/);
assert.match(edgeSource, /iq_v4_save_ai_insight/);
assert.match(edgeSource, /Deno\.env\.get\("IQB_AI_API_KEY"\)/);
assert.doesNotMatch(edgeSource, /adminClient\.rpc\([\s\S]*?iq_v4_save_ai_insight/);

console.log("Player 360 AI gateway contract: OK");
