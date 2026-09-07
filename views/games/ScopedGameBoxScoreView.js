/**
 * @fileoverview BoxScore entry that preserves the V21 resource boundary.
 * @description A user may also have read access to the surrounding team (for
 * example Family through a linked player). When EDIT_BOXSCORE comes from an
 * explicit game delegation, this view deliberately uses the scoped snapshot/RPC
 * even if the game already exists in DataStore, so capture never escalates to
 * broad EDIT_GAME persistence.
 */
import { GameBoxScoreView } from "../GameBoxScoreView.js";
import { Permission } from "../../security/PermissionService.js";

function hasActiveDelegation(auth, gameId, capability) {
  const user = auth?.getCurrentUser?.() || auth?.currentUser || null;
  const now = Date.now();
  return (user?.gameDelegations || []).some(item => {
    const id = item.gameId || item.game_id;
    const capabilities = Array.isArray(item.capabilities)
      ? item.capabilities.map(value => String(value || "").toUpperCase())
      : [String(item.capability || "").toUpperCase()].filter(Boolean);
    const from = Date.parse(item.validFrom || item.valid_from || "");
    const until = Date.parse(item.validUntil || item.valid_until || "");
    return String(id) === String(gameId)
      && capabilities.includes(String(capability).toUpperCase())
      && (!Number.isFinite(from) || from <= now)
      && (!Number.isFinite(until) || until > now)
      && !item.revokedAt
      && !item.revoked_at;
  });
}

export class ScopedGameBoxScoreView extends GameBoxScoreView {
  async render(containerId = "dashboard-content-area", targetGameId = null) {
    const delegatedActa = targetGameId
      && hasActiveDelegation(this.auth, targetGameId, Permission.EDIT_BOXSCORE);

    if (!delegatedActa) {
      return super.render(containerId, targetGameId);
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    this.games = [];
    this.players = [];
    this.gameStats = [];
    this.gameScopedSnapshot = null;
    this.isGameScopedOnly = false;

    try {
      await this._loadGameScopedSnapshot(targetGameId);
      this.selectedGameId = targetGameId;
      this._renderGameBoxScoreDetail(container, containerId);
    } catch (error) {
      container.innerHTML = `
        <div style="padding:24px;color:#991b1b;background:white;border:1px solid #fecaca;border-radius:12px;text-align:center;">
          <strong>No se pudo abrir este Acta / BoxScore.</strong>
          <div style="margin-top:6px;font-size:13px;">${String(error?.message || error)}</div>
        </div>`;
    }
  }
}

export default ScopedGameBoxScoreView;
