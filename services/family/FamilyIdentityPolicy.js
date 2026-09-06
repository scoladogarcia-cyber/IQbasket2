/**
 * @fileoverview Pure Family/Tutor player identity presentation policy.
 * @description Applies only presentation masking already authorized by backend ABAC.
 * This module performs no IO and has no browser, Supabase or global-state dependency.
 */

/**
 * Builds the presentation policy for a Family/Tutor user.
 * Missing preferences preserve the historical default: identities remain visible.
 * @param {Object|null} user
 * @returns {{linkedPlayerIds:Set<string>,showOtherPlayerNames:boolean,showOtherPlayerJerseys:boolean}|null}
 */
export function buildFamilyIdentityPolicy(user = null) {
  if (String(user?.role || "").toUpperCase() !== "FAMILIA_TUTOR") return null;

  const scope = user.familyAuthorizationScope || {};
  const linked = user.linkedPlayerIds
    || scope.linked_player_ids
    || scope.linkedPlayerIds
    || [];
  const namesPreference = scope.show_other_player_names ?? scope.showOtherPlayerNames;
  const jerseysPreference = scope.show_other_player_jerseys ?? scope.showOtherPlayerJerseys;

  return {
    linkedPlayerIds: new Set((Array.isArray(linked) ? linked : []).map(String)),
    showOtherPlayerNames: namesPreference === undefined ? true : namesPreference !== false,
    showOtherPlayerJerseys: jerseysPreference === undefined ? true : jerseysPreference !== false
  };
}

/**
 * Applies a Family presentation policy to one player record without mutating it.
 * Linked players always preserve their identity regardless of the preferences.
 * @param {Object|null} player
 * @param {Object|null} policy
 * @returns {Object|null}
 */
export function applyFamilyIdentityPolicy(player, policy = null) {
  if (!player || !policy || policy.linkedPlayerIds.has(String(player.id))) return player;
  if (policy.showOtherPlayerNames && policy.showOtherPlayerJerseys) return player;

  return {
    ...player,
    ...(policy.showOtherPlayerNames ? {} : {
      first_name: "Jugador",
      last_name: "",
      firstName: "Jugador",
      lastName: "",
      name: "Jugador",
      full_name: "Jugador",
      fullName: "Jugador"
    }),
    ...(policy.showOtherPlayerJerseys ? {} : {
      jersey: null,
      number: null,
      jersey_number: null,
      jerseyNumber: null
    })
  };
}

/**
 * Applies a Family presentation policy to a collection without mutating the input array.
 * @param {Array<Object>} players
 * @param {Object|null} policy
 * @returns {Array<Object>}
 */
export function applyFamilyIdentityPolicyList(players = [], policy = null) {
  return (Array.isArray(players) ? players : []).map(player =>
    applyFamilyIdentityPolicy(player, policy)
  );
}
