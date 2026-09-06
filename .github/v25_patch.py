from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}\n---OLD---\n{old[:400]}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")

# 1) Player Nutrition navigation: route self-service to own Player 360 instead of a dead general module.
replace_once(
    "views/LayoutView.js",
    """    const myPlayerFallback = isFamilyRole ? 'Mis jugadores' : 'Mi desarrollo';\n\n    const navGroups = [""",
    """    const myPlayerFallback = isFamilyRole ? 'Mis jugadores' : 'Mi desarrollo';\n    const delegatedGames = Array.isArray(currentUser?.gameDelegations) ? currentUser.gameDelegations : [];\n    const firstDelegatedGame = delegatedGames.find(item => item?.gameId);\n    const delegatedCapabilities = new Set((firstDelegatedGame?.capabilities || []).map(value => String(value).toUpperCase()));\n    const delegatedGameRoute = firstDelegatedGame?.gameId\n      ? (delegatedCapabilities.has(Permission.EDIT_BOXSCORE)\n        ? `boxscore/${firstDelegatedGame.gameId}`\n        : `easy-entry/${firstDelegatedGame.gameId}`)\n      : null;\n    const gamesRoute = isFamilyCentricRole && delegatedGameRoute && !(currentUser?.allowedTeamIds || []).length\n      ? delegatedGameRoute\n      : 'games';\n    const playerNutritionRoute = isPlayerSelfRole && ownPlayerId ? `player360/${ownPlayerId}` : 'nutrition';\n    const playerNutritionRestricted = isPlayerSelfRole && ownPlayerId ? false : isNutritionRestricted;\n\n    const navGroups = ["""
)
replace_once(
    "views/LayoutView.js",
    """          { key: \"games\", labelKey: \"games\", fallback: \"Partidos\", route: \"games\", svg:""",
    """          { key: \"games\", labelKey: \"games\", fallback: \"Partidos\", route: gamesRoute, svg:"""
)
replace_once(
    "views/LayoutView.js",
    """            route: \"nutrition\",\n            disabled: isNutritionRestricted,""",
    """            route: playerNutritionRoute,\n            disabled: playerNutritionRestricted,"""
)
replace_once(
    "views/LayoutView.js",
    """          <a href=\"#/games\" class=\"mobile-nav-item ${currentActiveKey === 'games' ? 'active' : ''}\" data-route-key=\"games\">""",
    """          <a href=\"#/${gamesRoute}\" class=\"mobile-nav-item ${['games','easy-entry','boxscore'].includes(currentActiveKey) ? 'active' : ''}\" data-route-key=\"games\">"""
)
replace_once(
    "views/LayoutView.js",
    """              <a href=\"${isNutritionRestricted ? 'javascript:void(0);' : '#/nutrition'}\" class=\"drawer-item ${isNutritionRestricted ? 'disabled-link' : ''}\" data-route-key=\"nutrition\">\n                <span class=\"drawer-icon\">🥤</span>\n                <span>${LayoutView.t(\"player360.nutrition.nav\", \"Nutrición\")}${isNutritionRestricted ? ' 🔒' : ''}</span>""",
    """              <a href=\"${playerNutritionRestricted ? 'javascript:void(0);' : '#/' + playerNutritionRoute}\" class=\"drawer-item ${playerNutritionRestricted ? 'disabled-link' : ''}\" data-route-key=\"nutrition\">\n                <span class=\"drawer-icon\">🥤</span>\n                <span>${LayoutView.t(\"player360.nutrition.nav\", \"Nutrición\")}${playerNutritionRestricted ? ' 🔒' : ''}</span>"""
)

