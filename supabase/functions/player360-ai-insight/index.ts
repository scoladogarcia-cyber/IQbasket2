import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const CONTRACT_VERSION = "PLAYER360_AI_GATEWAY_V1";
const PROMPT_VERSION = "PLAYER360_STAFF_ES_V2";
const ALLOWED_PROVIDER = "LOCAL_OPENAI_COMPATIBLE";
const ALLOWED_COST_CLASS = "FREE";
const ALLOWED_AUDIENCES = new Set(["STAFF", "PLAYER", "FAMILY", "EXECUTIVE"]);
const ALLOWED_PURPOSES = new Set(["SPORT_PERFORMANCE", "OPERATIONS"]);
const RESTRICTED_MODULES = new Set(["nutrition", "recovery", "neuro_cognitive"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function env(name: string, fallback = "") {
  return String(Deno.env.get(name) || fallback).trim();
}

function asPositiveInt(value: string, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function normalizeAudience(value: unknown) {
  const normalized = String(value || "STAFF").trim().toUpperCase();
  return ALLOWED_AUDIENCES.has(normalized) ? normalized : null;
}

function normalizePurpose(value: unknown) {
  const normalized = String(value || "SPORT_PERFORMANCE").trim().toUpperCase();
  return ALLOWED_PURPOSES.has(normalized) ? normalized : null;
}

function normalizeLocale(value: unknown) {
  const normalized = String(value || "es").trim().toLowerCase();
  return /^[a-z]{2}(?:-[a-z0-9]{2,8})?$/.test(normalized) ? normalized : "es";
}

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function restrictedModulesFromEvidence(evidence: Record<string, unknown>) {
  const modules = new Set<string>();
  const facts = Array.isArray(evidence?.facts) ? evidence.facts : [];
  for (const fact of facts) {
    if (!fact || typeof fact !== "object") continue;
    for (const key of ["metric_key", "left_metric_key", "right_metric_key"]) {
      const value = String((fact as Record<string, unknown>)[key] || "").trim();
      const module = value.split(".")[0]?.toLowerCase();
      if (RESTRICTED_MODULES.has(module)) modules.add(module);
    }
  }
  return [...modules];
}

function minimizeEvidence(snapshot: Record<string, unknown>) {
  const evidence = (snapshot.evidence_bundle || {}) as Record<string, unknown>;
  const facts = Array.isArray(evidence.facts) ? evidence.facts.slice(0, 80) : [];
  const missingData = Array.isArray(evidence.missing_data)
    ? evidence.missing_data.slice(0, 40)
    : [];
  const limitations = Array.isArray(evidence.limitations)
    ? evidence.limitations.slice(0, 20)
    : [];

  return {
    contract_version: CONTRACT_VERSION,
    evidence_version: evidence.evidence_version || "PLAYER360_EVIDENCE_V1",
    calculation_version: evidence.calculation_version || null,
    period: {
      start: snapshot.period_start || null,
      end: snapshot.period_end || null
    },
    facts,
    missing_data: missingData,
    limitations
  };
}

function validateInsightContent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI_OUTPUT_NOT_OBJECT");
  }

  const content = value as Record<string, unknown>;
  const allowedKeys = new Set([
    "summary",
    "interpretation",
    "priorities",
    "recommendations",
    "action_plan",
    "limitations",
    "evidence_used"
  ]);

  for (const key of Object.keys(content)) {
    if (!allowedKeys.has(key)) throw new Error("AI_OUTPUT_UNSUPPORTED_FIELD");
  }

  const serialized = JSON.stringify(content);
  if (serialized.length > 24000) throw new Error("AI_OUTPUT_TOO_LARGE");

  const prohibited = [
    /\bdemuestra que\b/i,
    /\bcausa(?:do|da)? por\b/i,
    /\bprovoca\b/i,
    /\bdiagn[oó]stic/i,
    /\bproves? that\b/i,
    /\bcaused by\b/i,
    /\bdiagnos(?:is|e|ed)\b/i
  ];
  if (prohibited.some(pattern => pattern.test(serialized))) {
    throw new Error("AI_OUTPUT_CAUSAL_OR_CLINICAL_CLAIM");
  }

  if (content.summary === undefined && content.interpretation === undefined) {
    throw new Error("AI_OUTPUT_MISSING_CORE_SECTION");
  }

  return content;
}

function systemPrompt(locale: string, audience: string) {
  return [
    "Eres el asistente de interpretación de rendimiento deportivo de IQBasket.",
    "Tu tarea es REDACTAR e INTERPRETAR únicamente hechos deterministas ya calculados.",
    "No recalcules métricas, no inventes valores y no rellenes datos ausentes.",
    "No hagas afirmaciones causales, diagnósticas, clínicas ni pronósticas.",
    "Una asociación temporal o correlación nunca demuestra causa y efecto.",
    "Si la evidencia es insuficiente, dilo de forma explícita.",
    `Audiencia: ${audience}. Idioma de salida: ${locale}.`,
    "Devuelve exclusivamente JSON válido, sin markdown, con estas claves opcionales:",
    "summary, interpretation, priorities, recommendations, action_plan, limitations, evidence_used.",
    "summary e interpretation deben ser texto breve; priorities, recommendations y action_plan pueden ser arrays de textos.",
    "evidence_used debe citar solo claves de métricas o tipos de hecho presentes en la entrada.",
    `Versión de prompt: ${PROMPT_VERSION}.`
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "AI_GATEWAY_BACKEND_NOT_CONFIGURED" }, 500);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ error: "AUTH_REQUIRED" }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  const caller = userData?.user;
  if (userError || !caller?.id) return json({ error: "INVALID_SESSION" }, 401);

  const payload = await req.json().catch(() => ({}));
  const action = String(payload?.action || "generate").trim().toLowerCase();

  const gatewayEnabled = env("AI_GATEWAY_ENABLED", "false").toLowerCase() === "true";
  const freeOnly = env("AI_FREE_ONLY", "true").toLowerCase() !== "false";
  const provider = env("AI_PROVIDER", ALLOWED_PROVIDER).toUpperCase();
  const costClass = env("AI_COST_CLASS", ALLOWED_COST_CLASS).toUpperCase();
  const modelName = env("AI_MODEL");
  const baseUrl = env("AI_BASE_URL").replace(/\/$/, "");

  const providerAllowed = provider === ALLOWED_PROVIDER;
  const zeroCostAllowed = freeOnly && costClass === ALLOWED_COST_CLASS;
  const available = gatewayEnabled && providerAllowed && zeroCostAllowed && Boolean(modelName && baseUrl);

  if (action === "capabilities") {
    return json({
      available,
      free_only: true,
      provider: providerAllowed ? provider : null,
      model_name: modelName || null,
      prompt_version: PROMPT_VERSION,
      contract_version: CONTRACT_VERSION,
      reason: available
        ? null
        : !gatewayEnabled
          ? "AI_GATEWAY_DISABLED"
          : !zeroCostAllowed
            ? "PAID_AI_BLOCKED"
            : !providerAllowed
              ? "AI_PROVIDER_NOT_ALLOWED"
              : "AI_FREE_MODEL_NOT_CONFIGURED"
    });
  }

  if (action !== "generate") return json({ error: "UNSUPPORTED_ACTION" }, 400);
  if (!gatewayEnabled) return json({ error: "AI_GATEWAY_DISABLED" }, 503);
  if (!freeOnly || costClass !== ALLOWED_COST_CLASS) {
    return json({ error: "PAID_AI_BLOCKED" }, 503);
  }
  if (!providerAllowed) return json({ error: "AI_PROVIDER_NOT_ALLOWED" }, 503);
  if (!modelName || !baseUrl) return json({ error: "AI_FREE_MODEL_NOT_CONFIGURED" }, 503);
  if (!/^https:\/\//i.test(baseUrl)) return json({ error: "AI_BASE_URL_MUST_USE_HTTPS" }, 503);

  const snapshotId = String(payload?.snapshot_id || "").trim();
  const audience = normalizeAudience(payload?.audience);
  const purpose = normalizePurpose(payload?.purpose);
  const locale = normalizeLocale(payload?.locale);
  if (!snapshotId || !audience || !purpose) return json({ error: "AI_REQUEST_INVALID" }, 400);

  const { data: snapshot, error: snapshotError } = await callerClient
    .from("player_longitudinal_snapshots")
    .select("id,team_season_id,player_id,period_start,period_end,evidence_bundle")
    .eq("id", snapshotId)
    .maybeSingle();
  if (snapshotError || !snapshot?.id) return json({ error: "PLAYER360_SNAPSHOT_NOT_FOUND" }, 404);

  const { data: canGenerate, error: permissionError } = await callerClient.rpc(
    "iq_v4_can_generate_ai_insights",
    { p_team_season_id: snapshot.team_season_id }
  );
  if (permissionError || !canGenerate) return json({ error: "PLAYER360_AI_GENERATE_DENIED" }, 403);

  const minimized = minimizeEvidence(snapshot as Record<string, unknown>);
  const serializedInput = JSON.stringify(minimized);
  if (serializedInput.length > 60000) return json({ error: "AI_EVIDENCE_TOO_LARGE" }, 413);

  const restrictedModules = restrictedModulesFromEvidence(minimized as Record<string, unknown>);
  for (const module of restrictedModules) {
    const { data: allowed, error } = await callerClient.rpc(
      "iq_v4e_can_access_sensitive_resource",
      {
        p_player_id: snapshot.player_id,
        p_team_season_id: snapshot.team_season_id,
        p_module: module,
        p_action: "AI_PROCESS",
        p_purpose: purpose
      }
    );
    if (error || !allowed) {
      return json({ error: "PLAYER360_AI_SENSITIVE_PROCESSING_DENIED", module }, 403);
    }
  }

  const inputFingerprint = await sha256(serializedInput);
  const requestKey = await sha256([
    snapshotId,
    audience,
    locale,
    purpose,
    provider,
    modelName,
    PROMPT_VERSION,
    inputFingerprint
  ].join("|"));

  const { data: prepared, error: prepareError } = await callerClient.rpc(
    "iq_v4g_prepare_ai_gateway_request",
    {
      p_snapshot_id: snapshotId,
      p_audience: audience,
      p_locale: locale,
      p_purpose: purpose,
      p_provider: provider,
      p_model_name: modelName,
      p_prompt_version: PROMPT_VERSION,
      p_input_fingerprint: inputFingerprint,
      p_request_key: requestKey
    }
  );
  if (prepareError) {
    return json({ error: prepareError.message || "AI_REQUEST_PREPARE_FAILED" }, 403);
  }

  if (prepared?.deduplicated && prepared?.insight_id) {
    return json({
      success: true,
      deduplicated: true,
      insight_id: prepared.insight_id,
      request_id: prepared.request_id,
      status: "DRAFT",
      provider,
      model_name: modelName,
      prompt_version: PROMPT_VERSION,
      free_only: true,
      estimated_cost_eur_micros: 0
    });
  }

  const requestId = String(prepared?.request_id || "").trim();
  if (!requestId) return json({ error: "AI_REQUEST_AUDIT_NOT_CREATED" }, 500);

  const timeoutMs = asPositiveInt(env("AI_TIMEOUT_MS"), 25000, 60000);
  const maxOutputTokens = asPositiveInt(env("AI_MAX_OUTPUT_TOKENS"), 700, 2000);
  const apiKey = env("AI_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const providerResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        temperature: 0.2,
        max_tokens: maxOutputTokens,
        messages: [
          { role: "system", content: systemPrompt(locale, audience) },
          { role: "user", content: serializedInput }
        ]
      })
    });

    if (!providerResponse.ok) {
      throw new Error(`AI_PROVIDER_HTTP_${providerResponse.status}`);
    }

    const raw = await providerResponse.json();
    const text = String(raw?.choices?.[0]?.message?.content || "").trim();
    if (!text) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(text));
    } catch {
      throw new Error("AI_PROVIDER_INVALID_JSON");
    }

    const content = validateInsightContent(parsed);
    const promptTokens = Number.isFinite(Number(raw?.usage?.prompt_tokens))
      ? Number(raw.usage.prompt_tokens)
      : null;
    const completionTokens = Number.isFinite(Number(raw?.usage?.completion_tokens))
      ? Number(raw.usage.completion_tokens)
      : null;

    const { data: completed, error: completeError } = await adminClient.rpc(
      "iq_v4g_complete_ai_gateway_request",
      {
        p_request_id: requestId,
        p_content: content,
        p_input_tokens: promptTokens,
        p_output_tokens: completionTokens,
        p_estimated_cost_eur_micros: 0
      }
    );
    if (completeError) throw completeError;

    return json({
      success: true,
      deduplicated: false,
      insight_id: completed?.insight_id || null,
      request_id: requestId,
      status: "DRAFT",
      provider,
      model_name: modelName,
      prompt_version: PROMPT_VERSION,
      free_only: true,
      estimated_cost_eur_micros: 0
    });
  } catch (error) {
    const code = error instanceof DOMException && error.name === "AbortError"
      ? "AI_PROVIDER_TIMEOUT"
      : String((error as Error)?.message || "AI_GATEWAY_FAILED").slice(0, 120);

    await adminClient.rpc("iq_v4g_fail_ai_gateway_request", {
      p_request_id: requestId,
      p_error_code: code
    }).catch(() => null);

    return json({ error: code }, code === "AI_PROVIDER_TIMEOUT" ? 504 : 502);
  } finally {
    clearTimeout(timeout);
  }
});
