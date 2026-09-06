/**
 * @fileoverview Carga el contexto de autorización v3 del usuario autenticado.
 * @description Convierte membresías relacionales en un contexto compacto para
 * PermissionService sin acoplar la lógica de autorización a Supabase.
 *
 * Durante la transición:
 * - team_season_memberships es la fuente v3 para alcance contextual;
 * - assigned_team_ids y linked_player_id se conservan como compatibilidad;
 * - no cambia todavía el rol funcional usado por ROLE_PERMISSIONS.
 */

import { GameCaptureDelegationService } from "../games/GameCaptureDelegationService.js";

function uniqueStrings(values = []) {
  return [...new Set(
    (values || [])
      .filter(value => value !== null && value !== undefined && value !== "")
      .map(String)
  )];
}

function arrayish(value) {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [value];
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  const unwrapped = raw.startsWith("{") && raw.endsWith("}")
    ? raw.slice(1, -1)
    : raw;
  return unwrapped.split(",").map(item => item.trim()).filter(Boolean);
}

function isFamilyProfile(profile = {}) {
  const role = String(profile.global_role ?? profile.role ?? "").trim().toUpperCase();
  return ["FAMILIA_TUTOR", "FAMILY", "FAMILIA", "TUTOR"].includes(role);
}

function isMissingFamilyScopeRpc(error) {
  const message = String(error?.message || "");
  return error?.code === "PGRST202" || message.includes("iq_v17_family_authorization_scope");
}

export class AuthorizationContextService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.gameCaptureDelegationService = new GameCaptureDelegationService(this.supabase);
  }

  async enrichProfile(profile = {}) {
    if (!this.supabase || !profile?.id) return profile;

    const legacyTeamIds = arrayish(profile.assigned_team_ids ?? profile.allowedTeamIds);
    const legacyLinkedPlayerIds = profile.linked_player_id
      ? [profile.linked_player_id]
      : [];

    const familyScopePromise = isFamilyProfile(profile)
      ? this.supabase.rpc("iq_v17_family_authorization_scope")
      : Promise.resolve({ data: null, error: null });

    const [membershipRes, playerLinksRes, familyScopeRes] = await Promise.all([
      this.supabase
        .from("team_season_memberships")
        .select("team_season_id,function_role,status,valid_from,valid_until")
        .eq("user_id", profile.id)
        .eq("status", "ACTIVE"),
      this.supabase
        .from("user_player_links")
        .select("player_id,relation_type,status,valid_from,valid_until")
        .eq("user_id", profile.id)
        .eq("status", "ACTIVE"),
      familyScopePromise
    ]);

    if (membershipRes.error) {
      console.warn("[AuthorizationContext] No se pudieron cargar membresías v3:", membershipRes.error.message);
    }
    if (playerLinksRes.error) {
      console.warn("[AuthorizationContext] No se pudieron cargar vínculos usuario-jugador:", playerLinksRes.error.message);
    }
    if (familyScopeRes.error && !isMissingFamilyScopeRpc(familyScopeRes.error)) {
      console.warn("[AuthorizationContext] No se pudo cargar el scope Family V17:", familyScopeRes.error.message);
    }

    const familyScope = familyScopeRes.error ? null : (familyScopeRes.data || null);
    const memberships = membershipRes.error ? [] : (membershipRes.data || []);
    const teamSeasonIds = uniqueStrings(memberships.map(m => m.team_season_id));

    let teamSeasonRows = [];
    if (teamSeasonIds.length > 0) {
      const { data, error } = await this.supabase
        .from("team_seasons")
        .select("id,team_id,season_id,status")
        .in("id", teamSeasonIds);

      if (error) {
        console.warn("[AuthorizationContext] No se pudieron resolver team_seasons:", error.message);
      } else {
        teamSeasonRows = data || [];
      }
    }

    const teamSeasonMap = new Map(
      teamSeasonRows.map(row => [String(row.id), row])
    );

    const contextualMemberships = memberships.map(membership => {
      const scope = teamSeasonMap.get(String(membership.team_season_id));
      return {
        teamSeasonId: membership.team_season_id,
        teamId: scope?.team_id || null,
        globalSeasonId: scope?.season_id || null,
        role: String(membership.function_role || "").toUpperCase(),
        status: String(membership.status || "").toUpperCase(),
        validFrom: membership.valid_from || null,
        validUntil: membership.valid_until || null
      };
    });

    const v3TeamIds = contextualMemberships
      .map(membership => membership.teamId)
      .filter(Boolean);
    const globalSeasonIds = contextualMemberships
      .map(membership => membership.globalSeasonId)
      .filter(Boolean);
    const linkedPlayerIds = (playerLinksRes.error ? [] : (playerLinksRes.data || []))
      .map(link => link.player_id)
      .filter(Boolean);
    const familyLinkedPlayerIds = Array.isArray(familyScope?.linked_player_ids) ? familyScope.linked_player_ids : [];
    const familyTeamIds = Array.isArray(familyScope?.allowed_team_ids) ? familyScope.allowed_team_ids : [];
    const familyTeamSeasonIds = Array.isArray(familyScope?.allowed_team_season_ids) ? familyScope.allowed_team_season_ids : [];
    const familyGlobalSeasonIds = Array.isArray(familyScope?.allowed_global_season_ids) ? familyScope.allowed_global_season_ids : [];
    const legacyAllowedSeasonIds = [
      ...arrayish(profile.allowedSeasonIds),
      ...arrayish(profile.allowed_season_ids)
    ];

    let gameDelegations = [];
    try {
      gameDelegations = await this.gameCaptureDelegationService.getMyDelegations();
    } catch (error) {
      console.warn("[AuthorizationContext] No se pudieron cargar delegaciones V21:", error.message);
    }

    return {
      ...profile,
      allowedTeamIds: uniqueStrings([...legacyTeamIds, ...v3TeamIds, ...familyTeamIds]),
      allowedSeasonIds: uniqueStrings([...legacyAllowedSeasonIds, ...familyGlobalSeasonIds]),
      allowedTeamSeasonIds: uniqueStrings([...teamSeasonIds, ...familyTeamSeasonIds]),
      allowedGlobalSeasonIds: uniqueStrings([...globalSeasonIds, ...familyGlobalSeasonIds]),
      linkedPlayerIds: uniqueStrings([...legacyLinkedPlayerIds, ...linkedPlayerIds, ...familyLinkedPlayerIds]),
      contextualMemberships,
      gameDelegations,
      familyAuthorizationScope: familyScope,
      authorizationModel: familyScope
        ? "V17_FAMILY_SCOPED"
        : memberships.length > 0 ? "V3_HYBRID" : "LEGACY_COMPAT"
    };
  }
}

export default AuthorizationContextService;
