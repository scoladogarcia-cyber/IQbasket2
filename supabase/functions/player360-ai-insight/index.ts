import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PLAYER360_AI_GATEWAY_CONFIG,
  PLAYER360_AI_OUTPUT_JSON_SCHEMA,
  sanitizeEvidenceForAiProvider,
  normalizeAiInsightContent
} from "../../../config/player360-ai-gateway.config.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const ALLOWED_LOCALES = new Set(["es", "ca", "en", "fr"]);
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";

type JsonRecord = Record<string, unknown>;

type ProviderResult = {
  provider: string;
  modelName: string;
  providerRequestId: string | null;
  content: JsonRecord;
  usage: { input_tokens: number | null; output_tokens: number | null };
};

type ProviderRuntimeConfig = {
  provider: "OPENAI";
  apiKey: string;
  modelName: string;
  endpoint: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function safeUpper(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function safeLocale(value: unknown) {
  const locale = String(value || "es").trim().toLowerCase();
  return ALLOWED_LOCALES.has(locale) ? locale : "es";
}

function boundedEnvNumber(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(Deno.env.get(name));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function parseQuotaMap(raw: string | undefined) {
  if (!raw) return {} as Record<string, number>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([role, limit]) => [safeUpper(role), Math.max(0, Number(limit) || 0)])
    );
  } catch {
    return {} as Record<string, number>;
  }
}

function resolveQuotaRole(profile: JsonRecord | null) {
  const globalRole = safeUpper(profile?.global_role);
  const appRole = safeUpper(profile?.role);
  if (globalRole === "SUPERADMIN" || globalRole === "ADMIN") return globalRole;
  return appRole || "INVITADO";
}

function resolveOpenAiEndpoint() {
  const configured = Deno.env.get("IQB_AI_ENDPOINT") || DEFAULT_OPENAI_ENDPOINT;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("AI_PROVIDER_ENDPOINT_INVALID");
  }
  if (url.protocol !== "https:") throw new Error("AI_PROVIDER_ENDPOINT_INVALID");

  const customAllowed = String(Deno.env.get("IQB_AI_ALLOW_CUSTOM_ENDPOINT") || "")
    .trim().toLowerCase() === "true";
  if (!customAllowed && url.origin !== "https://api.openai.com") {
    throw new Error("AI_PROVIDER_ENDPOINT_NOT_ALLOWED");
  }
  return url.toString();
}

function resolveProviderRuntimeConfig(): ProviderRuntimeConfig {
  const provider = safeUpper(Deno.env.get("IQB_AI_PROVIDER"));
  if (provider !== "OPENAI") throw new Error("AI_PROVIDER_NOT_CONFIGURED");

  const apiKey = Deno.env.get("IQB_AI_API_KEY") || "";
  const modelName = Deno.env.get("IQB_AI_MODEL") || "";
  if (!apiKey || !modelName) throw new Error("AI_PROVIDER_NOT_CONFIGURED");

  return {
    provider: "OPENAI",
    apiKey,
    modelName,
    endpoint: resolveOpenAiEndpoint(),
    timeoutMs: boundedEnvNumber("IQB_AI_TIMEOUT_MS", 45000, 5000, 90000),
    maxOutputTokens: boundedEnvNumber("IQB_AI_MAX_OUTPUT_TOKENS", 1800, 256, 4000)
  };
}

function buildSystemPrompt(locale: string) {
  return [
    "Eres el motor de interpretación deportiva de IQBasket.",
    `Responde en idioma ${locale}.`,
    "Usa exclusivamente la evidencia JSON suministrada. No recalcules ni inventes métricas.",
    "No formules causalidad a partir de asociaciones observacionales.",
    "No hagas diagnósticos médicos, nutricionales ni psicológicos.",
    "No infieras datos personales ausentes ni atributos sensibles.",
    "Cada prioridad o recomendación debe poder vincularse a evidencia disponible o a una limitación explícita.",
    "Devuelve únicamente el objeto JSON solicitado por el esquema."
  ].join("\n");
}

function buildUserPrompt({
  period,
  evidence
}: {
  period: { start: unknown; end: unknown };
  evidence: JsonRecord;
}) {
  return JSON.stringify({
    task: "Interpretar evidencia longitudinal para staff deportivo y proponer próximos focos de observación/entrenamiento.",
    period,
    evidence
  });
}

function extractResponseText(payload: JsonRecord) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as JsonRecord).content)
      ? (item as JsonRecord).content as unknown[]
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const record = part as JsonRecord;
      if (record.type === "output_text" && typeof record.text === "string") {
        return record.text.trim();
      }
    }
  }
  return "";
}

