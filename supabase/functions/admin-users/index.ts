import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Administrative user provisioning boundary.
 *
 * Security invariants:
 * - the caller must present a valid JWT and have an ACTIVE account;
 * - authorization comes from server-side profile/RBAC state, never user metadata;
 * - only the unique global SUPERADMIN may create ADMIN users;
 * - ADMIN callers may provision only standard roles and only inside their team scope;
 * - Auth creation is performed exclusively with the service-role client;
 * - current V7 identity fields are the only profile fields written;
 * - optional player identity is represented in both the compatibility field and
 *   the canonical user_player_links relation.
 */

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

function normalizeUuidList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )];
}

function isPlausibleEmail(value: string): boolean {
  return value.length >= 5 && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  const caller = userData?.user;
  if (userError || !caller?.id || !caller?.email) {
    return json({ error: "Sesión no válida." }, 401);
  }

  const callerEmail = caller.email.trim().toLowerCase();
  const [{ data: callerProfile, error: profileError }, { data: accountControl, error: accountError }] = await Promise.all([
    adminClient
      .from("user_profiles")
      .select("id,email,role,global_role,status,assigned_team_ids")
      .eq("id", caller.id)
      .maybeSingle(),
    adminClient
      .from("user_account_controls")
      .select("account_status")
      .eq("user_id", caller.id)
      .maybeSingle()
  ]);

  if (profileError || !callerProfile || accountError || accountControl?.account_status !== "ACTIVE") {
    return json({ error: "Cuenta no activa o perfil no disponible." }, 403);
  }

  const { data: isGlobalSuperadmin, error: superError } = await callerClient.rpc(
    "iq_v3_is_global_superadmin"
  );
  if (superError) {
    return json({ error: "No se pudo validar la autorización administrativa." }, 403);
  }

  const callerRole = isGlobalSuperadmin
    ? "SUPERADMIN"
    : String(callerProfile.global_role || callerProfile.role || "USER").toUpperCase();

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
  const requestedRole = String(payload.role || "INVITADO").trim().toUpperCase();
  const requestedTeamIds = normalizeUuidList(payload.teamIds);
  const requestedTeamSeasonIds = normalizeUuidList(payload.teamSeasonIds);
  const linkedPlayerId = payload.linkedPlayerId
    ? String(payload.linkedPlayerId).trim()
    : null;

  if (!isPlausibleEmail(email) || !firstName || password.length < 8) {
    return json({ error: "Email, nombre y contraseña temporal de al menos 8 caracteres son obligatorios." }, 400);
  }

  if (email === UNIQUE_SUPERADMIN_EMAIL || requestedRole === "SUPERADMIN") {
    return json({ error: "La identidad Superadmin única está protegida." }, 403);
  }

  if (requestedRole === "ADMIN" && callerRole !== "SUPERADMIN") {
    return json({ error: "Solo el Superadmin puede crear administradores." }, 403);
  }

  if (requestedRole !== "ADMIN" && !STANDARD_ROLES.has(requestedRole)) {
    return json({ error: "Rol no válido." }, 400);
  }

  if (requestedRole === "JUGADOR" && !linkedPlayerId) {
    return json({ error: "Para crear una cuenta JUGADOR debes seleccionar el jugador que representa." }, 400);
  }

  const actorTeamIds = new Set(
    normalizeUuidList(callerProfile.assigned_team_ids)
  );

  let requestedTeams: Array<{ id: string }> = [];
  if (requestedTeamIds.length > 0) {
    const { data, error } = await adminClient
      .from("teams")
      .select("id")
      .in("id", requestedTeamIds);
    if (error) return json({ error: "No se pudo validar el ámbito de equipos." }, 400);
    requestedTeams = data || [];
    if (requestedTeams.length !== requestedTeamIds.length) {
      return json({ error: "Existe algún equipo solicitado que no es válido." }, 400);
    }
  }

  if (callerRole === "ADMIN") {
    if (requestedTeamIds.some((teamId) => !actorTeamIds.has(teamId))) {
      return json({ error: "Un administrador solo puede asignar equipos de su propio ámbito." }, 403);
    }
  }

  let linkedPlayer: { id: string; team_id: string | null } | null = null;
  if (linkedPlayerId) {
    if (requestedRole !== "JUGADOR") {
      return json({ error: "El vínculo SELF con jugador solo puede asignarse a una cuenta JUGADOR." }, 400);
    }

    const { data, error } = await adminClient
      .from("players")
      .select("id,team_id")
      .eq("id", linkedPlayerId)
      .maybeSingle();
    if (error || !data) return json({ error: "Jugador no válido." }, 400);
    linkedPlayer = data;

    if (requestedTeamIds.length > 0 && data.team_id && !requestedTeamIds.includes(String(data.team_id))) {
      return json({ error: "El jugador no pertenece al ámbito de equipos asignado." }, 403);
    }
    if (callerRole === "ADMIN" && data.team_id && !actorTeamIds.has(String(data.team_id))) {
      return json({ error: "El jugador está fuera del ámbito del administrador." }, 403);
    }
  }

  let teamSeasonRows: Array<{ id: string; team_id: string }> = [];
  if (requestedTeamSeasonIds.length > 0) {
    const { data, error } = await adminClient
      .from("team_seasons")
      .select("id,team_id")
      .in("id", requestedTeamSeasonIds);
    if (error) return json({ error: "No se pudo validar el ámbito equipo-temporada." }, 400);
    teamSeasonRows = data || [];
    if (teamSeasonRows.length !== requestedTeamSeasonIds.length) {
      return json({ error: "Existe algún ámbito equipo-temporada no válido." }, 400);
    }
    if (teamSeasonRows.some((row) => requestedTeamIds.length > 0 && !requestedTeamIds.includes(String(row.team_id)))) {
      return json({ error: "El ámbito equipo-temporada no coincide con los equipos asignados." }, 403);
    }
    if (callerRole === "ADMIN" && teamSeasonRows.some((row) => !actorTeamIds.has(String(row.team_id)))) {
      return json({ error: "El ámbito equipo-temporada está fuera del alcance del administrador." }, 403);
    }
  }

  const { data: existingProfile } = await adminClient
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile?.id) {
    return json({ error: "Ya existe un perfil con ese email." }, 409);
  }

  const cleanupProvisioning = async (userId: string) => {
    await adminClient.from("user_player_links").delete().eq("user_id", userId);
    await adminClient.from("team_season_memberships").delete().eq("user_id", userId);
    await adminClient.from("user_account_controls").delete().eq("user_id", userId);
    await adminClient.from("user_profiles").delete().eq("id", userId);
    await adminClient.auth.admin.deleteUser(userId);
  };

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName
    }
  });

  if (createError || !created?.user) {
    return json({ error: createError?.message || "No se pudo crear el usuario." }, 400);
  }

  const profilePayload = {
    id: created.user.id,
    email,
    first_name: firstName,
    last_name: lastName || null,
    role: requestedRole,
    global_role: requestedRole === "ADMIN" ? "ADMIN" : null,
    status: "approved",
    assigned_team_ids: requestedTeamIds,
    linked_player_id: linkedPlayer?.id || null
  };

  const { error: provisionProfileError } = await adminClient
    .from("user_profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (provisionProfileError) {
    await cleanupProvisioning(created.user.id);
    return json({ error: provisionProfileError.message }, 400);
  }

  if (linkedPlayer) {
    const { error: playerLinkError } = await adminClient
      .from("user_player_links")
      .upsert({
        user_id: created.user.id,
        player_id: linkedPlayer.id,
        relation_type: "SELF",
        status: "ACTIVE",
        valid_from: new Date().toISOString(),
        valid_until: null
      }, { onConflict: "user_id,player_id,relation_type" });

    if (playerLinkError) {
      await cleanupProvisioning(created.user.id);
      return json({ error: playerLinkError.message }, 400);
    }
  }

  if (teamSeasonRows.length > 0) {
    const membershipRows = teamSeasonRows.map((row) => ({
      user_id: created.user.id,
      team_season_id: row.id,
      function_role: requestedRole,
      status: "ACTIVE",
      valid_from: new Date().toISOString(),
      valid_until: null
    }));

    const { error: membershipError } = await adminClient
      .from("team_season_memberships")
      .upsert(membershipRows, { onConflict: "user_id,team_season_id,function_role" });

    if (membershipError) {
      await cleanupProvisioning(created.user.id);
      return json({ error: membershipError.message }, 400);
    }
  }

  return json({
    success: true,
    user: {
      id: created.user.id,
      email,
      role: requestedRole,
      global_role: profilePayload.global_role,
      assigned_team_ids: requestedTeamIds,
      linked_player_id: linkedPlayer?.id || null,
      team_season_ids: requestedTeamSeasonIds
    }
  });
});
