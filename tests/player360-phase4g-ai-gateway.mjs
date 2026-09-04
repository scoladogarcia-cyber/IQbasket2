import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PLAYER360_AI_COST_CLASS,
  PLAYER360_AI_PROVIDER,
  PLAYER360_AI_GATEWAY_CONFIG
} from "../config/player360-ai.config.js";
import { AiInsightGatewayService } from "../services/player360/AiInsightGatewayService.js";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

assert.equal(PLAYER360_AI_GATEWAY_CONFIG.freeOnly, true);
assert.deepEqual(PLAYER360_AI_GATEWAY_CONFIG.allowedCostClasses, [PLAYER360_AI_COST_CLASS.FREE]);
assert.deepEqual(
  PLAYER360_AI_GATEWAY_CONFIG.allowedProviders,
  [PLAYER360_AI_PROVIDER.LOCAL_OPENAI_COMPATIBLE]
);
assert.equal(PLAYER360_AI_GATEWAY_CONFIG.edgeFunctionName, "player360-ai-insight");

const calls = [];
const client = {
  functions: {
    async invoke(name, options) {
      calls.push({ name, options });
      if (options.body.action === "capabilities") {
        return {
          data: {
            available: true,
            free_only: true,
            provider: "LOCAL_OPENAI_COMPATIBLE",
            model_name: "local-test-model",
            prompt_version: "PLAYER360_STAFF_ES_V2"
          },
          error: null
        };
      }
      return {
        data: {
          success: true,
          insight_id: "insight-1",
          request_id: "request-1",
          status: "DRAFT",
          provider: "LOCAL_OPENAI_COMPATIBLE",
          model_name: "local-test-model",
          prompt_version: "PLAYER360_STAFF_ES_V2",
          free_only: true,
          estimated_cost_eur_micros: 0
        },
        error: null
      };
    }
  }
};

const service = new AiInsightGatewayService(client);
const capabilities = await service.getCapabilities();
assert.equal(capabilities.available, true);
assert.equal(capabilities.freeOnly, true);

const generated = await service.generateInsight({
  snapshotId: "snapshot-1",
  audience: "staff",
  locale: "es",
  purpose: "sport_performance"
});
assert.equal(generated.insightId, "insight-1");
assert.equal(generated.status, "DRAFT");
assert.equal(generated.freeOnly, true);
assert.equal(generated.estimatedCostEurMicros, 0);
assert.equal(calls[1].name, "player360-ai-insight");
assert.equal(calls[1].options.body.audience, "STAFF");
assert.equal(calls[1].options.body.purpose, "SPORT_PERFORMANCE");

const edge = read("supabase/functions/player360-ai-insight/index.ts");
assert.match(edge, /ALLOWED_PROVIDER\s*=\s*"LOCAL_OPENAI_COMPATIBLE"/);
assert.match(edge, /ALLOWED_COST_CLASS\s*=\s*"FREE"/);
assert.match(edge, /PAID_AI_BLOCKED/);
assert.match(edge, /AI_BASE_URL_MUST_USE_HTTPS/);
assert.match(edge, /iq_v4_can_generate_ai_insights/);
assert.match(edge, /iq_v4e_can_access_sensitive_resource/);
assert.match(edge, /AI_PROCESS/);
assert.match(edge, /minimizeEvidence/);
assert.match(edge, /PLAYER360_AI_SENSITIVE_PROCESSING_DENIED/);
assert.match(edge, /estimated_cost_eur_micros:\s*0/);
assert.doesNotMatch(edge, /OPENAI_API_KEY/);

const apply = read("supabase/ready/20260904_apply_v4_phase4g_ai_gateway_free.sql");
assert.match(apply, /create table public\.player_ai_gateway_requests/i);
assert.match(apply, /create table public\.ai_gateway_role_limits/i);
assert.match(apply, /estimated_cost_eur_micros\s*=\s*0/i);
assert.match(apply, /provider\s*=\s*'LOCAL_OPENAI_COMPATIBLE'/i);
assert.match(apply, /iq_v4e_can_access_sensitive_resource/i);
assert.match(apply, /'AI_PROCESS'/i);
assert.match(apply, /revoke execute on function public\.iq_v4_save_ai_insight/i);
assert.match(apply, /grant execute on function public\.iq_v4g_complete_ai_gateway_request[\s\S]*to service_role/i);
assert.doesNotMatch(apply, /grant execute on function public\.iq_v4g_complete_ai_gateway_request[\s\S]*to authenticated/i);

const rollback = read("supabase/ready/20260904_rollback_v4_phase4g_ai_gateway_free.sql");
assert.match(rollback, /grant execute on function public\.iq_v4_save_ai_insight[\s\S]*to authenticated/i);
assert.match(rollback, /drop table if exists public\.player_ai_gateway_requests/i);

console.log("✅ Phase 4G FREE_ONLY AI gateway contract passed");