# 2) Delegated Easy Entry must carry the exact game scope into PermissionService.
replace_once(
    "views/EasyStatsEntryView.js",
    """    return Boolean(this.authController?.canPreview?.(Permission.RECORD_LIVE_GAME, { teamId, teamSeasonId }));""",
    """    return Boolean(this.authController?.canPreview?.(Permission.RECORD_LIVE_GAME, {\n      gameId: game?.id || this.gameId || null, teamId, teamSeasonId\n    }));"""
)
replace_once(
    "views/EasyStatsEntryView.js",
    """    return Boolean(this.authController?.canPreview?.(Permission.EDIT_BOXSCORE, { teamId, teamSeasonId }));""",
    """    return Boolean(this.authController?.canPreview?.(Permission.EDIT_BOXSCORE, {\n      gameId: game?.id || this.gameId || null, teamId, teamSeasonId\n    }));"""
)

# 3) Returned Nutrition scales stay constrained to their original 1..5 catalog semantics.
replace_once(
    "views/player360/PlayerSubmissionPanel.js",
    """            if (typeof value === \"number\") {\n              return `<label>${esc(label)}\n                <input class=\"psub-wellness-value\" data-metric-code=\"${esc(code)}\" data-value-kind=\"NUMBER\" type=\"number\" step=\"any\" value=\"${esc(value)}\" required>\n              </label>`;\n            }""",
    """            if (typeof value === \"number\") {\n              const scale15 = [\"HYDRATION_ADHERENCE\", \"MEAL_REGULARITY\"].includes(code.toUpperCase());\n              if (scale15) {\n                return `<label>${esc(label)}\n                  <select class=\"psub-wellness-value\" data-metric-code=\"${esc(code)}\" data-value-kind=\"NUMBER\" required>\n                    ${[1,2,3,4,5].map(option => `<option value=\"${option}\" ${Number(value) === option ? \"selected\" : \"\"}>${option}</option>`).join(\"\")}\n                  </select>\n                </label>`;\n              }\n              return `<label>${esc(label)}\n                <input class=\"psub-wellness-value\" data-metric-code=\"${esc(code)}\" data-value-kind=\"NUMBER\" type=\"number\" step=\"any\" value=\"${esc(value)}\" required>\n              </label>`;\n            }"""
)

