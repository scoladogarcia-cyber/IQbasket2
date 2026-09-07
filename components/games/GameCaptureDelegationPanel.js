/**
 * @fileoverview Resource-scoped delegation manager for one game.
 * @description UI only; all authorization, user lookup and audit writes remain in V21 RPCs.
 * The backend deliberately stores one row per capability. This panel groups rows
 * belonging to the same logical grant so the operator sees one access card per user/window.
 */

import { Permission } from "../../security/permissions.js";
import {
  DELEGATABLE_GAME_PERMISSIONS,
  GameCaptureDelegationService
} from "../../services/games/GameCaptureDelegationService.js";

const LABELS = Object.freeze({
  [Permission.RECORD_LIVE_GAME]: "En vivo · Play-by-play",
  [Permission.RECORD_QUICK_GAME]: "Marcación rápida",
  [Permission.EDIT_BOXSCORE]: "Acta / BoxScore",
  [Permission.PREPARE_GAME]: "Preparar partido",
  [Permission.START_GAME]: "Iniciar partido",
  [Permission.FINISH_GAME]: "Finalizar partido"
});

const CAPABILITY_ORDER = new Map(
  DELEGATABLE_GAME_PERMISSIONS.map((capability, index) => [capability, index])
);

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localDateTimeValue(date = new Date()) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function logicalGrantKey(row = {}) {
  return [
    row.delegate_user_id || row.delegateUserId || row.email || "",
    row.valid_from || row.validFrom || "",
    row.valid_until || row.validUntil || "",
    row.grant_note || row.grantNote || ""
  ].map(value => String(value ?? "")).join("|");
}

export class GameCaptureDelegationPanel {
  constructor(supabaseClient, authController) {
    this.auth = authController;
    this.service = new GameCaptureDelegationService(supabaseClient);
    this.activeGame = null;
    this.rows = [];
    this.portal = null;
  }

  _context(game = {}) {
    return {
      gameId: game.id || null,
      teamId: game.team_id || game.teamId || null,
      teamSeasonId: game.team_season_id || game.teamSeasonId || null,
      seasonId: game.season_id || game.seasonId || null
    };
  }

  canManage(game = {}) {
    const context = this._context(game);
    if (typeof this.auth?.canPreview === "function") {
      return Boolean(this.auth.canPreview(Permission.MANAGE_GAME_CAPTURE_DELEGATIONS, context));
    }
    if (typeof this.auth?.can === "function") {
      return Boolean(this.auth.can(Permission.MANAGE_GAME_CAPTURE_DELEGATIONS, context));
    }
    return false;
  }

  buttonMarkup(game = {}, { disabled = false } = {}) {
    if (!this.canManage(game)) return "";
    const isDisabled = disabled || String(game.edit_state || game.editState || "OPEN").toUpperCase() === "LOCKED";
    return `<button type="button" class="btn-manage-game-delegations" data-id="${escapeHtml(game.id)}" ${isDisabled ? "disabled" : ""} style="background:${isDisabled ? "#f1f5f9" : "#f5f3ff"};color:${isDisabled ? "#94a3b8" : "#6d28d9"};border:1px solid ${isDisabled ? "#cbd5e1" : "#c4b5fd"};padding:8px 12px;border-radius:8px;font-size:12px;font-weight:800;cursor:${isDisabled ? "not-allowed" : "pointer"};min-height:44px;">👤 Delegar captura</button>`;
  }

  bind(container, games = []) {
    container.querySelectorAll(".btn-manage-game-delegations").forEach(button => {
      button.addEventListener("click", async event => {
        const game = games.find(item => String(item.id) === String(event.currentTarget.dataset.id));
        if (!game || !this.canManage(game)) return;
        try {
          event.currentTarget.disabled = true;
          await this.open(game);
        } catch (error) {
          alert(`No se pudo abrir la delegación: ${error.message || error}`);
        } finally {
          event.currentTarget.disabled = false;
        }
      });
    });
  }

  async open(game) {
    this.activeGame = game;
    this.rows = await this.service.list(game.id);
    this._renderPortal();
  }

  close() {
    this.portal?.remove();
    this.portal = null;
    this.activeGame = null;
    this.rows = [];
  }

  _activeRows() {
    const now = Date.now();
    return this.rows.filter(row => !row.revoked_at && (!row.valid_until || Date.parse(row.valid_until) > now));
  }

  _historyRows() {
    const activeIds = new Set(this._activeRows().map(row => String(row.id)));
    return this.rows.filter(row => !activeIds.has(String(row.id)));
  }

