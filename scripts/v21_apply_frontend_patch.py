from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8", newline="\n")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


def patch_role_block(text, start_marker, end_marker, permission):
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    block = text[start:end]
    if permission in block:
        return text
    old = "    Permission.EDIT_BOXSCORE,\n"
    if block.count(old) != 1:
        raise RuntimeError(f"role block {start_marker}: EDIT_BOXSCORE marker mismatch")
    block = block.replace(old, old + f"    {permission},\n", 1)
    return text[:start] + block + text[end:]


# -----------------------------------------------------------------------------
# RBAC catalogue
# -----------------------------------------------------------------------------
p = "security/permissions.js"
t = read(p)
t = replace_once(
    t,
    '  REVIEW_GAME_LOCK_REQUESTS: "REVIEW_GAME_LOCK_REQUESTS",\n  VIEW_BOXSCORE:',
    '  REVIEW_GAME_LOCK_REQUESTS: "REVIEW_GAME_LOCK_REQUESTS",\n  MANAGE_GAME_CAPTURE_DELEGATIONS: "MANAGE_GAME_CAPTURE_DELEGATIONS",\n  VIEW_BOXSCORE:',
    p,
)
t = patch_role_block(t, "  [UserRole.ADMIN]: [", "  [UserRole.ENTRENADOR]: [", "Permission.MANAGE_GAME_CAPTURE_DELEGATIONS")
t = patch_role_block(t, "  [UserRole.ENTRENADOR]: [", "  [UserRole.ANALISTA]: [", "Permission.MANAGE_GAME_CAPTURE_DELEGATIONS")
write(p, t)

# -----------------------------------------------------------------------------
# PermissionService: per-game delegated capabilities without changing role.
# -----------------------------------------------------------------------------
p = "security/PermissionService.js"
t = read(p)
old = '''        : [],
      playerId: user.playerId ?? user.player_id ?? user.linked_player_id ?? null,'''
new = '''        : [],
      gameDelegations: Array.isArray(user.gameDelegations)
        ? user.gameDelegations.map((delegation) => ({
            ...delegation,
            gameId: delegation.gameId ?? delegation.game_id ?? null,
            capabilities: parseArray(delegation.capabilities),
            validUntil: delegation.validUntil ?? delegation.valid_until ?? null
          }))
        : [],
      playerId: user.playerId ?? user.player_id ?? user.linked_player_id ?? null,'''
t = replace_once(t, old, new, p)

marker = '''  can(permissionKey, context = {}) {
    if (!this.isAccountActive()) return false;'''
helper = '''  _hasGameDelegatedPermission(permissionKey, context = {}) {
    const gameId = context?.gameId ? String(context.gameId) : "";
    if (!gameId || !Array.isArray(this.currentUser?.gameDelegations)) return false;

    const normalizedPermission = LEGACY_PERMISSION_ALIASES[permissionKey] || permissionKey;
    const now = Date.now();
    return this.currentUser.gameDelegations.some((delegation) => {
      if (String(delegation.gameId || "") !== gameId) return false;
      if (delegation.validUntil && Date.parse(delegation.validUntil) <= now) return false;
      const capabilities = parseArray(delegation.capabilities).map(value => String(value).toUpperCase());
      if (capabilities.includes(normalizedPermission)) return true;
      return normalizedPermission === Permission.VIEW_BOXSCORE
        && capabilities.includes(Permission.EDIT_BOXSCORE);
    });
  }

  can(permissionKey, context = {}) {
    if (!this.isAccountActive()) return false;'''
t = replace_once(t, marker, helper, p)

