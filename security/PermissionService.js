/**
 * @fileoverview Servicio central de autorización RBAC + alcance de recursos.
 * @description La autorización real usa SIEMPRE el rol autenticado. La simulación
 * de rol solo sirve para previsualizar la interfaz de SUPERADMIN.
 */

import {
  UserRole,
  UNIQUE_SUPERADMIN_EMAIL,
  normalizeEmail,
  normalizeRole,
  canonicalRoleName,
  isUniqueSuperadmin
} from "./roles.js";
import {
  Permission,
  ROLE_PERMISSIONS,
  AI_MONTHLY_LIMITS
} from "./permissions.js";

const LEGACY_PERMISSION_ALIASES = Object.freeze({
  EDIT_PLAY_BY_PLAY: Permission.EDIT_GAME,
  VALIDATE_CHANGE_REQUESTS: Permission.APPROVE_TEAM_ACCESS,
  VIEW_REPORTS: Permission.GENERATE_REPORT,
  EXPORT_REPORTS: Permission.EXPORT_REPORT,
  VIEW_TEAM_STATS: Permission.VIEW_ADVANCED_TEAM_STATS,
  VIEW_ALL_PLAYER_STATS: Permission.VIEW_ADVANCED_PLAYER_STATS,
  MANAGE_USERS: Permission.VIEW_USERS,
  CREATE_PLAYER: Permission.MANAGE_ROSTER,
  EDIT_PLAYER: Permission.MANAGE_ROSTER,
  DELETE_PLAYER: Permission.MANAGE_ROSTER,
  CREATE_TEAM: Permission.MANAGE_TEAMS,
  EDIT_TEAM: Permission.MANAGE_TEAMS,
  DELETE_TEAM: Permission.MANAGE_TEAMS
});

function parseArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [String(value)];
    } catch {
      return value.split(",").map(v => v.trim()).filter(Boolean);
    }
  }
  return [];
}

export class PermissionService {
  constructor(currentUser = null) {
    this.currentUser = null;
    this.previewRole = null;
    this.teamClubMap = new Map();
    if (currentUser) this.setCurrentUser(currentUser);
  }

  setCurrentUser(user) {
    if (!user) {
      this.currentUser = null;
      this.previewRole = null;
      return null;
    }

    const email = normalizeEmail(user.email);
    const role = normalizeRole(user.role, email);
    this.currentUser = {
      ...user,
      id: user.id || user.user_id || null,
      email,
      role,
      globalRole: String(user.globalRole ?? user.global_role ?? "").trim().toUpperCase() || null,
      clubId: user.clubId ?? user.club_id ?? null,
      allowedTeamIds: parseArray(
        user.allowedTeamIds
          ?? user.assigned_team_ids
          ?? user.allowed_team_ids
          ?? user.team_ids
          ?? (user.team_id ? [user.team_id] : [])
      ),
      allowedSeasonIds: parseArray(
        user.allowedSeasonIds ?? user.allowed_season_ids ?? user.season_ids ?? []
      ),
      playerId: user.playerId ?? user.player_id ?? user.linked_player_id ?? null,
      linkedPlayerIds: parseArray(
        user.linkedPlayerIds
          ?? user.linked_player_ids
          ?? user.player_ids
          ?? (user.linked_player_id ? [user.linked_player_id] : [])
      ),
      status: String(user.status || "Activo")
    };

    // La cuenta maestra es siempre el único SUPERADMIN de la aplicación.
    if (isUniqueSuperadmin(email)) {
      this.currentUser.role = UserRole.SUPERADMIN;
    }

    return this.currentUser;
  }

  clear() {
    this.currentUser = null;
    this.previewRole = null;
    this.teamClubMap.clear();
  }