function hasProviderRefusal(payload: JsonRecord) {
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output.some(item => {
    if (!item || typeof item !== "object") return false;
    const content = Array.isArray((item as JsonRecord).content)
      ? (item as JsonRecord).content as unknown[]
      : [];
    return content.some(part => {
      if (!part || typeof part !== "object") return false;
      const record = part as JsonRecord;
      return record.type === "refusal" || typeof record.refusal === "string";
    });
  });
}

async function callOpenAiProvider({
  evidence,
  period,
  locale
}: {
  evidence: JsonRecord;
  period: { start: unknown; end: unknown };
  locale: string;
}, runtime: ProviderRuntimeConfig): Promise<ProviderResult> {
  const { apiKey, modelName, endpoint, timeoutMs, maxOutputTokens } = runtime;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        store: false,
        max_output_tokens: maxOutputTokens,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: buildSystemPrompt(locale) }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: buildUserPrompt({ period, evidence }) }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "iqbasket_player360_insight",
            strict: true,
            schema: PLAYER360_AI_OUTPUT_JSON_SCHEMA
          }
        }
      })
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("AI_PROVIDER_TIMEOUT");
    }
    throw new Error("AI_PROVIDER_REQUEST_FAILED");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error("[player360-ai-insight] Provider HTTP failure", response.status);
    throw new Error("AI_PROVIDER_REQUEST_FAILED");
  }

  const payload = await response.json() as JsonRecord;
  if (String(payload.status || "").toLowerCase() === "incomplete") {
    throw new Error("AI_PROVIDER_OUTPUT_INCOMPLETE");
  }
  if (hasProviderRefusal(payload)) {
    throw new Error("AI_PROVIDER_REFUSED");
  }

  const rawText = extractResponseText(payload);
  if (!rawText) throw new Error("AI_PROVIDER_EMPTY_OUTPUT");

  let parsed: JsonRecord;
  try {
    parsed = JSON.parse(rawText) as JsonRecord;
  } catch {
    throw new Error("AI_PROVIDER_OUTPUT_NOT_JSON");
  }

  const usage = (payload.usage && typeof payload.usage === "object")
    ? payload.usage as JsonRecord
    : {};

  return {
    provider: "OPENAI",
    modelName,
    providerRequestId: typeof payload.id === "string" ? payload.id : null,
    content: normalizeAiInsightContent(parsed),
    usage: {
      input_tokens: Number.isFinite(Number(usage.input_tokens)) ? Number(usage.input_tokens) : null,
      output_tokens: Number.isFinite(Number(usage.output_tokens)) ? Number(usage.output_tokens) : null
    }
  };
}

