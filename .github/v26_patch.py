from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}\n---OLD---\n{old[:500]}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")

# Settings: compose the reusable Family controls into the existing User card.
replace_once(
    "views/TranslationsView.js",
    'import { TransferRequestService } from "../services/transfers/TransferRequestService.js";\n',
    'import { TransferRequestService } from "../services/transfers/TransferRequestService.js";\nimport { FamilyProfileControls } from "../components/admin/FamilyProfileControls.js";\n'
)
replace_once(
    "views/TranslationsView.js",
    '    const renderUserCardContent = (userProf) => {',
    '    const renderUserCardContent = (userProf, familyProfileControls = null) => {'
)
replace_once(
    "views/TranslationsView.js",
    '''          <form id="form-save-user-teams-assignment">\n            <h5 style="margin: 0 0 10px 0; font-size: 13px; color: #1e3a8a;">🛡️ EQUIPOS PERMITIDOS / ASIGNADOS:</h5>''',
    '''          ${userProf.role === UserRole.FAMILIA_TUTOR ? `\n            <div id="family-profile-controls-slot"></div>\n          ` : ''}\n\n          <form id="form-save-user-teams-assignment">\n            <h5 style="margin: 0 0 10px 0; font-size: 13px; color: #1e3a8a;">🛡️ EQUIPOS PERMITIDOS / ASIGNADOS:</h5>'''
)
replace_once(
    "views/TranslationsView.js",
    '''      modalContent.querySelectorAll(".btn-approve-join-req").forEach(btn => {''',
    '''      if (familyProfileControls) {\n        const familySlot = modalContent.querySelector("#family-profile-controls-slot");\n        if (familySlot) {\n          familySlot.innerHTML = familyProfileControls.render();\n          familyProfileControls.bind(familySlot);\n        }\n      }\n\n      modalContent.querySelectorAll(".btn-approve-join-req").forEach(btn => {'''
)
replace_once(
    "views/TranslationsView.js",
    '''    container.querySelectorAll(".btn-open-user-card").forEach(btn => {\n      btn.addEventListener("click", (e) => {\n        const email = e.currentTarget.getAttribute("data-email");\n        const userProf = this.profilesList.find(p => p.email === email);\n\n        if (userProf) {\n          const modal = container.querySelector("#modal-user-card");\n          if (modal) {\n            modal.style.display = "flex";\n            renderUserCardContent(userProf);\n          }\n        }\n      });\n    });''',
    '''    container.querySelectorAll(".btn-open-user-card").forEach(btn => {\n      btn.addEventListener("click", async (e) => {\n        const email = e.currentTarget.getAttribute("data-email");\n        const userProf = this.profilesList.find(p => p.email === email);\n\n        if (userProf) {\n          const modal = container.querySelector("#modal-user-card");\n          if (modal) {\n            modal.style.display = "flex";\n            let familyProfileControls = null;\n            if (userProf.role === UserRole.FAMILIA_TUTOR) {\n              familyProfileControls = new FamilyProfileControls(supabase);\n              try {\n                await familyProfileControls.load({\n                  userId: userProf.id,\n                  teamSeasonId: provisioningTeamSeasonId,\n                  players: teamPlayers\n                });\n              } catch (error) {\n                console.warn("[FamilyProfileV26] No se pudo cargar el perfil:", error.message);\n                alert(`❌ No se pudo cargar el perfil Family: ${error.message || error}`);\n                familyProfileControls = null;\n              }\n            }\n            renderUserCardContent(userProf, familyProfileControls);\n          }\n        }\n      });\n    });'''
)

# DataStore: one central presentation policy for Family identities.
replace_once(
    "services/DataStore.js",
    '''  getPlayerDirectory() {\n    return [...(this.players || [])];\n  }\n\n  getTeamPlayers(teamId = null) {''',
    '''  _familyIdentityPolicy() {\n    const user = this.permissionService?.getCurrentUser?.() || null;\n    if (String(user?.role || "").toUpperCase() !== UserRole.FAMILIA_TUTOR) return null;\n    const scope = user.familyAuthorizationScope || {};\n    return {\n      linkedPlayerIds: new Set((user.linkedPlayerIds || []).map(String)),\n      showOtherPlayerNames: scope.show_other_player_names !== false,\n      showOtherPlayerJerseys: scope.show_other_player_jerseys !== false\n    };\n  }\n\n  _applyFamilyIdentityPolicy(player) {\n    if (!player) return player;\n    const policy = this._familyIdentityPolicy();\n    if (!policy || policy.linkedPlayerIds.has(String(player.id))) return player;\n    if (policy.showOtherPlayerNames && policy.showOtherPlayerJerseys) return player;\n    return {\n      ...player,\n      ...(policy.showOtherPlayerNames ? {} : {\n        first_name: "Jugador", last_name: "", firstName: "Jugador", lastName: "",\n        name: "Jugador", full_name: "Jugador", fullName: "Jugador"\n      }),\n      ...(policy.showOtherPlayerJerseys ? {} : {\n        jersey: null, number: null, jersey_number: null, jerseyNumber: null\n      })\n    };\n  }\n\n  _applyFamilyIdentityPolicyList(players = []) {\n    return (players || []).map(player => this._applyFamilyIdentityPolicy(player));\n  }\n\n  getPlayerDirectory() {\n    return this._applyFamilyIdentityPolicyList(this.players || []);\n  }\n\n  getTeamPlayers(teamId = null) {'''
)
replace_once(
    "services/DataStore.js",
    '''    return [...filtered].sort(\n      (a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0)\n    );\n  }\n\n  _getRosterMembershipsForTeamSeason''',
    '''    return this._applyFamilyIdentityPolicyList([...filtered].sort(\n      (a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0)\n    ));\n  }\n\n  _getRosterMembershipsForTeamSeason'''
)
replace_once(
    "services/DataStore.js",
    '''    return memberships\n      .filter(membership => this._membershipEligibleOnDate(membership, effectiveDate))\n      .map(membership => {\n        const player = directoryById.get(String(membership.player_id || membership.playerId));\n        return player ? this._applyRosterMembership(player, membership) : null;\n      })\n      .filter(Boolean)\n      .sort((a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0));''',
    '''    return this._applyFamilyIdentityPolicyList(memberships\n      .filter(membership => this._membershipEligibleOnDate(membership, effectiveDate))\n      .map(membership => {\n        const player = directoryById.get(String(membership.player_id || membership.playerId));\n        return player ? this._applyRosterMembership(player, membership) : null;\n      })\n      .filter(Boolean)\n      .sort((a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0)));'''
)
replace_once(
    "services/DataStore.js",
    '''    return [...participants.values()].sort(\n      (a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0)\n    );''',
    '''    return this._applyFamilyIdentityPolicyList([...participants.values()].sort(\n      (a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0)\n    ));'''
)
replace_once(
    "services/DataStore.js",
    '''  getPlayerById(id) {\n    if (!id) return null;\n    return (this.players || []).find((p) => String(p.id) === String(id)) || null;\n  }''',
    '''  getPlayerById(id) {\n    if (!id) return null;\n    const player = (this.players || []).find((p) => String(p.id) === String(id)) || null;\n    return this._applyFamilyIdentityPolicy(player);\n  }'''
)

print("V26 frontend patch applied")