  _groupRows(rows = []) {
    const groups = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const key = logicalGrantKey(row);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          ids: [],
          delegateUserId: row.delegate_user_id || row.delegateUserId || null,
          email: row.email || "",
          name: row.name || "",
          validFrom: row.valid_from || row.validFrom || null,
          validUntil: row.valid_until || row.validUntil || null,
          grantNote: row.grant_note || row.grantNote || null,
          revokeReason: row.revoke_reason || row.revokeReason || null,
          capabilities: []
        });
      }
      const group = groups.get(key);
      if (row.id) group.ids.push(String(row.id));
      const capability = String(row.capability || "").toUpperCase();
      if (capability && !group.capabilities.includes(capability)) group.capabilities.push(capability);
      if (!group.revokeReason && (row.revoke_reason || row.revokeReason)) {
        group.revokeReason = row.revoke_reason || row.revokeReason;
      }
    });

    return [...groups.values()].map(group => ({
      ...group,
      capabilities: [...group.capabilities].sort((a, b) =>
        (CAPABILITY_ORDER.get(a) ?? 999) - (CAPABILITY_ORDER.get(b) ?? 999)
      )
    }));
  }

  _capabilityOptions() {
    const defaults = new Set([
      Permission.RECORD_LIVE_GAME,
      Permission.RECORD_QUICK_GAME,
      Permission.EDIT_BOXSCORE,
      Permission.PREPARE_GAME,
      Permission.START_GAME,
      Permission.FINISH_GAME
    ]);
    return DELEGATABLE_GAME_PERMISSIONS.map(capability => `
      <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;">
        <input type="checkbox" class="delegation-capability" value="${capability}" ${defaults.has(capability) ? "checked" : ""} style="width:18px;height:18px;" />
        <span style="font-size:12px;font-weight:700;color:#334155;">${LABELS[capability] || capability}</span>
      </label>
    `).join("");
  }

  _groupMarkup(group, active) {
    const name = escapeHtml(group.name || group.email || "Usuario");
    const email = escapeHtml(group.email || "");
    const until = group.validUntil ? new Date(group.validUntil).toLocaleString() : "-";
    const capabilityBadges = group.capabilities.map(capability => `
      <span style="display:inline-flex;align-items:center;border-radius:999px;background:#eef2ff;color:#3730a3;padding:4px 7px;font-size:10px;font-weight:800;">${escapeHtml(LABELS[capability] || capability)}</span>
    `).join("");
    return `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;padding:11px 12px;border:1px solid ${active ? "#bbf7d0" : "#e2e8f0"};border-radius:10px;background:${active ? "#f0fdf4" : "#f8fafc"};">
        <div style="min-width:220px;flex:1;">
          <strong style="display:block;font-size:12px;color:#0f172a;">${name}${email && email !== name ? ` · ${email}` : ""}</strong>
          <span style="display:block;font-size:11px;color:#475569;margin-top:2px;">Acceso temporal · hasta ${escapeHtml(until)}</span>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;">${capabilityBadges}</div>
          ${group.revokeReason ? `<span style="display:block;font-size:10px;color:#991b1b;margin-top:5px;">${escapeHtml(group.revokeReason)}</span>` : ""}
        </div>
        ${active ? `<button type="button" class="btn-revoke-game-delegation" data-ids="${escapeHtml(group.ids.join(","))}" style="min-height:44px;border:1px solid #fca5a5;border-radius:8px;background:#fff1f2;color:#be123c;padding:8px 12px;font-size:11px;font-weight:800;cursor:pointer;">Revocar acceso</button>` : '<span style="font-size:10px;font-weight:800;color:#64748b;">Finalizado</span>'}
      </div>
    `;
  }

  _renderPortal() {
    this.portal?.remove();
    if (!this.activeGame) return;

    const activeGroups = this._groupRows(this._activeRows());
    const historyGroups = this._groupRows(this._historyRows());
    const defaultUntil = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const portal = document.createElement("div");
    portal.id = "game-capture-delegation-portal";
    portal.innerHTML = `
      <div class="game-delegation-overlay" style="position:fixed;inset:0;z-index:1000000;background:rgba(15,23,42,.78);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:max(12px,env(safe-area-inset-top,0px)) 12px max(18px,env(safe-area-inset-bottom,0px));box-sizing:border-box;">
        <section role="dialog" aria-modal="true" aria-labelledby="delegation-title" style="width:min(720px,100%);max-height:calc(100dvh - 28px);overflow:auto;margin:auto;background:#fff;border-radius:16px;padding:18px;box-sizing:border-box;box-shadow:0 18px 50px rgba(0,0,0,.35);">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px;">
            <div>
              <h2 id="delegation-title" style="margin:0;font-size:18px;font-weight:900;color:#0f172a;">Delegar captura de partido</h2>
              <p style="margin:4px 0 0;font-size:12px;color:#64748b;">vs ${escapeHtml(this.activeGame.opponent || "Rival")} · puedes conceder cada modo de captura por separado.</p>
            </div>
            <button type="button" id="btn-close-game-delegation" aria-label="Cerrar" style="border:0;background:#f1f5f9;border-radius:8px;min-width:44px;min-height:44px;font-size:18px;cursor:pointer;">✕</button>
          </div>

          <form id="game-delegation-form" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px;">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
              <label style="font-size:11px;font-weight:800;color:#475569;">USUARIO EXISTENTE
                <input type="email" id="delegation-email" required autocomplete="email" placeholder="usuario@correo.com" style="display:block;width:100%;min-height:44px;margin-top:5px;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;box-sizing:border-box;font-size:13px;" />
              </label>
              <label style="font-size:11px;font-weight:800;color:#475569;">CADUCA
                <input type="datetime-local" id="delegation-valid-until" required value="${localDateTimeValue(defaultUntil)}" style="display:block;width:100%;min-height:44px;margin-top:5px;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;box-sizing:border-box;font-size:13px;" />
              </label>
            </div>
            <div style="margin-top:12px;">
              <span style="display:block;font-size:11px;font-weight:800;color:#475569;margin-bottom:6px;">CAPACIDADES INDEPENDIENTES</span>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px;">${this._capabilityOptions()}</div>
            </div>
            <label style="display:block;margin-top:12px;font-size:11px;font-weight:800;color:#475569;">NOTA INTERNA
              <textarea id="delegation-note" maxlength="1000" rows="2" placeholder="Ej. Anotador del partido del sábado" style="display:block;width:100%;margin-top:5px;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;box-sizing:border-box;font-size:13px;resize:vertical;"></textarea>
            </label>
            <div style="display:flex;justify-content:flex-end;margin-top:12px;">
              <button type="submit" id="btn-grant-game-delegation" style="min-height:44px;border:0;border-radius:9px;background:#6d28d9;color:#fff;padding:10px 16px;font-size:12px;font-weight:900;cursor:pointer;">Conceder acceso temporal</button>
            </div>
          </form>

          <div>
            <h3 style="margin:0 0 8px;font-size:13px;font-weight:900;color:#166534;">Activas (${activeGroups.length})</h3>
            <div style="display:grid;gap:7px;">${activeGroups.length ? activeGroups.map(group => this._groupMarkup(group, true)).join("") : '<div style="padding:10px;color:#64748b;font-size:12px;border:1px dashed #cbd5e1;border-radius:9px;">No hay accesos delegados activos.</div>'}</div>
          </div>
          ${historyGroups.length ? `<details style="margin-top:14px;"><summary style="font-size:12px;font-weight:800;color:#64748b;cursor:pointer;">Historial (${historyGroups.length})</summary><div style="display:grid;gap:7px;margin-top:8px;">${historyGroups.map(group => this._groupMarkup(group, false)).join("")}</div></details>` : ""}
        </section>
      </div>`;
    document.body.appendChild(portal);
    this.portal = portal;
    this._bindPortal();
  }

  _bindPortal() {
    this.portal?.querySelector("#btn-close-game-delegation")?.addEventListener("click", () => this.close());
    this.portal?.querySelector(".game-delegation-overlay")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) this.close();
    });

    this.portal?.querySelector("#game-delegation-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const email = this.portal.querySelector("#delegation-email")?.value || "";
      const untilValue = this.portal.querySelector("#delegation-valid-until")?.value || "";
      const note = this.portal.querySelector("#delegation-note")?.value || "";
      const capabilities = [...this.portal.querySelectorAll(".delegation-capability:checked")].map(input => input.value);
      if (!untilValue) return;
      const validUntil = new Date(untilValue);
      if (!Number.isFinite(validUntil.getTime()) || validUntil.getTime() <= Date.now()) {
        alert("La caducidad debe ser posterior a la hora actual.");
        return;
      }
      const submit = this.portal.querySelector("#btn-grant-game-delegation");
      try {
        if (submit) submit.disabled = true;
        this.rows = await this.service.grant({
          gameId: this.activeGame.id,
          email,
          capabilities,
          validUntil: validUntil.toISOString(),
          note
        });
        this._renderPortal();
      } catch (error) {
        alert(`No se pudo conceder la delegación: ${error.message || error}`);
        if (submit) submit.disabled = false;
      }
    });

    this.portal?.querySelectorAll(".btn-revoke-game-delegation").forEach(button => {
      button.addEventListener("click", async event => {
        const delegationIds = String(event.currentTarget.dataset.ids || "").split(",").filter(Boolean);
        if (!delegationIds.length) return;
        if (!confirm("¿Revocar este acceso temporal y todas sus capacidades?")) return;
        const reason = prompt("Motivo de revocación (opcional):", "Acceso ya no necesario");
        if (reason === null) return;
        try {
          event.currentTarget.disabled = true;
          for (const delegationId of delegationIds) {
            await this.service.revoke({ delegationId, reason });
          }
          this.rows = await this.service.list(this.activeGame.id);
          this._renderPortal();
        } catch (error) {
          alert(`No se pudo revocar: ${error.message || error}`);
          event.currentTarget.disabled = false;
        }
      });
    });
  }
}

export default GameCaptureDelegationPanel;