async function callProvider(args: {
  evidence: JsonRecord;
  period: { start: unknown; end: unknown };
  locale: string;
}, runtime: ProviderRuntimeConfig): Promise<ProviderResult> {
  if (runtime.provider === "OPENAI") return callOpenAiProvider(args, runtime);
  throw new Error("AI_PROVIDER_NOT_CONFIGURED");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error_code: "METHOD_NOT_ALLOWED" }, 405);

  // Independent server-side deployment gate. Deploying the Edge Function is
  // safe until this environment flag is explicitly enabled.
  const environmentGenerationEnabled = String(Deno.env.get("IQB_AI_GENERATION_ENABLED") || "")
    .trim().toLowerCase() === "true";
  const configurationGenerationEnabled = PLAYER360_AI_GATEWAY_CONFIG.generationEnabled === true;
  if (!environmentGenerationEnabled || !configurationGenerationEnabled) {
    return json({ success: false, error_code: "AI_GATEWAY_NOT_ENABLED" }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ success: false, error_code: "AI_GATEWAY_INFRA_NOT_CONFIGURED" }, 503);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ success: false, error_code: "AUTH_REQUIRED" }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  const caller = userData?.user;
  if (userError || !caller?.id) {
    return json({ success: false, error_code: "AUTH_INVALID" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const snapshotId = String(body?.snapshot_id || "").trim();
  const idempotencyKey = String(body?.idempotency_key || "").trim();
  const audience = safeUpper(body?.audience || "STAFF");
  const locale = safeLocale(body?.locale);
  if (!snapshotId) return json({ success: false, error_code: "SNAPSHOT_REQUIRED" }, 400);
  if (!UUID_PATTERN.test(idempotencyKey)) {
    return json({ success: false, error_code: "AI_IDEMPOTENCY_KEY_INVALID" }, 400);
  }
  if (!PLAYER360_AI_GATEWAY_CONFIG.allowedAudiences.includes(audience)) {
    return json({ success: false, error_code: "AI_AUDIENCE_UNSUPPORTED" }, 400);
  }

  // Evidence is always obtained with caller RLS; service_role never reads it.
  const { data: snapshot, error: snapshotError } = await callerClient
    .from("player_longitudinal_snapshots")
    .select("id,team_season_id,player_id,period_start,period_end,source_fingerprint,evidence_bundle")
    .eq("id", snapshotId)
    .maybeSingle();
  if (snapshotError || !snapshot) {
    return json({ success: false, error_code: "AI_SNAPSHOT_NOT_ACCESSIBLE" }, 404);
  }

  const { data: canGenerate, error: permissionError } = await callerClient.rpc(
    "iq_v4_can_generate_ai_insights",
    { p_team_season_id: snapshot.team_season_id }
  );
  if (permissionError || canGenerate !== true) {
    return json({ success: false, error_code: "PLAYER360_AI_GENERATE_DENIED" }, 403);
  }

  let providerEvidence: JsonRecord;
  try {
    providerEvidence = sanitizeEvidenceForAiProvider(snapshot.evidence_bundle || {}) as JsonRecord;
  } catch (error) {
    return json({
      success: false,
      error_code: error instanceof Error ? error.message : "AI_EVIDENCE_DENIED"
    }, 403);
  }

  // Validate provider runtime before reserving quota. Misconfiguration must not
  // consume a licensed unit.
  let providerRuntime: ProviderRuntimeConfig;
  try {
    providerRuntime = resolveProviderRuntimeConfig();
  } catch (error) {
    return json({
      success: false,
      error_code: error instanceof Error ? error.message : "AI_PROVIDER_NOT_CONFIGURED"
    }, 503);
  }

  const quotaMap = parseQuotaMap(Deno.env.get("IQB_AI_MONTHLY_LIMITS_JSON"));
  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select("role,global_role")
    .eq("id", caller.id)
    .maybeSingle();
  if (profileError || !profile) {
    return json({ success: false, error_code: "AI_QUOTA_PROFILE_UNAVAILABLE" }, 503);
  }
  const quotaRole = resolveQuotaRole(profile as JsonRecord);
  const monthlyLimit = quotaMap[quotaRole] ?? 0;
  if (monthlyLimit <= 0) {
    return json({ success: false, error_code: "AI_QUOTA_NOT_CONFIGURED" }, 403);
  }

  // Atomic reservation serializes concurrent attempts for the same user/month.
  const { data: reservationData, error: reservationError } = await adminClient.rpc(
    "iq_ai_reserve_usage",
    {
      p_user_id: caller.id,
      p_team_season_id: snapshot.team_season_id,
      p_snapshot_id: snapshot.id,
      p_idempotency_key: idempotencyKey,
      p_monthly_limit: monthlyLimit,
      p_operation: "PLAYER360_AI_INSIGHT"
    }
  );
  if (reservationError || !reservationData || typeof reservationData !== "object") {
    console.error("[player360-ai-insight] Usage reservation failed", reservationError?.message || "unknown");
    return json({ success: false, error_code: "AI_USAGE_RESERVATION_FAILED" }, 503);
  }

  const reservation = reservationData as JsonRecord;
  const ledgerId = String(reservation.ledger_id || "").trim();
  const used = Math.max(0, Number(reservation.used) || 0);
  const limit = Math.max(0, Number(reservation.limit) || monthlyLimit);
  const state = safeUpper(reservation.state);

  if (reservation.replayed === true && reservation.insight_id) {
    const insightId = String(reservation.insight_id);
    const { data: existingInsight } = await callerClient
      .from("player_ai_insights")
      .select("id,status,provider,model_name,prompt_version")
      .eq("id", insightId)
      .maybeSingle();
    return json({
      success: true,
      replayed: true,
      insight_id: insightId,
      status: existingInsight?.status || "DRAFT",
      provider: existingInsight?.provider || null,
      model_name: existingInsight?.model_name || null,
      prompt_version: existingInsight?.prompt_version || PLAYER360_AI_GATEWAY_CONFIG.promptVersion,
      usage: { used, limit }
    });
  }

  if (reservation.accepted !== true || !ledgerId) {
    if (state === "DENIED" || reservation.reason === "QUOTA_EXCEEDED") {
      return json({
        success: false,
        error_code: "AI_MONTHLY_QUOTA_EXCEEDED",
        usage: { used, limit }
      }, 429);
    }
    if (state === "RESERVED" || state === "IN_PROGRESS") {
      return json({ success: false, error_code: "AI_REQUEST_IN_PROGRESS", usage: { used, limit } }, 409);
    }
    if (state === "FAILED") {
      return json({
        success: false,
        error_code: "AI_REQUEST_PREVIOUSLY_FAILED",
        previous_failure_code: reservation.failure_code || null,
        usage: { used, limit }
      }, 409);
    }
    return json({ success: false, error_code: "AI_USAGE_RESERVATION_DENIED" }, 409);
  }

  // Membership can change while a request is being prepared. Recheck before
  // crossing the paid-provider boundary; a denial releases the reservation.
  const { data: canGenerateNow, error: permissionRecheckError } = await callerClient.rpc(
    "iq_v4_can_generate_ai_insights",
    { p_team_season_id: snapshot.team_season_id }
  );
  if (permissionRecheckError || canGenerateNow !== true) {
    await adminClient.rpc("iq_ai_fail_usage", {
      p_ledger_id: ledgerId,
      p_user_id: caller.id,
      p_failure_code: "PLAYER360_AI_GENERATE_DENIED"
    });
    return json({ success: false, error_code: "PLAYER360_AI_GENERATE_DENIED" }, 403);
  }

  const startedAt = performance.now();
  try {
    // From this transition onward one unit is consumed even if the provider or
    // persistence later fails, because an external paid attempt can occur.
    const { error: startUsageError } = await adminClient.rpc("iq_ai_mark_provider_started", {
      p_ledger_id: ledgerId,
      p_user_id: caller.id,
      p_provider: providerRuntime.provider,
      p_model_name: providerRuntime.modelName
    });
    if (startUsageError) throw new Error("AI_USAGE_PROVIDER_START_FAILED");

    const result = await callProvider({
      evidence: providerEvidence,
      period: {
        start: snapshot.period_start || null,
        end: snapshot.period_end || null
      },
      locale
    }, providerRuntime);
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    const trustedContent = {
      ...result.content,
      _generation: {
        contract_version: PLAYER360_AI_GATEWAY_CONFIG.outputContractVersion,
        gateway_version: PLAYER360_AI_GATEWAY_CONFIG.gatewayVersion,
        usage_ledger_id: ledgerId,
        provider_request_id: result.providerRequestId,
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        latency_ms: latencyMs,
        evidence_source_fingerprint: snapshot.source_fingerprint || null
      }
    };

    // Persist through caller context so authorization is rechecked by Phase 4D.
    const { data: insightId, error: persistError } = await callerClient.rpc(
      "iq_v4_save_ai_insight",
      {
        p_snapshot_id: snapshot.id,
        p_audience: audience,
        p_locale: locale,
        p_provider: result.provider,
        p_model_name: result.modelName,
        p_prompt_version: PLAYER360_AI_GATEWAY_CONFIG.promptVersion,
        p_content: trustedContent
      }
    );
    if (persistError || !insightId) throw new Error("AI_INSIGHT_PERSIST_FAILED");

    const { data: completionData, error: completionError } = await adminClient.rpc(
      "iq_ai_complete_usage",
      {
        p_ledger_id: ledgerId,
        p_user_id: caller.id,
        p_insight_id: insightId,
        p_provider_request_id: result.providerRequestId,
        p_input_tokens: result.usage.input_tokens,
        p_output_tokens: result.usage.output_tokens,
        p_latency_ms: latencyMs
      }
    );
    if (completionError) {
      // Do not mark failed: the insight already exists and the consumed ledger
      // remains IN_PROGRESS for safe reconciliation without under-counting cost.
      console.error("[player360-ai-insight] Usage finalization failed", completionError.message);
      return json({
        success: false,
        error_code: "AI_USAGE_FINALIZE_FAILED",
        insight_id: insightId,
        usage_ledger_id: ledgerId
      }, 503);
    }

    const completion = (completionData && typeof completionData === "object")
      ? completionData as JsonRecord
      : {};
    return json({
      success: true,
      replayed: false,
      insight_id: insightId,
      status: "DRAFT",
      provider: result.provider,
      model_name: result.modelName,
      prompt_version: PLAYER360_AI_GATEWAY_CONFIG.promptVersion,
      usage_ledger_id: ledgerId,
      usage: {
        ...result.usage,
        used: Math.max(0, Number(completion.used) || used),
        limit: Math.max(0, Number(completion.limit) || limit)
      }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AI_GATEWAY_GENERATION_FAILED";
    const { error: failUsageError } = await adminClient.rpc("iq_ai_fail_usage", {
      p_ledger_id: ledgerId,
      p_user_id: caller.id,
      p_failure_code: code
    });
    if (failUsageError) {
      console.error("[player360-ai-insight] Usage failure finalization failed", failUsageError.message);
    }
    console.error("[player360-ai-insight] Generation failed", code);
    return json({ success: false, error_code: code }, 502);
  }
});
