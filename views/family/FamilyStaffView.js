/**
 * @fileoverview Staff workspace for Family/Tutor onboarding.
 * @description Trainers can create player-scoped invitation codes. Roles with
 * administrative Family-link authority can additionally bind existing Family
 * accounts to one or more players through the audited V26 controls.
 */

import { DataStore } from "../../services/DataStore.js";
import { Permission } from "../../security/PermissionService.js";
import { FamilyStaffService } from "../../services/family/FamilyStaffService.js";
import { FamilyProfileControls } from "../../components/admin/FamilyProfileControls.js";

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

function formatExpiry(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export class FamilyStaffView {
  constructor(supabaseClient = null, authController = null) {
    this.auth = authController;
    this.service = new FamilyStaffService(supabaseClient);
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.familyControls = null;
    this.teamId = null;
    this.teamSeasonId = null;
    this.players = [];
  }

  _context() {
    return {
      teamId: this.teamId,
      teamSeasonId: this.teamSeasonId
    };
  }

  _can(permission) {
    return Boolean(this.auth?.canPreview?.(permission, this._context()));
  }

  _resolveScope() {
    this.teamId = DataStore.getActiveTeamId?.() || null;
    const season = DataStore.getActiveSeasonContext?.(this.teamId) || null;
    this.teamSeasonId = season?.team_season_id
      || season?.teamSeasonId
      || (season?.source === "v3" ? season?.id : null)
      || DataStore.getActiveTeamSeasonId?.(this.teamId)
      || null;
    this.players = DataStore.getPlayers?.(this.teamId) || DataStore.getPlayers?.() || [];
  }

  async render(containerId = "dashboard-content-area") {
    const container = typeof containerId === "string"
      ? document.getElementById(containerId)
      : containerId;
    if (!container) return;

    this._resolveScope();
    const canInvite = this._can(Permission.INVITE_FAMILY_LINK);
    const canDirectManage = this._can(Permission.REVOKE_FAMILY_LINK);

    container.innerHTML = `
      <section class="family-staff" aria-labelledby="family-staff-title">
        ${this._styles()}
        <header class="family-staff-hero">
          <div>
            <p class="family-staff-eyebrow">FAMILIAS & BIENESTAR</p>
            <h1 id="family-staff-title">Familias y tutores</h1>
            <p>Vincula cada familia con sus jugadores de forma verificada y sin ampliar permisos sobre el resto del equipo.</p>
          </div>
          <span class="family-staff-badge">Acceso por jugador</span>
        </header>

        ${!this.teamSeasonId ? this._missingScope() : ""}
        ${this.teamSeasonId && canInvite ? this._invitePanel() : ""}
        ${this.teamSeasonId && canDirectManage ? this._directAssignmentPanel() : ""}
        ${this.teamSeasonId && !canInvite && !canDirectManage ? this._noPermission() : ""}
      </section>
    `;

    if (this.teamSeasonId && canInvite) this._bindInvite(container);
    if (this.teamSeasonId && canDirectManage) this._bindDirectAssignment(container);
  }

  _styles() {
    return `<style>
      .family-staff{display:grid;gap:18px;color:#0f172a;max-width:1120px;margin:0 auto;padding:4px 2px 28px}
      .family-staff-hero,.family-staff-card{background:#fff;border:1px solid #dbe3ee;border-radius:18px;padding:22px;box-shadow:0 6px 24px rgba(15,23,42,.05)}
      .family-staff-hero{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.family-staff-hero h1{margin:3px 0 8px;font-size:28px}.family-staff-hero p{margin:0;color:#64748b;line-height:1.55;max-width:720px}
      .family-staff-eyebrow{margin:0!important;color:#1d4ed8!important;font-size:12px!important;font-weight:900;letter-spacing:.12em}.family-staff-badge{white-space:nowrap;background:#eff6ff;color:#1d4ed8;padding:7px 11px;border-radius:999px;font-size:12px;font-weight:900}
      .family-staff-card h2{margin:0 0 5px;font-size:18px}.family-staff-card>p{margin:0 0 16px;color:#64748b;line-height:1.5;font-size:13px}.family-staff-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.family-staff-field{display:grid;gap:6px}.family-staff-field.full{grid-column:1/-1}.family-staff-field label{font-size:12px;font-weight:800;color:#334155}
      .family-staff input,.family-staff select{width:100%;min-height:46px;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;background:#fff;color:#0f172a;font:inherit;box-sizing:border-box}.family-staff button{min-height:44px;border:0;border-radius:10px;padding:10px 15px;font-weight:900;cursor:pointer}.family-staff-primary{background:#2563eb;color:#fff}.family-staff-secondary{background:#eef2ff;color:#3730a3}.family-staff button:disabled{opacity:.55;cursor:wait}
      .family-staff-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap}.family-staff-status{min-height:20px;margin-top:10px;font-size:12px;color:#475569}.family-staff-status.error{color:#b91c1c}.family-staff-status.ok{color:#166534}
      .family-invite-result{display:none;margin-top:14px;padding:14px;border:1px solid #86efac;background:#f0fdf4;border-radius:12px}.family-invite-result.visible{display:grid;gap:8px}.family-code-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.family-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;font-weight:900;overflow-wrap:anywhere;background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:10px;flex:1;min-width:190px}.family-admin-result{margin-top:14px}.family-admin-identity{margin-bottom:10px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px}.family-staff-warning{background:#fff7ed;border-color:#fed7aa}.family-staff-warning strong{color:#9a3412}
      @media(max-width:700px){.family-staff{padding:0 0 22px}.family-staff-hero,.family-staff-card{border-radius:14px;padding:16px}.family-staff-hero{display:grid}.family-staff-hero h1{font-size:24px}.family-staff-badge{justify-self:start}.family-staff-grid{grid-template-columns:1fr}.family-staff-field.full{grid-column:auto}.family-staff-actions{display:grid}.family-staff-actions button{width:100%}.family-code-row{display:grid}.family-code{width:100%;box-sizing:border-box}}
    </style>`;
  }

  _missingScope() {
    return `<article class="family-staff-card family-staff-warning">
      <h2>Selecciona equipo y temporada</h2>
      <p>Necesitamos una temporada activa para limitar la invitación y los vínculos a la plantilla correcta.</p>
    </article>`;
  }

  _noPermission() {
    return `<article class="family-staff-card family-staff-warning">
      <h2>Acceso de consulta</h2>
      <p>Tu rol no puede crear ni administrar vínculos Family en esta temporada.</p>
    </article>`;
  }

  _playerOptions() {
    if (!this.players.length) return `<option value="">No hay jugadores en la plantilla activa</option>`;
    return `<option value="">Selecciona jugador</option>${this.players.map(player => `
      <option value="${esc(player.id)}">${esc(playerLabel(player))}</option>
    `).join("")}`;
  }

  _invitePanel() {
    return `<article class="family-staff-card" data-family-invite-panel>
      <h2>Generar invitación para una familia</h2>
      <p>El entrenador puede generar un código para un jugador concreto. El código sólo vincula ese jugador y caduca automáticamente.</p>
      <div class="family-staff-grid">
        <div class="family-staff-field">
          <label for="family-invite-player">Jugador</label>
          <select id="family-invite-player">${this._playerOptions()}</select>
        </div>
        <div class="family-staff-field">
          <label for="family-invite-email">Email de la familia/tutor</label>
          <input id="family-invite-email" type="email" autocomplete="email" placeholder="familia@ejemplo.com">
        </div>
        <div class="family-staff-field">
          <label for="family-invite-expiry">Validez</label>
          <select id="family-invite-expiry">
            <option value="24">24 horas</option>
            <option value="168" selected>7 días</option>
            <option value="720">30 días</option>
          </select>
        </div>
      </div>
      <div class="family-staff-actions"><button type="button" class="family-staff-primary" id="family-create-invite">Generar código de invitación</button></div>
      <div class="family-staff-status" id="family-invite-status" role="status" aria-live="polite"></div>
      <div class="family-invite-result" id="family-invite-result">
        <strong>Código para compartir con la familia</strong>
        <div class="family-code-row"><div class="family-code" id="family-claim-code"></div><button type="button" class="family-staff-secondary" id="family-copy-code">Copiar código</button></div>
        <small id="family-code-expiry"></small>
      </div>
    </article>`;
  }

  _directAssignmentPanel() {
    return `<article class="family-staff-card" data-family-direct-panel>
      <h2>Vincular jugadores a una cuenta Family existente</h2>
      <p>Disponible para administración. Busca la cuenta Family por email y selecciona uno o varios jugadores de la plantilla. El cambio queda auditado.</p>
      <div class="family-staff-grid">
        <div class="family-staff-field full">
          <label for="family-admin-email">Email de la cuenta Family</label>
          <input id="family-admin-email" type="email" autocomplete="email" placeholder="familia@ejemplo.com">
        </div>
      </div>
      <div class="family-staff-actions"><button type="button" class="family-staff-secondary" id="family-find-profile">Buscar cuenta Family</button></div>
      <div class="family-staff-status" id="family-admin-status" role="status" aria-live="polite"></div>
      <div class="family-admin-result" id="family-admin-result"></div>
    </article>`;
  }

  _bindInvite(container) {
    const button = container.querySelector("#family-create-invite");
    const status = container.querySelector("#family-invite-status");
    const result = container.querySelector("#family-invite-result");
    const codeEl = container.querySelector("#family-claim-code");
    const expiryEl = container.querySelector("#family-code-expiry");

    button?.addEventListener("click", async () => {
      const playerId = container.querySelector("#family-invite-player")?.value || "";
      const email = container.querySelector("#family-invite-email")?.value.trim() || "";
      const expiresHours = Number(container.querySelector("#family-invite-expiry")?.value || 168);
      if (!playerId || !email) {
        if (status) { status.className = "family-staff-status error"; status.textContent = "Selecciona jugador e introduce el email de la familia."; }
        return;
      }

      button.disabled = true;
      if (status) { status.className = "family-staff-status"; status.textContent = "Generando invitación…"; }
      result?.classList.remove("visible");
      try {
        const invitation = await this.service.createInvitation({
          teamSeasonId: this.teamSeasonId,
          playerId,
          email,
          expiresHours
        });
        const code = invitation.claim_code || invitation.claimCode || "";
        if (!code) throw new Error("El backend no devolvió el código de invitación.");
        if (codeEl) codeEl.textContent = code;
        if (expiryEl) expiryEl.textContent = `Caduca: ${formatExpiry(invitation.expires_at || invitation.expiresAt)}`;
        result?.classList.add("visible");
        if (status) { status.className = "family-staff-status ok"; status.textContent = "Invitación creada. Comparte el código únicamente con la familia indicada."; }
      } catch (error) {
        if (status) { status.className = "family-staff-status error"; status.textContent = error.message || String(error); }
      } finally {
        button.disabled = false;
      }
    });

    container.querySelector("#family-copy-code")?.addEventListener("click", async () => {
      const code = codeEl?.textContent?.trim() || "";
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        if (status) { status.className = "family-staff-status ok"; status.textContent = "Código copiado."; }
      } catch {
        if (status) { status.className = "family-staff-status"; status.textContent = "Mantén pulsado sobre el código para copiarlo."; }
      }
    });
  }

  _bindDirectAssignment(container) {
    const button = container.querySelector("#family-find-profile");
    const status = container.querySelector("#family-admin-status");
    const result = container.querySelector("#family-admin-result");

    button?.addEventListener("click", async () => {
      const email = container.querySelector("#family-admin-email")?.value.trim() || "";
      if (!email) {
        if (status) { status.className = "family-staff-status error"; status.textContent = "Introduce el email de la cuenta Family."; }
        return;
      }

      button.disabled = true;
      if (status) { status.className = "family-staff-status"; status.textContent = "Buscando cuenta…"; }
      if (result) result.innerHTML = "";
      try {
        const profile = await this.service.findFamilyProfile({
          teamSeasonId: this.teamSeasonId,
          email
        });
        if (!profile?.id) throw new Error("No existe una cuenta Family activa con ese email.");

        this.familyControls = new FamilyProfileControls(this.supabase);
        await this.familyControls.load({
          userId: profile.id,
          teamSeasonId: this.teamSeasonId,
          players: this.players
        });

        if (result) {
          const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Familia/Tutor";
          result.innerHTML = `
            <div class="family-admin-identity"><strong>${esc(name)}</strong> · ${esc(profile.email || email)}</div>
            <div id="family-profile-controls-host">${this.familyControls.render()}</div>
          `;
          this.familyControls.bind(result, {
            onSaved: async () => {
              if (status) { status.className = "family-staff-status ok"; status.textContent = "Vínculos Family actualizados."; }
            }
          });
        }
        if (status) { status.className = "family-staff-status ok"; status.textContent = "Cuenta Family localizada."; }
      } catch (error) {
        if (status) { status.className = "family-staff-status error"; status.textContent = error.message || String(error); }
      } finally {
        button.disabled = false;
      }
    });
  }
}

export default FamilyStaffView;