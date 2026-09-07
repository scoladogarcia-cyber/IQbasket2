/**
 * @fileoverview Reusable administrative Family profile controls.
 * @description Renders multi-player guardian links, profile-level identity
 * preferences and the verified invitation-code flow. Authorization and
 * persistence remain server-side in V26/V8 RPC boundaries.
 */

import { FamilyProfileAdminService } from "../../services/family/FamilyProfileAdminService.js";
import { FamilyWorkspaceService } from "../../services/family/FamilyWorkspaceService.js";

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

/**
 * Shared component styles.
 * Keeping them outside the conditional render branches guarantees that both the
 * configured and empty states remain readable inside desktop and mobile modals.
 */
function renderStyles() {
  return `<style>
    .family-profile-controls{background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:14px;display:grid;gap:14px;color:#334155}
    .family-profile-controls h5{margin:0;font-size:13px;color:#1e3a8a}.family-profile-controls p{margin:3px 0 0;color:#64748b;font-size:11px;line-height:1.45}
    .family-profile-player-list{display:grid;gap:7px;max-height:230px;overflow:auto;padding:2px}
    .family-profile-player-option{display:flex;align-items:center;gap:9px;padding:9px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:9px;font-size:12px;font-weight:700;color:#334155;min-height:44px}
    .family-profile-player-option input,.family-profile-toggle input{width:19px;height:19px;flex:0 0 auto}
    .family-profile-privacy{border-top:1px solid #e2e8f0;padding-top:10px;display:grid;gap:8px}.family-profile-toggle{display:flex;align-items:flex-start;gap:9px;font-size:12px;font-weight:700;color:#334155}
    .family-profile-toggle small{display:block;color:#64748b;font-weight:500;margin-top:2px;line-height:1.35}.family-profile-actions{display:flex;justify-content:flex-end}
    .family-profile-save,.family-invite-generate,.family-invite-copy{min-height:44px;border:0;border-radius:9px;font-weight:900;padding:9px 14px;cursor:pointer}.family-profile-save,.family-invite-generate{background:#1e3a8a;color:#fff}.family-invite-copy{background:#fff;color:#1e3a8a;border:1px solid #93c5fd}
    .family-profile-save:disabled,.family-invite-generate:disabled,.family-invite-copy:disabled{opacity:.55;cursor:wait}
    .family-profile-status,.family-invite-status{font-size:11px;min-height:16px}.family-profile-status.ok,.family-invite-status.ok{color:#166534}.family-profile-status.error,.family-invite-status.error{color:#991b1b}
    .family-profile-controls-empty{color:#334155}.family-profile-controls-empty strong{color:#1e3a8a}.family-profile-empty-list{padding:12px;border:1px dashed #cbd5e1;border-radius:9px;color:#64748b;font-size:11px}
    .family-invite-panel{border-top:1px solid #cbd5e1;padding-top:12px;display:grid;gap:9px}.family-invite-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.family-invite-panel label{display:grid;gap:4px;font-size:11px;font-weight:800;color:#475569}.family-invite-panel input,.family-invite-panel select{width:100%;min-height:42px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;padding:8px 10px;font:inherit}
    .family-invite-result{display:none;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;gap:8px}.family-invite-result.visible{display:grid}.family-invite-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:800;word-break:break-all;color:#1e3a8a;background:#fff;border:1px dashed #93c5fd;border-radius:8px;padding:9px}
    .family-invite-note{padding:9px 10px;border-radius:9px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:11px;line-height:1.45}
    @media(max-width:640px){.family-profile-actions,.family-invite-grid{display:grid;grid-template-columns:1fr}.family-profile-save,.family-invite-generate,.family-invite-copy{width:100%}.family-profile-player-list{max-height:280px}}
  </style>`;
}

export class FamilyProfileControls {
  constructor(supabaseClient = null) {
    this.service = new FamilyProfileAdminService(supabaseClient);
    this.invitationService = new FamilyWorkspaceService(supabaseClient);
    this.config = null;
    this.userId = null;
    this.teamSeasonId = null;
    this.players = [];
    this.lastInvitation = null;
  }

  async load({ userId, teamSeasonId, players = [] }) {
    this.userId = userId || null;
    this.teamSeasonId = teamSeasonId || null;
    this.players = Array.isArray(players) ? players : [];
    this.lastInvitation = null;
    this.config = this.teamSeasonId
      ? await this.service.getConfig({ userId: this.userId, teamSeasonId: this.teamSeasonId })
      : null;
    return this.config;
  }

