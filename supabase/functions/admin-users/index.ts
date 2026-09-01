import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const UNIQUE_SUPERADMIN_EMAIL = "scolado@nechigroup.com";
const STANDARD_ROLES = new Set([
  "ENTRENADOR",
  "ANALISTA",
  "PREPARADOR_FISICO",
  "JUGADOR",
  "FAMILIA_TUTOR",
  "VISOR",
  "INVITADO"
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Edge Function no configurada." }, 500);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ error: "No autenticado." }, 401);
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
  if (userError || !caller?.email) return json({ error: "Sesión no válida." }, 401);

  const callerEmail = caller.email.toLowerCase();
  const { data: callerProfile } = await adminClient
    .from("user_profiles")
    .select("*")
    .eq("email", callerEmail)
    .maybeSingle();

  const callerRole = callerEmail === UNIQUE_SUPERADMIN_EMAIL
    ? "SUPERADMIN"
    : String(callerProfile?.role || "INVITADO").toUpperCase();

  if (!["SUPERADMIN", "ADMIN"].includes(callerRole)) {
    return json({ error: "No tienes permiso para administrar usuarios." }, 403);
  }

  const payload = await req.json().catch(() => ({}));
  if (payload.action !== "create-user") {
    return json({ error: "Acción no soportada." }, 400);
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const firstName = String(payload.firstName || "").trim();
  const lastName = String(payload.lastName || "").trim();
  const requestedRole = String(payload.role || "INVITADO").toUpperCase();
  const requestedTeamIds = Array.isArray(payload.teamIds) ? payload.teamIds : [];

  if (!email || !password || !firstName) {
    return json({ error: "Faltan datos obligatorios." }, 400);
  }

  if (email === UNIQUE_SUPERADMIN_EMAIL) {
    return json({ error: "La cuenta Superadmin única ya está reservada." }, 409);
  }

  if (requestedRole === "SUPERADMIN") {
    return json({ error: "No se puede crear otro Superadmin." }, 403);
  }

  if (requestedRole === "ADMIN" && callerRole !== "SUPERADMIN") {
    return json({ error: "Solo el Superadmin puede crear administradores." }, 403);
  }

  if (requestedRole !== "ADMIN" && !STANDARD_ROLES.has(requestedRole)) {
    return json({ error: "Rol no válido." }, 400);
  }

  const targetClubId = callerRole === "SUPERADMIN"
    ? (payload.clubId || null)
    : (callerProfile?.club_id || null);

  if (callerRole === "ADMIN" && requestedTeamIds.length > 0) {
    const { data: requestedTeams, error: teamsError } = await adminClient
      .from("teams")
      .select("id, club_id")
      .in("id", requestedTeamIds);

    if (teamsError) return json({ error: teamsError.message }, 400);

    const validIds = new Set((requestedTeams || []).map((t) => String(t.id)));
    const containsForeignTeam = (requestedTeams || []).some(
      (t) => String(t.club_id || "") !== String(callerProfile?.club_id || "")
    );

    if (validIds.size !== requestedTeamIds.length || containsForeignTeam) {
      return json({ error: "Un administrador solo puede asignar equipos de su propio club." }, 403);
    }
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: "INVITADO"
    }
  });

  if (createError || !created?.user) {
    return json({ error: createError?.message || "No se pudo crear el usuario." }, 400);
  }

  const profilePayload = {
    id: created.user.id,
    email,
    first_name: firstName,
    last_name: lastName,
    role: "INVITADO",
    club_id: targetClubId,
    allowed_team_ids: requestedTeamIds,
    team_id: requestedTeamIds[0] || null,
    status: "Activo"
  };

  let { error: profileError } = await adminClient
    .from("user_profiles")
    .upsert(profilePayload, { onConflict: "email" });

  // Compatibilidad con esquema anterior a allowed_team_ids.
  if (profileError) {
    const fallback = { ...profilePayload };
    delete fallback.allowed_team_ids;
    const result = await adminClient
      .from("user_profiles")
      .upsert(fallback, { onConflict: "email" });
    profileError = result.error;
  }

  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: profileError.message }, 400);
  }

  const { error: roleUpdateError } = await adminClient
    .from("user_profiles")
    .update({
      role: requestedRole,
      club_id: targetClubId,
      allowed_team_ids: requestedTeamIds,
      team_id: requestedTeamIds[0] || null
    })
    .eq("email", email);

  if (roleUpdateError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: roleUpdateError.message }, 400);
  }

  return json({
    success: true,
    user: {
      id: created.user.id,
      email,
      role: requestedRole,
      club_id: targetClubId,
      allowed_team_ids: requestedTeamIds
    }
  });
});