# 4) Present one delegated access package instead of five rows, while retaining granular backend capabilities.
replace_once(
    "components/games/GameCaptureDelegationPanel.js",
    """  _historyRows() {\n    const activeIds = new Set(this._activeRows().map(row => String(row.id)));\n    return this.rows.filter(row => !activeIds.has(String(row.id)));\n  }\n\n  _capabilityOptions() {""",
    """  _historyRows() {\n    const activeIds = new Set(this._activeRows().map(row => String(row.id)));\n    return this.rows.filter(row => !activeIds.has(String(row.id)));\n  }\n\n  _groupRows(rows = []) {\n    const groups = new Map();\n    (rows || []).forEach(row => {\n      const principal = row.delegate_user_id || row.email || row.name || 'delegate';\n      const key = [principal, row.valid_until || '', row.granted_at || ''].join('|');\n      if (!groups.has(key)) groups.set(key, { ...row, rows: [], capabilities: [] });\n      const group = groups.get(key);\n      group.rows.push(row);\n      if (row.capability && !group.capabilities.includes(row.capability)) group.capabilities.push(row.capability);\n    });\n    return [...groups.values()];\n  }\n\n  _capabilityOptions() {"""
)
replace_once(
    "components/games/GameCaptureDelegationPanel.js",
    """  _rowMarkup(row, active) {\n    const name = escapeHtml(row.name || row.email || \"Usuario\");\n    const email = escapeHtml(row.email || \"\");\n    const label = escapeHtml(LABELS[row.capability] || row.capability || \"Capacidad\");\n    const until = row.valid_until ? new Date(row.valid_until).toLocaleString() : \"-\";\n    return `\n      <div style=\"display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid ${active ? \"#bbf7d0\" : \"#e2e8f0\"};border-radius:10px;background:${active ? \"#f0fdf4\" : \"#f8fafc\"};\">\n        <div style=\"min-width:220px;flex:1;\">\n          <strong style=\"display:block;font-size:12px;color:#0f172a;\">${name}${email && email !== name ? ` · ${email}` : \"\"}</strong>\n          <span style=\"display:block;font-size:11px;color:#475569;margin-top:2px;\">${label} · hasta ${escapeHtml(until)}</span>\n          ${row.revoke_reason ? `<span style=\"display:block;font-size:10px;color:#991b1b;margin-top:2px;\">${escapeHtml(row.revoke_reason)}</span>` : \"\"}\n        </div>\n        ${active ? `<button type=\"button\" class=\"btn-revoke-game-delegation\" data-id=\"${escapeHtml(row.id)}\" style=\"min-height:40px;border:1px solid #fca5a5;border-radius:8px;background:#fff1f2;color:#be123c;padding:8px 10px;font-size:11px;font-weight:800;cursor:pointer;\">Revocar</button>` : '<span style=\"font-size:10px;font-weight:800;color:#64748b;\">Finalizada</span>'}\n      </div>\n    `;\n  }""",
    """  _rowMarkup(group, active) {\n    const name = escapeHtml(group.name || group.email || \"Usuario\");\n    const email = escapeHtml(group.email || \"\");\n    const labels = (group.capabilities || []).map(capability => LABELS[capability] || capability).join(' · ');\n    const until = group.valid_until ? new Date(group.valid_until).toLocaleString() : \"-\";\n    const ids = (group.rows || []).map(row => row.id).filter(Boolean).join(',');\n    const revokeReason = (group.rows || []).map(row => row.revoke_reason).find(Boolean);\n    return `\n      <div style=\"display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid ${active ? \"#bbf7d0\" : \"#e2e8f0\"};border-radius:10px;background:${active ? \"#f0fdf4\" : \"#f8fafc\"};\">\n        <div style=\"min-width:220px;flex:1;\">\n          <strong style=\"display:block;font-size:12px;color:#0f172a;\">${name}${email && email !== name ? ` · ${email}` : \"\"}</strong>\n          <span style=\"display:block;font-size:11px;color:#475569;margin-top:2px;line-height:1.45;\">${escapeHtml(labels || 'Acceso al partido')} · hasta ${escapeHtml(until)}</span>\n          ${revokeReason ? `<span style=\"display:block;font-size:10px;color:#991b1b;margin-top:2px;\">${escapeHtml(revokeReason)}</span>` : \"\"}\n        </div>\n        ${active ? `<button type=\"button\" class=\"btn-revoke-game-delegation\" data-ids=\"${escapeHtml(ids)}\" style=\"min-height:40px;border:1px solid #fca5a5;border-radius:8px;background:#fff1f2;color:#be123c;padding:8px 10px;font-size:11px;font-weight:800;cursor:pointer;\">Revocar acceso</button>` : '<span style=\"font-size:10px;font-weight:800;color:#64748b;\">Finalizada</span>'}\n      </div>\n    `;\n  }"""
)
replace_once(
    "components/games/GameCaptureDelegationPanel.js",
    """    const active = this._activeRows();\n    const history = this._historyRows();""",
    """    const active = this._groupRows(this._activeRows());\n    const history = this._groupRows(this._historyRows());"""
)
replace_once(
    "components/games/GameCaptureDelegationPanel.js",
    """        const delegationId = event.currentTarget.dataset.id;\n        if (!confirm(\"¿Revocar esta capacidad delegada?\")) return;\n        const reason = prompt(\"Motivo de revocación (opcional):\", \"Acceso ya no necesario\");\n        if (reason === null) return;\n        try {\n          event.currentTarget.disabled = true;\n          this.rows = await this.service.revoke({ delegationId, reason });\n          this._renderPortal();""",
    """        const delegationIds = String(event.currentTarget.dataset.ids || '').split(',').filter(Boolean);\n        if (!delegationIds.length) return;\n        if (!confirm(\"¿Revocar este acceso delegado al partido?\")) return;\n        const reason = prompt(\"Motivo de revocación (opcional):\", \"Acceso ya no necesario\");\n        if (reason === null) return;\n        try {\n          event.currentTarget.disabled = true;\n          for (const delegationId of delegationIds) {\n            await this.service.revoke({ delegationId, reason });\n          }\n          this.rows = await this.service.list(this.activeGame.id);\n          this._renderPortal();"""
)

