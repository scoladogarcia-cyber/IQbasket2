import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PLAYER360_AI_GATEWAY_CONFIG,
  PLAYER360_AI_OUTPUT_JSON_SCHEMA,
  assertEvidenceAllowedForAi,
  normalizeAiInsightContent
} from "../../../config/player360-ai-gateway.config.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const ALLOWED_LOCALES = new Set(["es", "ca", "en", "fr"]);

type JsonRecord = Record<string, unknown>;

type ProviderResult = {
  provider: string;
  modelName: string;
  providerRequestId: string | null;
  content: JsonRecord;
  usage: { input_tokens: number | null; output_tokens: number | null };
};

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

function buildUserPrompt(snapshot: JsonRecord) {
  const evidence = snapshot.evidence_bundle;
  const period = {
    start: snapshot.period_start || null,
    end: snapshot.period_end || null
  };
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

async function callOpenAiProvider({ snapshot, locale }: { snapshot: JsonRecord; locale: string }): Promise<ProviderResult> {
  const apiKey = Deno.env.get("IQB_AI_API_KEY") || "";
  const modelName = Deno.env.get("IQB_AI_MODEL") || "";
  const endpoint = Deno.env.get("IQB_AI_ENDPOINT") || "https://api.openai.com/v1/responses";
  if (!apiKey || !modelName) throw new Error("AI_PROVIDER_NOT_CONFIGURED");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildSystemPrompt(locale) }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: buildUserPrompt(snapshot) }]
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

  if (!response.ok) {
    console.error("[player360-ai-insight] Provider HTTP failure", response.status);
    throw new Error("AI_PROVIDER_REQUEST_FAILED");
  }

  const payload = await response.json() as JsonRecord;
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

async function callProvider(args: { snapshot: JsonRecord; locale: string }): Promise<ProviderResult> {
  const provider = safeUpper(Deno.env.get("IQB_AI_PROVIDER"));
  if (provider === "OPENAI") return callOpenAiProvider(args);
  throw new Error("AI_PROVIDER_NOT_CONFIGURED");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error_code: "METHOD_NOT_ALLOWED" }, 405);

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
  const audience = safeUpper(body?.audience || "STAFF");
  const locale = safeLocale(body?.locale);
  if (!snapshotId) return json({ success: false, error_code: "SNAPSHOT_REQUIRED" }, 400);
  if (!PLAYER360_AI_GATEWAY_CONFIG.allowedAudiences.includes(audience)) {
    return json({ success: false, error_code: "AI_AUDIENCE_UNSUPPORTED" }, 400);
  }

  // The caller-context client deliberately relies on existing RLS. A service
  // key is never used to obtain the evidence payload.
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

  try {
    assertEvidenceAllowedForAi(snapshot.evidence_bundle || {});
  } catch (error) {
    return json({
      success: false,
      error_code: error instanceof Error ? error.message : "AI_EVIDENCE_DENIED"
    }, 403);
  }

  // Paid consumption is enforced server-side. No quota configuration means
  // deny-by-default, avoiding accidental spend after deployment.
  const quotaMap = parseQuotaMap(Deno.env.get("IQB_AI_MONTHLY_LIMITS_JSON"));
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("role,global_role")
    .eq("id", caller.id)
    .maybeSingle();
  const quotaRole = resolveQuotaRole(profile as JsonRecord | null);
  const monthlyLimit = quotaMap[quotaRole] ?? 0;
  if (monthlyLimit <= 0) {
    return json({ success: false, error_code: "AI_QUOTA_NOT_CONFIGURED" }, 403);
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: monthlyUsed, error: quotaError } = await adminClient
    .from("player_ai_insights")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", caller.id)
    .neq("provider", "SYNTHETIC_DEMO")
    .gte("created_at", monthStart.toISOString());
  if (quotaError) return json({ success: false, error_code: "AI_QUOTA_CHECK_FAILED" }, 503);
  if ((monthlyUsed || 0) >= monthlyLimit) {
    return json({
      success: false,
      error_code: "AI_MONTHLY_QUOTA_EXCEEDED",
      usage: { used: monthlyUsed || 0, limit: monthlyLimit }
    }, 429);
  }

  const startedAt = performance.now();
  try {
    const result = await callProvider({ snapshot: snapshot as JsonRecord, locale });
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    const trustedContent = {
      ...result.content,
      _generation: {
        contract_version: PLAYER360_AI_GATEWAY_CONFIG.outputContractVersion,
        gateway_version: PLAYER360_AI_GATEWAY_CONFIG.gatewayVersion,
        provider_request_id: result.providerRequestId,
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        latency_ms: latencyMs,
        evidence_source_fingerprint: snapshot.source_fingerprint || null
      }
    };

    // Persist through the existing caller-context RPC, so authorization is
    // rechecked immediately before creating the DRAFT insight.
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

    return json({
      success: true,
      insight_id: insightId,
      status: "DRAFT",
      provider: result.provider,
      model_name: result.modelName,
      prompt_version: PLAYER360_AI_GATEWAY_CONFIG.promptVersion,
      usage: {
        ...result.usage,
        used: (monthlyUsed || 0) + 1,
        limit: monthlyLimit
      }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AI_GATEWAY_GENERATION_FAILED";
    console.error("[player360-ai-insight] Generation failed", code);
    return json({ success: false, error_code: code }, 502);
  }
});
