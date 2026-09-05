import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * IQBasket Family checkout boundary V1.
 *
 * This function deliberately has NO billing-provider adapter yet. Its purpose is
 * to establish the server-authoritative contract safely before a provider is
 * selected. It never creates/updates subscriptions or paid entitlements.
 * Future provider integration must create only an external checkout session;
 * subscription activation must happen from a verified provider webhook.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BILLING_ROLES = new Set(["OWNER", "BILLING"]);

const SERVER_READINESS_FLAGS = Object.freeze([
  ["IQB_FAMILY_PRIVACY_TERMS_APPROVED", "PRIVACY_TERMS"],
  ["IQB_FAMILY_CONSENT_RULES_APPROVED", "CONSENT_RULES"],
  ["IQB_FAMILY_SPECIAL_CATEGORY_REVIEW_APPROVED", "SPECIAL_CATEGORY_REVIEW"],
  ["IQB_FAMILY_RIGHTS_RETENTION_PROCESS_APPROVED", "RIGHTS_RETENTION"],
  ["IQB_FAMILY_PROCESSOR_CONTRACTS_APPROVED", "PROCESSOR_CONTRACTS"],
  ["IQB_FAMILY_DPIA_REVIEWED", "DPIA_REVIEW"],
  ["IQB_FAMILY_POLICY_VERSIONING_READY", "POLICY_VERSIONING"]
] as const);

type JsonRecord = Record<string, unknown>;

type CorsHeaders = Record<string, string>;

function baseHeaders(extra: CorsHeaders = {}) {
  return {
    "Content-Type": "application/json",
    ...extra
  };
}

function json(body: unknown, status = 200, headers: CorsHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: baseHeaders(headers)
  });
}

function envFlag(name: string) {
  const value = String(Deno.env.get(name) || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}

function safeUpper(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function parseCsvSet(raw: string | undefined, normalizer = (value: string) => value) {
  return new Set(
    String(raw || "")
      .split(",")
      .map(value => normalizer(value.trim()))
      .filter(Boolean)
  );
}

function normalizeOrigin(value: string) {
  return value.replace(/\/$/, "").toLowerCase();
}

function resolveRequestCors(req: Request) {
  const rawOrigin = String(req.headers.get("Origin") || "").trim();
  if (!rawOrigin) throw new Error("BILLING_REQUEST_ORIGIN_REQUIRED");

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(rawOrigin);
  } catch {
    throw new Error("BILLING_REQUEST_ORIGIN_INVALID");
  }
  if (parsedOrigin.origin === "null") throw new Error("BILLING_REQUEST_ORIGIN_INVALID");

  const allowedOrigins = parseCsvSet(
    Deno.env.get("IQB_APP_ALLOWED_REQUEST_ORIGINS"),
    normalizeOrigin
  );
  if (allowedOrigins.size === 0) throw new Error("BILLING_REQUEST_ORIGINS_NOT_CONFIGURED");
  if (!allowedOrigins.has(normalizeOrigin(parsedOrigin.origin))) {
    throw new Error("BILLING_REQUEST_ORIGIN_DENIED");
  }

  return Object.freeze({
    "Access-Control-Allow-Origin": parsedOrigin.origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  });
}

function commercialReadinessBlockers() {
  const blockers: string[] = [];
  if (!envFlag("IQB_FAMILY_COMMERCIAL_PILOT_ENABLED")) {
    blockers.push("COMMERCIAL_PILOT_DISABLED");
  }
  for (const [envName, blockerCode] of SERVER_READINESS_FLAGS) {
    if (!envFlag(envName)) blockers.push(blockerCode);
  }
  return blockers;
}

function validateReturnUrl(raw: unknown) {
  const value = String(raw || "").trim();
  if (!value) throw new Error("BILLING_RETURN_URL_REQUIRED");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("BILLING_RETURN_URL_INVALID");
  }

  const allowedOrigins = parseCsvSet(
    Deno.env.get("IQB_APP_ALLOWED_RETURN_ORIGINS"),
    normalizeOrigin
  );
  if (allowedOrigins.size === 0) throw new Error("BILLING_RETURN_ORIGINS_NOT_CONFIGURED");
  if (!allowedOrigins.has(normalizeOrigin(url.origin))) {
    throw new Error("BILLING_RETURN_ORIGIN_DENIED");
  }
  return url.toString();
}