# 5) Family workspace: make delegated games useful even before a player relationship exists.
replace_once(
    "views/family/FamilyWorkspaceView.js",
    """  _emptyWorkspace() {\n    return `<section class=\"family-workspace\"><header class=\"family-hero\"><div>\n      <p class=\"family-eyebrow\">IQBasket Family</p><h1>Tu jugador, toda su trayectoria</h1>\n      <p>Vincula un jugador mediante una invitación verificada del club para empezar.</p>\n    </div></header>${this._claimPanel()}</section>`;\n  }""",
    """  _delegatedGamesPanel() {\n    const delegations = Array.isArray(this.auth?.getCurrentUser?.()?.gameDelegations)\n      ? this.auth.getCurrentUser().gameDelegations\n      : [];\n    if (!delegations.length) return \"\";\n    const cards = delegations.map(item => {\n      const capabilities = new Set((item.capabilities || []).map(value => String(value).toUpperCase()));\n      const route = capabilities.has(Permission.EDIT_BOXSCORE)\n        ? `boxscore/${item.gameId}`\n        : `easy-entry/${item.gameId}`;\n      const label = [item.opponent ? `vs ${item.opponent}` : 'Partido asignado', item.date].filter(Boolean).join(' · ');\n      return `<a class=\"family-wellness-link\" href=\"#/${escapeHtml(route)}\">🏀 ${escapeHtml(label)}</a>`;\n    }).join('');\n    return `<section class=\"family-card\"><div class=\"family-card-head\"><div><p class=\"family-eyebrow\">Acceso temporal</p><h2>Partidos que te han delegado</h2><p>Este acceso sólo sirve para los partidos indicados y no da acceso al resto del equipo.</p></div></div>${cards}</section>`;\n  }\n  _emptyWorkspace() {\n    return `<section class=\"family-workspace\"><header class=\"family-hero\"><div>\n      <p class=\"family-eyebrow\">IQBasket Family</p><h1>Tu jugador, toda su trayectoria</h1>\n      <p>El club todavía no ha vinculado jugadores a esta cuenta. Si tienes un partido delegado puedes acceder a él desde abajo.</p>\n    </div></header>${this._delegatedGamesPanel()}${this._claimPanel()}</section>`;\n  }"""
)

