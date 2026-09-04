import assert from "node:assert/strict";
import fs from "node:fs";

const edge = fs.readFileSync(
  "supabase/functions/player360-ai-insight/index.ts",
  "utf8"
);
const workflow = fs.readFileSync(
  ".github/workflows/player360-ai-edge-deploy-controlled.yml",
  "utf8"
);

const gateIndex = edge.indexOf("IQB_AI_GENERATION_ENABLED");
const providerIndex = edge.indexOf("providerRuntime = resolveProviderRuntimeConfig()");
const reserveIndex = edge.indexOf('"iq_ai_reserve_usage"');
assert.ok(gateIndex >= 0, "server-side generation gate must exist");
assert.match(edge, /PLAYER360_AI_GATEWAY_CONFIG\.generationEnabled === true/);
assert.match(edge, /!environmentGenerationEnabled \|\| !configurationGenerationEnabled/);
assert.ok(providerIndex > gateIndex, "provider config must be after server gate");
assert.ok(reserveIndex > providerIndex, "quota reservation must be after provider validation");

assert.match(workflow, /SUPABASE_ACCESS_TOKEN:\s*\$\{\{ secrets\.SUPABASE_ACCESS_TOKEN \}\}/);
assert.match(workflow, /IQB_AI_GENERATION_ENABLED=false/);
assert.match(workflow, /functions deploy player360-ai-insight/);
assert.match(workflow, /--use-api/);
assert.doesNotMatch(workflow, /--no-verify-jwt/);
assert.doesNotMatch(workflow, /IQB_AI_API_KEY=/);
assert.doesNotMatch(workflow, /IQB_AI_MODEL=/);