Deno.serve(async (req) => {
  let corsHeaders: CorsHeaders;
  try {
    corsHeaders = resolveRequestCors(req);
  } catch (error) {
    return json({
      success: false,
      error_code: error instanceof Error ? error.message : "BILLING_REQUEST_ORIGIN_DENIED"
    }, 403);
  }
  const responseJson = (body: unknown, status = 200) => json(body, status, corsHeaders);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return responseJson({ success: false, error_code: "METHOD_NOT_ALLOWED" }, 405);
  }

  // Server-only rollout gate. The client VITE flag is not trusted.
  if (!envFlag("IQB_FAMILY_BILLING_CHECKOUT_ENABLED")) {
    return responseJson({ success: false, error_code: "FAMILY_BILLING_GATEWAY_NOT_ENABLED" }, 503);
  }

  const readinessBlockers = commercialReadinessBlockers();
  if (readinessBlockers.length > 0) {
    return responseJson({
      success: false,
      error_code: "FAMILY_COMMERCIAL_READINESS_BLOCKED",
      readiness_blockers: readinessBlockers
    }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return responseJson({ success: false, error_code: "BILLING_INFRA_NOT_CONFIGURED" }, 503);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return responseJson({ success: false, error_code: "AUTH_REQUIRED" }, 401);
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
    return responseJson({ success: false, error_code: "AUTH_INVALID" }, 401);
  }

  const body = await req.json().catch(() => ({} as JsonRecord)) as JsonRecord;
  const billingAccountId = String(body.billing_account_id || "").trim();
  const planCode = safeUpper(body.plan_code);
  const idempotencyKey = String(body.idempotency_key || "").trim();

  if (!UUID_PATTERN.test(billingAccountId)) {
    return responseJson({ success: false, error_code: "BILLING_ACCOUNT_INVALID" }, 400);
  }
  if (!planCode) return responseJson({ success: false, error_code: "BILLING_PLAN_REQUIRED" }, 400);
  if (!UUID_PATTERN.test(idempotencyKey)) {
    return responseJson({ success: false, error_code: "BILLING_IDEMPOTENCY_KEY_INVALID" }, 400);
  }

  let returnUrl: string;
  try {
    returnUrl = validateReturnUrl(body.return_url);
  } catch (error) {
    return responseJson({
      success: false,
      error_code: error instanceof Error ? error.message : "BILLING_RETURN_URL_INVALID"
    }, 400);
  }

  // Paid plan exposure is independently allowlisted server-side. An empty list
  // fails closed even if a catalog plan is accidentally published.
  const allowedPlanCodes = parseCsvSet(Deno.env.get("IQB_FAMILY_PAID_PLAN_CODES"), safeUpper);
  if (allowedPlanCodes.size === 0) {
    return responseJson({ success: false, error_code: "BILLING_PLAN_ALLOWLIST_NOT_CONFIGURED" }, 503);
  }
  if (!allowedPlanCodes.has(planCode)) {
    return responseJson({ success: false, error_code: "BILLING_PLAN_NOT_ALLOWED" }, 403);
  }

  // Billing tables are backend-owned; service_role is used only after caller
  // identity has been verified. Membership is revalidated for every request.
  const { data: account, error: accountError } = await adminClient
    .from("saas_billing_accounts")
    .select("id,account_type,status")
    .eq("id", billingAccountId)
    .maybeSingle();
  if (accountError || !account) {
    return responseJson({ success: false, error_code: "BILLING_ACCOUNT_NOT_FOUND" }, 404);
  }
  if (account.account_type !== "FAMILY" || account.status !== "ACTIVE") {
    return responseJson({ success: false, error_code: "BILLING_ACCOUNT_NOT_ELIGIBLE" }, 403);
  }

  const { data: membership, error: membershipError } = await adminClient
    .from("saas_billing_account_members")
    .select("member_role,status")
    .eq("billing_account_id", billingAccountId)
    .eq("user_id", caller.id)
    .maybeSingle();
  if (membershipError || !membership || membership.status !== "ACTIVE") {
    return responseJson({ success: false, error_code: "BILLING_ACCOUNT_ACCESS_DENIED" }, 403);
  }
  if (!BILLING_ROLES.has(safeUpper(membership.member_role))) {
    return responseJson({ success: false, error_code: "BILLING_ACTION_DENIED" }, 403);
  }

  const { data: plan, error: planError } = await adminClient
    .from("saas_plans")
    .select("id,code,account_type,status,is_public")
    .eq("code", planCode)
    .maybeSingle();
  if (planError || !plan) {
    return responseJson({ success: false, error_code: "BILLING_PLAN_NOT_FOUND" }, 404);
  }
  if (plan.account_type !== "FAMILY" || plan.status !== "ACTIVE" || plan.is_public !== true) {
    return responseJson({ success: false, error_code: "BILLING_PLAN_NOT_AVAILABLE" }, 409);
  }

  // V1 intentionally stops here. No external provider has been selected and no
  // subscription row is ever mutated. This is the stable seam where a future
  // provider adapter can create a checkout session after all validations above.
  const provider = safeUpper(Deno.env.get("IQB_BILLING_PROVIDER"));
  if (!provider) {
    return responseJson({ success: false, error_code: "BILLING_PROVIDER_NOT_CONFIGURED" }, 503);
  }

  console.info("[family-checkout-session] Provider adapter not implemented", {
    provider,
    billing_account_id: billingAccountId,
    plan_code: planCode,
    return_origin: new URL(returnUrl).origin
  });
  return responseJson({ success: false, error_code: "BILLING_PROVIDER_NOT_IMPLEMENTED" }, 501);
});