# 6) Central family identity masking based on V25 preferences.
replace_once(
    "services/DataStore.js",
    """  getPlayerDirectory() {\n    return [...(this.players || [])];\n  }\n\n  getTeamPlayers(teamId = null) {""",
    """  _applyFamilyIdentityPolicy(player) {\n    if (!player) return player;\n    const user = this.permissionService?.getCurrentUser?.() || null;\n    if (String(user?.role || '').toUpperCase() !== UserRole.FAMILIA_TUTOR) return player;\n    const linked = new Set((user?.linkedPlayerIds || []).map(String));\n    if (linked.has(String(player.id))) return player;\n    const scope = user?.familyAuthorizationScope || {};\n    const showNames = scope.show_other_player_names !== false;\n    const showJerseys = scope.show_other_player_jerseys !== false;\n    if (showNames && showJerseys) return player;\n    return {\n      ...player,\n      ...(showNames ? {} : { first_name: 'Jugador', last_name: '', firstName: 'Jugador', lastName: '', name: 'Jugador' }),\n      ...(showJerseys ? {} : { jersey: null, number: null })\n    };\n  }\n\n  _applyFamilyIdentityPolicyList(players = []) {\n    return (players || []).map(player => this._applyFamilyIdentityPolicy(player));\n  }\n\n  getPlayerDirectory() {\n    return this._applyFamilyIdentityPolicyList(this.players || []);\n  }\n\n  getTeamPlayers(teamId = null) {"""
)
replace_once(
    "services/DataStore.js",
    """    return [...filtered].sort(\n      (a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0)\n    );\n  }""",
    """    return this._applyFamilyIdentityPolicyList([...filtered].sort(\n      (a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0)\n    ));\n  }"""
)
replace_once(
    "services/DataStore.js",
    """    return memberships\n      .filter(membership => this._membershipEligibleOnDate(membership, effectiveDate))\n      .map(membership => {\n        const player = directoryById.get(String(membership.player_id || membership.playerId));\n        return player ? this._applyRosterMembership(player, membership) : null;\n      })\n      .filter(Boolean)\n      .sort((a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0));""",
    """    return this._applyFamilyIdentityPolicyList(memberships\n      .filter(membership => this._membershipEligibleOnDate(membership, effectiveDate))\n      .map(membership => {\n        const player = directoryById.get(String(membership.player_id || membership.playerId));\n        return player ? this._applyRosterMembership(player, membership) : null;\n      })\n      .filter(Boolean)\n      .sort((a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0)));"""
)
replace_once(
    "services/DataStore.js",
    """    return [...participants.values()].sort(\n      (a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0)\n    );""",
    """    return this._applyFamilyIdentityPolicyList([...participants.values()].sort(\n      (a, b) => (Number(a.jersey) || 0) - (Number(b.jersey) || 0)\n    ));"""
)
replace_once(
    "services/DataStore.js",
    """    return (this.players || []).find((p) => String(p.id) === String(id)) || null;""",
    """    const player = (this.players || []).find((p) => String(p.id) === String(id)) || null;\n    return this._applyFamilyIdentityPolicy(player);"""
)