t = replace_once(
    t,
    '''    const normalizedPermission = LEGACY_PERMISSION_ALIASES[permissionKey] || permissionKey;
    const role = this.getRoleForContext(context);
    const allowed = ROLE_PERMISSIONS[role] || [];''',
    '''    const normalizedPermission = LEGACY_PERMISSION_ALIASES[permissionKey] || permissionKey;
    if (this._hasGameDelegatedPermission(normalizedPermission, context)) return true;
    const role = this.getRoleForContext(context);
    const allowed = ROLE_PERMISSIONS[role] || [];''',
    p + ":can",
)
t = replace_once(
    t,
    '''    const normalizedPermission = LEGACY_PERMISSION_ALIASES[permissionKey] || permissionKey;
    const role = this.getRoleForContext(context, { preview: true });
    const allowed = ROLE_PERMISSIONS[role] || [];''',
    '''    const normalizedPermission = LEGACY_PERMISSION_ALIASES[permissionKey] || permissionKey;
    if (this._hasGameDelegatedPermission(normalizedPermission, context)) return true;
    const role = this.getRoleForContext(context, { preview: true });
    const allowed = ROLE_PERMISSIONS[role] || [];''',
    p + ":canPreview",
)
write(p, t)

# -----------------------------------------------------------------------------
# Authorization context: load active V21 grants with missing-RPC compatibility.
# -----------------------------------------------------------------------------
p = "services/security/AuthorizationContextService.js"
t = read(p)
t = replace_once(
    t,
    ''' */

function uniqueStrings''',
    ''' */

import { GameCaptureDelegationService } from "../games/GameCaptureDelegationService.js";

function uniqueStrings''',
    p + ":import",
)
t = replace_once(
    t,
    '''  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }''',
    '''  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.gameCaptureDelegationService = new GameCaptureDelegationService(this.supabase);
  }''',
    p + ":constructor",
)
t = replace_once(
    t,
    '''    const legacyAllowedSeasonIds = [
      ...arrayish(profile.allowedSeasonIds),
      ...arrayish(profile.allowed_season_ids)
    ];

    return {''',
    '''    const legacyAllowedSeasonIds = [
      ...arrayish(profile.allowedSeasonIds),
      ...arrayish(profile.allowed_season_ids)
    ];

    let gameDelegations = [];
    try {
      gameDelegations = await this.gameCaptureDelegationService.getMyDelegations();
    } catch (error) {
      console.warn("[AuthorizationContext] No se pudieron cargar delegaciones V21:", error.message);
    }

    return {''',
    p + ":load",
)
t = replace_once(
    t,
    '''      linkedPlayerIds: uniqueStrings([...legacyLinkedPlayerIds, ...linkedPlayerIds, ...familyLinkedPlayerIds]),
      contextualMemberships,
      familyAuthorizationScope: familyScope,''',
    '''      linkedPlayerIds: uniqueStrings([...legacyLinkedPlayerIds, ...linkedPlayerIds, ...familyLinkedPlayerIds]),
      contextualMemberships,
      gameDelegations,
      familyAuthorizationScope: familyScope,''',
    p + ":return",
)
write(p, t)

# -----------------------------------------------------------------------------
# Router: gameId becomes first-class authorization context.
# -----------------------------------------------------------------------------
p = "index.js"
t = read(p)
t = replace_once(
    t,
    '''    const routeContext = {
      teamId: this.teamId || DataStore.getActiveTeamId?.() || null,
      teamSeasonId: DataStore.getActiveTeamSeasonId?.() || null,
      playerId: routePlayerId,
      playerTeamId: this.teamId || DataStore.getActiveTeamId?.() || null
    };''',
    '''    const routeGameId = [
      "live", "hud", "live-hud", "easy-entry", "easy", "entrada-facil", "live-entry",
      "boxscore", "registro"
    ].includes(targetRoute)
      ? parts[1] || null
      : null;
    const routeContext = {
      teamId: this.teamId || DataStore.getActiveTeamId?.() || null,
      teamSeasonId: DataStore.getActiveTeamSeasonId?.() || null,
      playerId: routePlayerId,
      playerTeamId: this.teamId || DataStore.getActiveTeamId?.() || null,
      gameId: routeGameId
    };''',
    p + ":routeContext",
)
write(p, t)

print("V21 core authorization patch OK")