  _invitationPanel() {
    const playerOptions = this.players.length
      ? this.players.map(player => `<option value="${esc(player.id)}">${esc(playerLabel(player))}</option>`).join("")
      : "";

    return `<section class="family-invite-panel" aria-labelledby="family-invite-title">
      <div>
        <h5 id="family-invite-title">✉️ CÓDIGO DE INVITACIÓN FAMILY</h5>
        <p>Alternativa a la asignación directa: genera un código de un solo uso para que la familia vincule por sí misma un jugador.</p>
      </div>
      <div class="family-invite-note">Por privacidad, esta acción está validada también en backend y sólo funciona para perfiles administrativos autorizados. Delegar la anotación de un partido no crea un vínculo familiar.</div>
      <div class="family-invite-grid">
        <label>Jugador
          <select class="family-invite-player" ${this.players.length ? "" : "disabled"}>
            <option value="">Selecciona un jugador</option>${playerOptions}
          </select>
        </label>
        <label>Email de la familia
          <input class="family-invite-email" type="email" inputmode="email" autocomplete="email" placeholder="familia@ejemplo.com">
        </label>
      </div>
      <button type="button" class="family-invite-generate" ${this.players.length ? "" : "disabled"}>Generar código de invitación</button>
      <div class="family-invite-status" role="status" aria-live="polite"></div>
      <div class="family-invite-result" data-family-invite-result>
        <strong>Código para entregar a la familia</strong>
        <div class="family-invite-code" data-family-invite-code></div>
        <small data-family-invite-expiry></small>
        <button type="button" class="family-invite-copy">Copiar código</button>
      </div>
    </section>`;
  }

  render() {
    const styles = renderStyles();

    if (!this.teamSeasonId) {
      return `<section class="family-profile-controls family-profile-controls-empty" data-family-profile-controls-empty>
        ${styles}
        <strong>👪 Perfil Family</strong>
        <p>Selecciona un equipo y una temporada activa para asignar jugadores a esta familia o generar una invitación.</p>
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
      ${styles}
      <div>
        <h5>👪 JUGADORES VINCULADOS · FAMILIA</h5>
        <p>Marca uno o varios jugadores y guarda para crear o revocar sus vínculos de tutor de forma auditada.</p>
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
      ${this._invitationPanel()}
    </section>`;
  }

  _bindProfileSave(root, { onSaved = null } = {}) {
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

  _bindInvitation(root) {
    const button = root.querySelector(".family-invite-generate");
    const copyButton = root.querySelector(".family-invite-copy");
    const playerSelect = root.querySelector(".family-invite-player");
    const emailInput = root.querySelector(".family-invite-email");
    const status = root.querySelector(".family-invite-status");
    const result = root.querySelector("[data-family-invite-result]");
    const codeNode = root.querySelector("[data-family-invite-code]");
    const expiryNode = root.querySelector("[data-family-invite-expiry]");

    button?.addEventListener("click", async () => {
      const playerId = String(playerSelect?.value || "").trim();
      const email = String(emailInput?.value || "").trim().toLowerCase();
      if (!playerId) {
        if (status) { status.className = "family-invite-status error"; status.textContent = "Selecciona un jugador."; }
        playerSelect?.focus?.();
        return;
      }
      if (!email || !email.includes("@")) {
        if (status) { status.className = "family-invite-status error"; status.textContent = "Introduce un email válido."; }
        emailInput?.focus?.();
        return;
      }

      button.disabled = true;
      if (status) { status.className = "family-invite-status"; status.textContent = "Generando invitación segura…"; }
      try {
        this.lastInvitation = await this.invitationService.createInvitation({
          teamSeasonId: this.teamSeasonId,
          playerId,
          email,
          expiresHours: 168
        });
        const claimCode = String(this.lastInvitation?.claim_code || this.lastInvitation?.claimCode || "");
        if (!claimCode) throw new Error("El servidor no devolvió el código de invitación.");
        if (codeNode) codeNode.textContent = claimCode;
        if (expiryNode) {
          const expiresAt = this.lastInvitation?.expires_at || this.lastInvitation?.expiresAt || null;
          expiryNode.textContent = expiresAt
            ? `Válido hasta ${new Date(expiresAt).toLocaleString()}. Sólo puede utilizarlo el email invitado.`
            : "Código de un solo uso.";
        }
        result?.classList.add("visible");
        if (status) { status.className = "family-invite-status ok"; status.textContent = "✅ Invitación creada. Entrega este código a la familia."; }
      } catch (error) {
        result?.classList.remove("visible");
        if (status) { status.className = "family-invite-status error"; status.textContent = `❌ ${error.message || error}`; }
      } finally {
        button.disabled = false;
      }
    });

    copyButton?.addEventListener("click", async () => {
      const code = String(codeNode?.textContent || "").trim();
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        if (status) { status.className = "family-invite-status ok"; status.textContent = "✅ Código copiado."; }
      } catch {
        if (status) { status.className = "family-invite-status"; status.textContent = "Selecciona y copia manualmente el código mostrado."; }
      }
    });
  }

  bind(container, { onSaved = null } = {}) {
    const root = container?.querySelector?.("[data-family-profile-controls]");
    if (!root || !this.teamSeasonId || !this.userId) return;
    this._bindProfileSave(root, { onSaved });
    this._bindInvitation(root);
  }
}

export default FamilyProfileControls;