# 7) Admin/SUPERADMIN family profile editor in Users: multi-player links + name/jersey visibility.
replace_once(
    "views/TranslationsView.js",
    """    const renderUserCardContent = (userProf) => {""",
    """    const renderUserCardContent = (userProf, familyConfig = null) => {"""
)
replace_once(
    "views/TranslationsView.js",
    """          <form id=\"form-save-user-teams-assignment\">\n            <h5 style=\"margin: 0 0 10px 0; font-size: 13px; color: #1e3a8a;\">🛡️ EQUIPOS PERMITIDOS / ASIGNADOS:</h5>""",
    """          ${userProf.role === UserRole.FAMILIA_TUTOR ? `\n          <form id=\"form-save-family-profile-config\" style=\"background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px;\">\n            <h5 style=\"margin:0 0 8px;font-size:13px;color:#1e3a8a;\">👪 JUGADORES VINCULADOS · FAMILIA</h5>\n            ${provisioningTeamSeasonId ? `<div style=\"display:grid;gap:7px;max-height:220px;overflow:auto;\">${teamPlayers.map(player => {\n              const checked = (familyConfig?.player_ids || []).map(String).includes(String(player.id));\n              return `<label style=\"display:flex;align-items:center;gap:8px;font-size:12px;\"><input type=\"checkbox\" class=\"chk-family-player\" value=\"${player.id}\" ${checked ? 'checked' : ''}> <span>#${player.jersey ?? '-'} · ${player.first_name || ''} ${player.last_name || ''}</span></label>`;\n            }).join('')}</div>` : '<div class=\"read-only-banner\">Selecciona primero equipo y temporada activa para gestionar jugadores de esta familia.</div>'}\n            <div style=\"display:grid;gap:8px;margin-top:12px;\">\n              <label style=\"display:flex;align-items:center;gap:8px;font-size:12px;\"><input type=\"checkbox\" id=\"family-show-other-names\" ${familyConfig?.show_other_player_names !== false ? 'checked' : ''}> Ver nombres de otros jugadores</label>\n              <label style=\"display:flex;align-items:center;gap:8px;font-size:12px;\"><input type=\"checkbox\" id=\"family-show-other-jerseys\" ${familyConfig?.show_other_player_jerseys !== false ? 'checked' : ''}> Ver dorsales de otros jugadores</label>\n            </div>\n            <div style=\"margin-top:12px;text-align:right;\"><button type=\"submit\" class=\"btn-primary\" ${provisioningTeamSeasonId ? '' : 'disabled'}>💾 Guardar perfil Family</button></div>\n          </form>` : ''}\n\n          <form id=\"form-save-user-teams-assignment\">\n            <h5 style=\"margin: 0 0 10px 0; font-size: 13px; color: #1e3a8a;\">🛡️ EQUIPOS PERMITIDOS / ASIGNADOS:</h5>"""
)
replace_once(
    "views/TranslationsView.js",
    """      modalContent.querySelector(\"#form-save-user-teams-assignment\")?.addEventListener(\"submit\", async (e) => {""",
    """      modalContent.querySelector(\"#form-save-family-profile-config\")?.addEventListener(\"submit\", async (e) => {\n        e.preventDefault();\n        if (!provisioningTeamSeasonId) return;\n        const playerIds = [...modalContent.querySelectorAll('.chk-family-player:checked')].map(input => input.value);\n        const showNames = Boolean(modalContent.querySelector('#family-show-other-names')?.checked);\n        const showJerseys = Boolean(modalContent.querySelector('#family-show-other-jerseys')?.checked);\n        try {\n          const { data, error } = await supabase.rpc('iq_v25_save_family_profile_config', {\n            p_user_id: userProf.id,\n            p_team_season_id: provisioningTeamSeasonId,\n            p_player_ids: playerIds,\n            p_show_other_player_names: showNames,\n            p_show_other_player_jerseys: showJerseys\n          });\n          if (error) throw error;\n          alert('✅ Perfil Family actualizado. Los cambios de jugadores y visibilidad se aplicarán al refrescar la sesión de esa cuenta.');\n          renderUserCardContent(userProf, data || familyConfig);\n        } catch (err) {\n          alert(`❌ No se pudo guardar el perfil Family: ${err.message || err}`);\n        }\n      });\n\n      modalContent.querySelector(\"#form-save-user-teams-assignment\")?.addEventListener(\"submit\", async (e) => {"""
)
replace_once(
    "views/TranslationsView.js",
    """    container.querySelectorAll(\".btn-open-user-card\").forEach(btn => {\n      btn.addEventListener(\"click\", (e) => {\n        const email = e.currentTarget.getAttribute(\"data-email\");\n        const userProf = this.profilesList.find(p => p.email === email);\n\n        if (userProf) {\n          const modal = container.querySelector(\"#modal-user-card\");\n          if (modal) {\n            modal.style.display = \"flex\";\n            renderUserCardContent(userProf);\n          }\n        }\n      });\n    });""",
    """    container.querySelectorAll(\".btn-open-user-card\").forEach(btn => {\n      btn.addEventListener(\"click\", async (e) => {\n        const email = e.currentTarget.getAttribute(\"data-email\");\n        const userProf = this.profilesList.find(p => p.email === email);\n\n        if (userProf) {\n          const modal = container.querySelector(\"#modal-user-card\");\n          if (modal) {\n            modal.style.display = \"flex\";\n            let familyConfig = null;\n            if (userProf.role === UserRole.FAMILIA_TUTOR && provisioningTeamSeasonId) {\n              const { data, error } = await supabase.rpc('iq_v25_get_family_profile_config', {\n                p_user_id: userProf.id,\n                p_team_season_id: provisioningTeamSeasonId\n              });\n              if (!error) familyConfig = data || null;\n              else console.warn('[FamilyProfileV25] No se pudo cargar configuración:', error.message);\n            }\n            renderUserCardContent(userProf, familyConfig);\n          }\n        }\n      });\n    });"""
)

print('V25 patch applied successfully')
