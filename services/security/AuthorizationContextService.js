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

function uniqueStrings(values = []) {
  return [...new Set(
    (values || [])
      .filter(value => value !== null && value !== undefined && value !== "")
      .map(String)
  )];
}

export class AuthorizationContextService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async enrichProfile(profile = {}) {
    if (!this.supabase || !profile?.id) return profile;

    const legacyTeamIds = Array.isArray(profile.assigned_team_ids)
      ? profile.assigned_team_ids
      : [];
    const legacyLinkedPlayerIds = profile.linked_player_id
      ? [profile.linked_player_id]
      : [];

    const [membershipRes, playerLinksRes] = await Promise.all([
      this.supabase
        .from("team_season_memberships")
        .select("team_season_id,function_role,status,valid_from,valid_until")
        .eq("user_id", profile.id)
        .eq("status", "ACTIVE"),
      this.supabase
        .from("user_player_links")
        .select("player_id,relation_type,status,valid_from,valid_until")
        .eq("user_id", profile.id)
        .eq("status", "ACTIVE")
    ]);

    if (membershipRes.error) {
      console.warn("[AuthorizationContext] No se pudieron cargar membresías v3:", membershipRes.error.message);
    }
    if (playerLinksRes.error) {
      console.warn("[AuthorizationContext] No se pudieron cargar vínculos usuario-jugador:", playerLinksRes.error.message);
    }

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

    return {
      ...profile,
      allowedTeamIds: uniqueStrings([...legacyTeamIds, ...v3TeamIds]),
      allowedTeamSeasonIds: uniqueStrings(teamSeasonIds),
      allowedGlobalSeasonIds: uniqueStrings(globalSeasonIds),
      linkedPlayerIds: uniqueStrings([...legacyLinkedPlayerIds, ...linkedPlayerIds]),
      contextualMemberships,
      authorizationModel: memberships.length > 0 ? "V3_HYBRID" : "LEGACY_COMPAT"
    };
  }
}

export default AuthorizationContextService;
