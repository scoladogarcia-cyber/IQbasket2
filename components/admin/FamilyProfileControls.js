/**
 * @fileoverview Reusable administrative Family profile controls.
 * @description Renders multi-player guardian links and identity-display preferences.
 * Authorization and persistence remain in FamilyProfileAdminService + V26 RPCs.
 */

import { FamilyProfileAdminService } from "../../services/family/FamilyProfileAdminService.js";

function esc(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function playerLabel(player = {}) {
  const name = (
    player.name
    || [player.first_name, player.last_name].filter(Boolean).join(" ")
    || [player.firstName, player.lastName].filter(Boolean).join(" ")
    || "Jugador"
  ).trim();
  const jersey = player.jersey ?? player.number ?? "—";
  return `#${jersey} · ${name}`;
}

export class FamilyProfileControls {
  constructor(supabaseClient = null) {
    this.service = new FamilyProfileAdminService(supabaseClient);
    this.config = null;
    this.userId = null;
    this.teamSeasonId = null;
    this.players = [];
  }

  async load({ userId, teamSeasonId, players = [] }) {
    this.userId = userId || null;
    this.teamSeasonId = teamSeasonId || null;
    this.players = Array.isArray(players) ? players : [];
    this.config = this.teamSeasonId
      ? await this.service.getConfig({ userId: this.userId, teamSeasonId: this.teamSeasonId })
      : null;
    return this.config;
  }

  render() {
    if (!this.teamSeasonId) {
      return `<section class="family-profile-controls family-profile-controls-empty">
        <strong>👪 Perfil Family</strong>
        <p>Selecciona un equipo y una temporada activa para asignar jugadores a esta familia.</p>
      </section>`;
    }

    const linked = new Set((this.config?.playerIds || []).map(String));
    const playersMarkup = this.players.length
      ? this.players.map(player => `
          <label class="family-profile-player-option">
            <input type="checkbox" class="family-profile-player" value="${esc(player.id)}" ${linked.has(String(player.id)) ? "checked" : ""}>
            <span>${esc(playerLabel(player))}</span>
          </label>`).join("")
      : `<div class="family-profile-empty-list">No hay jugadores disponibles en la plantilla activa.</div>`;

    return `<section class="family-profile-controls" data-family-profile-controls>
      <style>
        .family-profile-controls{background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:14px;display:grid;gap:12px}
        .family-profile-controls h5{margin:0;font-size:13px;color:#1e3a8a}.family-profile-controls p{margin:3px 0 0;color:#64748b;font-size:11px;line-height:1.45}
        .family-profile-player-list{display:grid;gap:7px;max-height:230px;overflow:auto;padding:2px}
        .family-profile-player-option{display:flex;align-items:center;gap:9px;padding:9px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:9px;font-size:12px;font-weight:700;color:#334155;min-height:44px}
        .family-profile-player-option input,.family-profile-toggle input{width:19px;height:19px;flex:0 0 auto}
        .family-profile-privacy{border-top:1px solid #e2e8f0;padding-top:10px;display:grid;gap:8px}.family-profile-toggle{display:flex;align-items:flex-start;gap:9px;font-size:12px;font-weight:700;color:#334155}
        .family-profile-toggle small{display:block;color:#64748b;font-weight:500;margin-top:2px;line-height:1.35}.family-profile-actions{display:flex;justify-content:flex-end}
        .family-profile-save{min-height:44px;border:0;border-radius:9px;background:#1e3a8a;color:#fff;font-weight:900;padding:9px 14px;cursor:pointer}.family-profile-save:disabled{opacity:.55;cursor:wait}
        .family-profile-status{font-size:11px;min-height:16px}.family-profile-status.ok{color:#166534}.family-profile-status.error{color:#991b1b}
        .family-profile-controls-empty{color:#64748b}.family-profile-empty-list{padding:12px;border:1px dashed #cbd5e1;border-radius:9px;color:#64748b;font-size:11px}
        @media(max-width:640px){.family-profile-actions{display:grid}.family-profile-save{width:100%}.family-profile-player-list{max-height:280px}}
      </style>
      <div>
        <h5>👪 JUGADORES VINCULADOS · FAMILIA</h5>
        <p>Puedes vincular uno o varios jugadores de esta plantilla. El vínculo se valida y audita en backend.</p>
      </div>
      <div class="family-profile-player-list">${playersMarkup}</div>
      <div class="family-profile-privacy">
        <label class="family-profile-toggle">
          <input type="checkbox" id="family-show-other-names" ${this.config?.showOtherPlayerNames !== false ? "checked" : ""}>
          <span>Mostrar nombres de otros jugadores<small>Los jugadores vinculados a esta familia conservan siempre su identidad.</small></span>
        </label>
        <label class="family-profile-toggle">
          <input type="checkbox" id="family-show-other-jerseys" ${this.config?.showOtherPlayerJerseys !== false ? "checked" : ""}>
          <span>Mostrar dorsales de otros jugadores<small>Esta preferencia es independiente de los nombres.</small></span>
        </label>
      </div>
      <div class="family-profile-status" role="status" aria-live="polite"></div>
      <div class="family-profile-actions"><button type="button" class="family-profile-save">💾 Guardar perfil Family</button></div>
    </section>`;
  }

  bind(container, { onSaved = null } = {}) {
    const root = container?.querySelector?.("[data-family-profile-controls]");
    if (!root || !this.teamSeasonId || !this.userId) return;
    const button = root.querySelector(".family-profile-save");
    const status = root.querySelector(".family-profile-status");
    button?.addEventListener("click", async () => {
      const playerIds = [...root.querySelectorAll(".family-profile-player:checked")].map(input => input.value);
      const showOtherPlayerNames = Boolean(root.querySelector("#family-show-other-names")?.checked);
      const showOtherPlayerJerseys = Boolean(root.querySelector("#family-show-other-jerseys")?.checked);
      if (button) button.disabled = true;
      if (status) { status.className = "family-profile-status"; status.textContent = "Guardando…"; }
      try {
        this.config = await this.service.saveConfig({
          userId: this.userId,
          teamSeasonId: this.teamSeasonId,
          playerIds,
          showOtherPlayerNames,
          showOtherPlayerJerseys
        });
        if (status) { status.className = "family-profile-status ok"; status.textContent = "✅ Perfil Family actualizado."; }
        if (typeof onSaved === "function") await onSaved(this.config);
      } catch (error) {
        if (status) { status.className = "family-profile-status error"; status.textContent = `❌ ${error.message || error}`; }
      } finally {
        if (button) button.disabled = false;
      }
    });
  }
}

export default FamilyProfileControls;