  setTeamCatalog(teams = []) {
    this.teamClubMap.clear();
    (teams || []).forEach((team) => {
      if (!team?.id) return;
      this.teamClubMap.set(
        String(team.id),
        String(team.club_id ?? team.clubId ?? "")
      );
    });
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getAuthenticatedRole() {
    return this.currentUser?.role || UserRole.INVITADO;
  }

  getEffectiveRole() {
    if (this.getAuthenticatedRole() === UserRole.SUPERADMIN && this.previewRole) {
      return this.previewRole;
    }
    return this.getAuthenticatedRole();
  }

  isAuthenticated() {
    return Boolean(this.currentUser?.id || this.currentUser?.email);
  }

  isAdmin() {
    return [UserRole.SUPERADMIN, UserRole.ADMIN].includes(this.getAuthenticatedRole());
  }

  isScout() {
    return [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ENTRENADOR, UserRole.ANALISTA]
      .includes(this.getAuthenticatedRole());
  }

  hasRole(roleOrRoles, { preview = true } = {}) {
    const currentRole = preview ? this.getEffectiveRole() : this.getAuthenticatedRole();
    const targets = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    return targets.some(role => canonicalRoleName(role) === currentRole);
  }

  can(permissionKey, context = {}) {
    const normalizedPermission = LEGACY_PERMISSION_ALIASES[permissionKey] || permissionKey;
    const role = this.getAuthenticatedRole();
    const allowed = ROLE_PERMISSIONS[role] || [];
    if (!allowed.includes(normalizedPermission)) return false;
    return this._passesScope(context);
  }

  canPreview(permissionKey, context = {}) {
    const normalizedPermission = LEGACY_PERMISSION_ALIASES[permissionKey] || permissionKey;
    const role = this.getEffectiveRole();
    const allowed = ROLE_PERMISSIONS[role] || [];
    if (!allowed.includes(normalizedPermission)) return false;
    return this._passesScope(context, { preview: true });
  }

  getAiMonthlyLimit({ preview = false } = {}) {
    const role = preview ? this.getEffectiveRole() : this.getAuthenticatedRole();
    return AI_MONTHLY_LIMITS[role] ?? 0;
  }

  setPreviewRole(role) {
    if (this.getAuthenticatedRole() !== UserRole.SUPERADMIN) return false;
    this.previewRole = canonicalRoleName(role);
    return true;
  }

  clearPreviewRole() {
    this.previewRole = null;
  }

  canAccessClub(clubId) {
    if (!clubId || !this.currentUser) return false;
    if (this.getAuthenticatedRole() === UserRole.SUPERADMIN) return true;
    return String(this.currentUser.clubId || "") === String(clubId);
  }

  canAccessTeam(teamId) {
    if (!teamId || !this.currentUser) return false;
    const role = this.getAuthenticatedRole();
    if (role === UserRole.SUPERADMIN) return true;

    if (role === UserRole.ADMIN && this.currentUser.clubId) {
      const teamClubId = this.teamClubMap.get(String(teamId));
      if (teamClubId && teamClubId === String(this.currentUser.clubId)) return true;
    }

    return this.currentUser.allowedTeamIds.includes(String(teamId));
  }

  canAccessSeason(seasonId) {
    if (!seasonId || !this.currentUser) return false;
    if (this.getAuthenticatedRole() === UserRole.SUPERADMIN) return true;
    if (this.currentUser.allowedSeasonIds.length === 0) return true;
    return this.currentUser.allowedSeasonIds.includes(String(seasonId));
  }

  canAccessPlayer(playerId, playerTeamId = null) {
    if (!playerId || !this.currentUser) return false;
    const role = this.getAuthenticatedRole();
    if (role === UserRole.SUPERADMIN) return true;

    if (role === UserRole.JUGADOR) {
      return String(this.currentUser.playerId || "") === String(playerId);
    }

    if (role === UserRole.FAMILIA_TUTOR) {
      return this.currentUser.linkedPlayerIds.includes(String(playerId));
    }

    if (playerTeamId) return this.canAccessTeam(playerTeamId);
    return false;
  }

  canAssignRole(targetRole, targetEmail = "") {
    const requestedRole = canonicalRoleName(targetRole);
    const targetIsUniqueSuperadmin = isUniqueSuperadmin(targetEmail);

    // La intención de asignar SUPERADMIN se valida antes de cualquier normalización.
    if (requestedRole === UserRole.SUPERADMIN) {
      return targetIsUniqueSuperadmin
        && this.getAuthenticatedRole() === UserRole.SUPERADMIN;
    }

    // La cuenta maestra no puede degradarse a otro rol.
    if (targetIsUniqueSuperadmin) return false;

    if (requestedRole === UserRole.ADMIN) {
      return this.can(Permission.ASSIGN_PRIVILEGED_ROLES);
    }

    return this.can(Permission.ASSIGN_STANDARD_ROLES);
  }

  _passesScope(context = {}) {
    if (!context || Object.keys(context).length === 0) return true;
    if (context.clubId && !this.canAccessClub(context.clubId)) return false;
    if (context.teamId && !this.canAccessTeam(context.teamId)) return false;
    if (context.seasonId && !this.canAccessSeason(context.seasonId)) return false;
    if (context.playerId && !this.canAccessPlayer(context.playerId, context.playerTeamId || context.teamId)) return false;
    return true;
  }
}

export { Permission, UserRole, UNIQUE_SUPERADMIN_EMAIL };
export default PermissionService;
